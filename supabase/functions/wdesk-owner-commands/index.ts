import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("CONTROL_CENTER_ORIGIN") ?? "https://center-work.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json(503, { error: "server_configuration_missing" });

  const bearer = req.headers.get("Authorization") ?? "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!token) return json(401, { error: "authentication_required" });

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  const user = authData.user;
  if (authError || !user?.email || !user.email_confirmed_at) return json(401, { error: "verified_account_required" });

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: owner, error: ownerError } = await db.schema("wdesk_control").from("owner_accounts")
    .select("id,email,display_name,owner_role,identity_status")
    .eq("auth_user_id", user.id).eq("identity_status", "verified").maybeSingle();
  if (ownerError) return json(503, { error: "owner_verification_unavailable" });
  if (!owner) return json(403, { error: "primary_owner_only" });

  if (req.method === "GET") {
    const [profiles, formations, groups, students, staff, teachers, registrations] = await Promise.all([
      db.from("profiles").select("id,display_name,email,status,public_id,first_name,last_name").order("display_name").limit(500),
      db.from("formations").select("id,code,name,duration,status").order("name").limit(100),
      db.from("groups").select("id,formation_id,code,name,academic_year,capacity,status").order("name").limit(150),
      db.from("students").select("id,formation_id,group_id,enrollment_date,student_number,education_level").limit(500),
      db.from("staff").select("id,staff_number,department,position,hire_date,status").limit(250),
      db.from("teachers").select("id,teacher_number,specialization,hire_date,status").limit(250),
      db.from("registrations").select("id,registration_number,person_id,formation_id,group_id,registration_date,status,review_comment,created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    if (profiles.error || formations.error || groups.error || students.error || staff.error || teachers.error || registrations.error)
      return json(503, { error: "extended_inventory_read_failed", details: {
        profiles: profiles.error?.code, formations: formations.error?.code, groups: groups.error?.code,
        students: students.error?.code, staff: staff.error?.code, teachers: teachers.error?.code,
        registrations: registrations.error?.code
      } });
    return json(200, {
      environment: "test",
      owner: { email: owner.email, display_name: owner.display_name, role: owner.owner_role },
      inventory: {
        profiles: profiles.data, formations: formations.data, groups: groups.data,
        students: students.data, staff: staff.data, teachers: teachers.data, registrations: registrations.data
      },
      capabilities: {
        inventory_read: true, people_lookup: true, registration_lookup: true,
        profile_display_name_update: true, arbitrary_sql: false, hard_delete: false
      },
    });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  if (body.action === "student_assignment_repair") {
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const formationId = typeof body.formation_id === "string" ? body.formation_id.trim() : "";
    const groupId = body.group_id === null || body.group_id === "" ? null : typeof body.group_id === "string" ? body.group_id.trim() : undefined;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!requestId || requestId.length > 100 || !uuidPattern.test(targetId) || !uuidPattern.test(formationId) ||
        groupId === undefined || (groupId !== null && !uuidPattern.test(groupId)) ||
        !reason || reason.length < 8 || reason.length > 500)
      return json(400, { error: "student_formation_group_and_reason_required" });
    if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

    const { data, error } = await db.rpc("wdesk_repair_student_assignment", {
      p_student_id: targetId,
      p_formation_id: formationId,
      p_group_id: groupId,
      p_reason: reason,
      p_request_id: requestId,
      p_actor_auth_user_id: user.id,
      p_actor_email: user.email.toLowerCase(),
    });
    if (error) {
      const message = error.message ?? "";
      if (error.code === "23505") return json(409, { error: "request_already_processed" });
      const conflictErrors: Record<string, string> = {
        REQUEST_ALREADY_PROCESSED: "request_already_processed",
        STUDENT_RECORD_NOT_FOUND: "student_record_not_found",
        STUDENT_PROFILE_NOT_FOUND: "student_profile_not_found",
        STUDENT_PROFILE_NOT_ACTIVE: "student_profile_not_active",
        FORMATION_NOT_FOUND: "formation_not_found",
        FORMATION_NOT_ACTIVE: "formation_not_active",
        GROUP_NOT_FOUND: "group_not_found",
        GROUP_DOES_NOT_BELONG_TO_ACTIVE_FORMATION: "group_does_not_belong_to_active_formation",
        APPROVED_REGISTRATION_REQUIRED: "approved_registration_required_before_assignment_repair",
      };
      const matched = Object.entries(conflictErrors).find(([key]) => message.includes(key));
      return json(matched ? 409 : 503, { error: matched?.[1] ?? "student_assignment_repair_failed" });
    }
    return json(200, {
      ok: true,
      action: "student.formation_group_repaired",
      request_id: requestId,
      ...((data && typeof data === "object") ? data : {}),
    });
  }

  if (body.action !== "profile_display_name_update") return json(400, { error: "unsupported_action" });

  const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
  const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!requestId || requestId.length > 100 || !targetId || !displayName || displayName.length > 120 || !reason || reason.length < 8 || reason.length > 500)
    return json(400, { error: "request_id_target_name_and_reason_required" });
  if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(targetId)) return json(400, { error: "valid_profile_id_required" });
  const { data, error } = await db.rpc("wdesk_update_profile_display_name", {
    p_profile_id: targetId,
    p_display_name: displayName,
    p_reason: reason,
    p_request_id: requestId,
    p_actor_auth_user_id: user.id,
    p_actor_email: user.email.toLowerCase(),
  });
  if (error) {
    const message = error.message ?? "";
    if (error.code === "23505" || message.includes("REQUEST_ALREADY_PROCESSED")) return json(409, { error: "request_already_processed" });
    if (message.includes("OWNER_SELF_CHANGE_NOT_ALLOWED")) return json(400, { error: "owner_profile_self_change_not_allowed_here" });
    if (message.includes("PROFILE_NOT_FOUND")) return json(404, { error: "profile_not_found" });
    if (message.includes("REQUEST_ALREADY_PROCESSED")) return json(409, { error: "request_already_processed" });
    return json(503, { error: "profile_update_failed" });
  }
  return json(200, { ...((data && typeof data === "object") ? data : {}), action: "profile.display_name_updated", request_id: requestId });
});
