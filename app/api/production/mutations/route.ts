import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedActions = new Set([
  "formation_upsert",
  "group_upsert",
  "schedule_upsert",
  "course_suspension_create",
  "course_suspension_revoke",
  "penalty_rule_upsert",
  "attendance_correct",
  "justification_review",
  "qr_request_review",
  "payment_review",
  "profile_update",
  "profile_status_update",
  "user_role_assign",
  "user_role_revoke",
  "account_invite",
  "student_archive",
  "student_hard_delete",
]);

function fail(error: string, status: number) {
  return NextResponse.json({ error, environment: "production", writable: false }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return fail("cross_origin_request_forbidden", 403); }
    catch { return fail("invalid_origin", 403); }
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return fail("json_content_type_required", 415);
  const wdeskUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const wdeskKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const productionUrl = process.env.AERO_PRODUCTION_SUPABASE_URL;
  const productionKey = process.env.AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;

  if (!wdeskUrl || !wdeskKey || !productionUrl || !productionKey) return fail("production_mutations_not_configured", 503);
  if (new URL(wdeskUrl).hostname !== "tsyhuuqtbcdpolhmmeri.supabase.co") return fail("production_auth_project_mismatch", 503);
  if (new URL(productionUrl).protocol !== "https:" || new URL(productionUrl).hostname !== "tsyhuuqtbcdpolhmmeri.supabase.co") return fail("production_project_mismatch", 503);

  let body: any;
  try { body = await request.json(); } catch { return fail("invalid_json", 400); }
  if (!body || typeof body !== "object" || !allowedActions.has(body.action)) return fail("production_action_not_allowed", 400);
  if (body.confirmation !== "CONFIRMER" || typeof body.reason !== "string" || body.reason.trim().length < 8 || body.reason.length > 500) {
    return fail("reason_and_confirmation_required", 400);
  }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return fail("invalid_payload", 400);
  if (typeof body.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) {
    return fail("valid_request_id_required", 400);
  }

  const store = await cookies();
  const wdesk = createServerClient(wdeskUrl, wdeskKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { data: sessionData, error: sessionError } = await wdesk.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) return fail("authentication_required", 401);

  const production = createClient(productionUrl, productionKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-WDESK-Environment": "production-owner-mutation" } },
  });
  const { data: ownerProfile, error: profileError } = await production
    .from("profiles").select("id,status,email").eq("email", "wdesk87@gmail.com").maybeSingle();
  const { data: authenticatedUser, error: authenticatedUserError } = await wdesk.auth.getUser(accessToken);
  if (authenticatedUserError || !authenticatedUser.user || authenticatedUser.user.id !== ownerProfile?.id || String(authenticatedUser.user.email ?? "").toLowerCase() !== "wdesk87@gmail.com") return fail("primary_owner_authentication_not_verified", 403);
  if (profileError || !ownerProfile || ownerProfile.status !== "active") return fail("production_owner_profile_not_verified", 403);

  const { data: assignments, error: assignmentsError } = await production
    .from("user_roles").select("role_id").eq("user_id", ownerProfile.id);
  if (assignmentsError) return fail("production_owner_roles_unavailable", 503);
  const roleIds = (assignments ?? []).map((item) => item.role_id);
  const { data: roles, error: rolesError } = roleIds.length
    ? await production.from("roles").select("code").in("id", roleIds)
    : { data: [], error: null };
  const roleCodes = new Set((roles ?? []).map((item) => String(item.code).toUpperCase()));
  if (rolesError || !roleCodes.has("DIRECTOR") || !roleCodes.has("PRE_ADMIN")) return fail("production_owner_roles_not_verified", 403);


  if (body.action === "student_archive") {
    const targetId = String(body.payload.target_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) return fail("valid_student_id_required", 400);
    const { data, error } = await production.rpc("wdesk_owner_archive_student", {
      p_actor_id: ownerProfile.id,
      p_target_id: targetId,
      p_reason: body.reason.trim(),
      p_request_id: body.request_id,
    });
    if (error) return NextResponse.json({ error: String(error.message ?? "student_archive_failed").slice(0, 240), environment: "production", writable: true }, { status: 422, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ...data, environment: "production", writable: true }, { headers: { "Cache-Control": "no-store, private" } });
  }

  if (body.action === "student_hard_delete") {
    const targetId = String(body.payload.target_id ?? "");
    const expectedEmail = String(body.payload.expected_email ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) return fail("valid_student_id_required", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedEmail)) return fail("valid_target_email_required", 400);
    if (body.payload.delete_confirmation !== "SUPPRIMER DEFINITIVEMENT") return fail("permanent_delete_confirmation_required", 400);

    const { data: targetAuth, error: targetAuthError } = await production.auth.admin.getUserById(targetId);
    if (targetAuthError || !targetAuth.user || String(targetAuth.user.email ?? "").toLowerCase() !== expectedEmail) {
      return fail("target_auth_identity_not_verified", 409);
    }

    const { data: prepared, error: prepareError } = await production.rpc("wdesk_owner_prepare_student_hard_delete", {
      p_actor_id: ownerProfile.id,
      p_target_id: targetId,
      p_expected_email: expectedEmail,
      p_reason: body.reason.trim(),
      p_request_id: body.request_id,
    });
    if (prepareError) {
      return NextResponse.json({ error: String(prepareError.message ?? "student_hard_delete_precheck_failed").slice(0, 240), environment: "production", writable: false }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    const { error: deleteError } = await production.auth.admin.deleteUser(targetId);
    if (deleteError) {
      return NextResponse.json({
        error: "auth_deletion_pending_retry_required",
        detail: String(deleteError.message ?? "Auth deletion failed").slice(0, 180),
        partial: true,
        registrations_deleted: prepared?.registrations_deleted ?? 0,
        environment: "production",
        writable: true,
      }, { status: 202, headers: { "Cache-Control": "no-store, private" } });
    }

    const auditUpdate = await production.from("audit_logs")
      .update({
        action: "student_hard_delete",
        new_values: {
          ...(prepared ?? {}),
          request_id: body.request_id,
          target_email: expectedEmail,
          reason: body.reason.trim(),
          status: "completed",
          completed_at: new Date().toISOString(),
        },
      })
      .eq("module", "wdesk_production")
      .eq("action", "student_hard_delete_pending")
      .eq("new_values->>request_id", body.request_id)
      .select("id").maybeSingle();

    return NextResponse.json({
      ok: true,
      action: "student_hard_delete",
      entity_id: targetId,
      target_email: expectedEmail,
      registrations_deleted: prepared?.registrations_deleted ?? 0,
      auth_user_deleted: true,
      audit_warning: Boolean(auditUpdate.error || !auditUpdate.data),
      request_id: body.request_id,
      environment: "production",
      writable: true,
    }, { headers: { "Cache-Control": "no-store, private" } });
  }

  if (body.action === "account_invite") {
    const email = String(body.payload.email ?? "").trim().toLowerCase();
    const firstName = String(body.payload.first_name ?? "").trim();
    const lastName = String(body.payload.last_name ?? "").trim();
    const phone = String(body.payload.phone ?? "").trim();
    const roleId = String(body.payload.role_id ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !firstName || !lastName || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roleId)) {
      return fail("valid_email_name_and_role_required", 400);
    }
    const { data: role, error: roleError } = await production.from("roles").select("id,code").eq("id", roleId).maybeSingle();
    if (roleError || !role || ["DIRECTOR", "PRE_ADMIN"].includes(String(role.code).toUpperCase())) return fail("standard_role_required_for_invitation", 400);
    const { data: invited, error: inviteError } = await production.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? new URL("/auth/callback", origin).toString() : undefined,
      data: { first_name: firstName, last_name: lastName, display_name: [firstName, lastName].join(" "), phone: phone || null },
    });
    if (inviteError || !invited.user) return fail(String(inviteError?.message ?? "account_invitation_failed").slice(0, 200), 422);
    const { data: assigned, error: assignError } = await production.rpc("wdesk_owner_production_mutation", {
      p_actor_id: ownerProfile.id,
      p_action: "user_role_assign",
      p_payload: { target_id: invited.user.id, role_id: roleId },
      p_reason: body.reason.trim(),
      p_request_id: body.request_id,
    });
    if (assignError) {
      return NextResponse.json({ error: "account_created_role_assignment_pending", user_id: invited.user.id, email, detail: String(assignError.message).slice(0, 160), environment: "production", writable: true }, { status: 202, headers: { "Cache-Control": "no-store, private" } });
    }
    return NextResponse.json({ ok: true, action: "account_invite", user_id: invited.user.id, email, role: role.code, assignment: assigned, environment: "production", writable: true }, { headers: { "Cache-Control": "no-store, private" } });
  }

  const { data, error } = await production.rpc("wdesk_owner_production_mutation", {
    p_actor_id: ownerProfile.id,
    p_action: body.action,
    p_payload: body.payload,
    p_reason: body.reason.trim(),
    p_request_id: body.request_id,
  });
  if (error) {
    const safeMessage = String(error.message ?? "production_mutation_failed").slice(0, 240);
    return NextResponse.json({ error: safeMessage, environment: "production", writable: true }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ...data, environment: "production", writable: true }, { headers: { "Cache-Control": "no-store, private" } });
}
