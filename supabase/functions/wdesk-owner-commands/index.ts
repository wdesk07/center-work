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

    const { data: priorEvent } = await db.schema("wdesk_control").from("audit_events")
      .select("id").eq("request_id", requestId).maybeSingle();
    if (priorEvent) return json(409, { error: "request_already_processed" });

    const { data: student, error: studentReadError } = await db.from("students")
      .select("id,formation_id,group_id,student_number").eq("id", targetId).maybeSingle();
    if (studentReadError || !student) return json(404, { error: "student_record_not_found" });

    const { data: profile, error: profileReadError } = await db.from("profiles")
      .select("id,status,display_name,email").eq("id", targetId).maybeSingle();
    if (profileReadError || !profile) return json(404, { error: "student_profile_not_found" });
    if (profile.status !== "active") return json(409, { error: "student_profile_not_active" });

    const { data: formation, error: formationError } = await db.from("formations")
      .select("id,name,status").eq("id", formationId).maybeSingle();
    if (formationError || !formation) return json(404, { error: "formation_not_found" });
    if (formation.status !== "active") return json(409, { error: "formation_not_active" });

    let group: { id: string; name: string; formation_id: string; status: string } | null = null;
    if (groupId) {
      const { data, error } = await db.from("groups").select("id,name,formation_id,status")
        .eq("id", groupId).maybeSingle();
      if (error || !data) return json(404, { error: "group_not_found" });
      if (data.status !== "active" || data.formation_id !== formationId)
        return json(409, { error: "group_does_not_belong_to_active_formation" });
      group = data;
    }

    const { data: registration, error: registrationError } = await db.from("registrations")
      .select("id,registration_number,formation_id,group_id,status")
      .eq("person_id", targetId).eq("status", "approved")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (registrationError) return json(503, { error: "registration_lookup_failed" });
    if (!registration) return json(409, { error: "approved_registration_required_before_assignment_repair" });

    const before = {
      student: { formation_id: student.formation_id, group_id: student.group_id },
      registration: { id: registration.id, registration_number: registration.registration_number,
        formation_id: registration.formation_id, group_id: registration.group_id }
    };

    const { data: studentAfter, error: studentUpdateError } = await db.from("students")
      .update({ formation_id: formationId, group_id: groupId }).eq("id", targetId)
      .select("id,formation_id,group_id,student_number").maybeSingle();
    if (studentUpdateError || !studentAfter) return json(409, { error: "student_assignment_update_failed" });

    const { data: registrationAfter, error: registrationUpdateError } = await db.from("registrations")
      .update({ formation_id: formationId, group_id: groupId }).eq("id", registration.id)
      .select("id,registration_number,formation_id,group_id,status").maybeSingle();
    if (registrationUpdateError || !registrationAfter) {
      await db.from("students").update({ formation_id: student.formation_id, group_id: student.group_id }).eq("id", targetId);
      return json(503, { error: "registration_update_failed_student_assignment_rolled_back" });
    }

    const { error: auditError } = await db.schema("wdesk_control").from("audit_events").insert({
      actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
      action: "student.formation_group_repaired", target_type: "student", target_ref: targetId,
      environment: "test", outcome: "success", request_id: requestId,
      details: {
        reason, registration_number: registration.registration_number,
        before, after: {
          student: { formation_id: studentAfter.formation_id, group_id: studentAfter.group_id },
          registration: { formation_id: registrationAfter.formation_id, group_id: registrationAfter.group_id }
        },
        selected_formation: formation.name, selected_group: group?.name ?? null
      }
    });
    if (auditError) {
      await db.from("registrations").update({ formation_id: registration.formation_id, group_id: registration.group_id }).eq("id", registration.id);
      await db.from("students").update({ formation_id: student.formation_id, group_id: student.group_id }).eq("id", targetId);
      return json(503, { error: "audit_failed_assignment_rolled_back" });
    }
    return json(200, {
      ok: true, action: "student.formation_group_repaired", request_id: requestId,
      person: { id: profile.id, display_name: profile.display_name, email: profile.email },
      formation, group, before,
      after: {
        student: { formation_id: studentAfter.formation_id, group_id: studentAfter.group_id },
        registration: { formation_id: registrationAfter.formation_id, group_id: registrationAfter.group_id }
      }
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

  const { data: priorEvent } = await db.schema("wdesk_control").from("audit_events")
    .select("id").eq("request_id", requestId).maybeSingle();
  if (priorEvent) return json(409, { error: "request_already_processed" });

  const { data: before, error: readError } = await db.from("profiles")
    .select("id,display_name,email,status").eq("id", targetId).maybeSingle();
  if (readError || !before) return json(404, { error: "profile_not_found" });
  if (before.id === user.id) return json(400, { error: "owner_profile_self_change_not_allowed_here" });

  const { data: after, error: updateError } = await db.from("profiles")
    .update({ display_name: displayName }).eq("id", targetId)
    .select("id,display_name,email,status").maybeSingle();
  if (updateError || !after) return json(409, { error: "profile_update_failed" });

  const { error: auditError } = await db.schema("wdesk_control").from("audit_events").insert({
    actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
    action: "profile.display_name_updated", target_type: "profile", target_ref: targetId,
    environment: "test", outcome: "success", request_id: requestId,
    details: { reason, before: { display_name: before.display_name }, after: { display_name: after.display_name } },
  });
  if (auditError) {
    await db.from("profiles").update({ display_name: before.display_name }).eq("id", targetId);
    return json(503, { error: "audit_failed_change_rolled_back" });
  }
  return json(200, { ok: true, action: "profile.display_name_updated", before, after, request_id: requestId });
});
