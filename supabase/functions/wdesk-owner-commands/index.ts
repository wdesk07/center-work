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
  const userDb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: owner, error: ownerError } = await db.schema("wdesk_control").from("owner_accounts")
    .select("id,email,display_name,owner_role,identity_status")
    .eq("auth_user_id", user.id).eq("identity_status", "verified").maybeSingle();
  if (ownerError) return json(503, { error: "owner_verification_unavailable" });
  if (!owner) return json(403, { error: "primary_owner_only" });

  if (req.method === "GET") {
    const [
      profiles, formations, groups, students, staff, teachers, registrations,
      dailyAttendance, sessionAttendance, courseSessions, weeklySchedule,
      qrRequests, kioskDevices, offlineEvents, operatingDays, roles, userRoles,
      justifications, penalties, penaltyRules, payments, authUsersResult
    ] = await Promise.all([
      db.from("profiles").select("id,display_name,email,status,public_id,first_name,last_name").order("display_name").limit(500),
      db.from("formations").select("id,code,name,duration,status").order("name").limit(100),
      db.from("groups").select("id,formation_id,code,name,academic_year,capacity,status").order("name").limit(150),
      db.from("students").select("id,formation_id,group_id,enrollment_date,student_number,education_level").limit(500),
      db.from("staff").select("id,staff_number,department,position,hire_date,status").limit(250),
      db.from("teachers").select("id,teacher_number,specialization,hire_date,status").limit(250),
      db.from("registrations").select("id,registration_number,person_id,formation_id,group_id,registration_date,status,review_comment,created_at").order("created_at", { ascending: false }).limit(500),
      db.from("daily_attendance").select("id,person_id,local_date,person_type,nominal_time,cutoff_time,arrived_at,status,minutes_after_cutoff,created_at").order("local_date", { ascending: false }).limit(1000),
      db.from("session_attendance").select("id,person_id,session_id,local_date,status,arrived_at,nominal_time,cutoff_time,minutes_after_cutoff,source,updated_at").order("local_date", { ascending: false }).limit(1000),
      db.from("course_sessions").select("id,formation_id,group_id,session_date,planned_start,planned_end,status,subject").order("session_date", { ascending: false }).limit(500),
      db.from("formation_weekly_schedule").select("id,formation_id,weekday_iso,subject,planned_start,planned_end,active").order("weekday_iso").limit(500),
      db.from("qr_checkin_requests").select("id,person_id,session_id,requested_at,status,reviewed_by,reviewed_at,daily_attendance_id,penalty_id,rejection_reason,created_at").order("requested_at", { ascending: false }).limit(500),
      db.from("presence_kiosk_devices").select("id,name,activated_by,activated_at,last_used_at,revoked_at").order("activated_at", { ascending: false }).limit(100),
      db.from("attendance_offline_events").select("id,person_identifier,person_name,observed_at,reason,device_label,review_status,review_note,reviewed_by,reviewed_at,received_at").order("observed_at", { ascending: false }).limit(500),
      db.from("operating_days").select("business_date,status,opened_at,opened_by,closed_at,closed_by,updated_at").order("business_date", { ascending: false }).limit(100),
      db.from("roles").select("id,code,name").order("code").limit(100),
      db.from("user_roles").select("user_id,role_id").limit(1000),
      db.from("absence_justifications").select("id,attendance_id,person_id,reason_type,reason,submitted_at,status,reviewed_by,reviewed_at,review_comment").order("submitted_at", { ascending: false }).limit(500),
      db.from("penalties").select("id,person_id,amount_fcfa,status,created_at,penalty_type,description,rule_id,daily_attendance_id").order("created_at", { ascending: false }).limit(500),
      db.from("penalty_rules").select("id,person_type,penalty_type,description,target_scope,application_mode,applies_after_time,min_delay_minutes,max_delay_minutes,tolerance_minutes,amount_fcfa,blocks_access,priority,active,effective_from,effective_until,formation_id").order("priority").limit(250),
      db.from("payments").select("id,penalty_id,person_id,amount_fcfa,method,provider,transaction_reference,status,received_at,received_by,validated_at,validated_by,refusal_reason,receipt_number,payment_type,payment_category,payer_name,payment_description").order("received_at", { ascending: false }).limit(500),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const readErrors = {
      profiles: profiles.error?.code, formations: formations.error?.code, groups: groups.error?.code,
      students: students.error?.code, staff: staff.error?.code, teachers: teachers.error?.code,
      registrations: registrations.error?.code, daily_attendance: dailyAttendance.error?.code,
      session_attendance: sessionAttendance.error?.code, course_sessions: courseSessions.error?.code,
      weekly_schedule: weeklySchedule.error?.code, qr_requests: qrRequests.error?.code,
      kiosk_devices: kioskDevices.error?.code, offline_events: offlineEvents.error?.code,
      operating_days: operatingDays.error?.code, roles: roles.error?.code, user_roles: userRoles.error?.code, justifications: justifications.error?.code,
      penalties: penalties.error?.code, penalty_rules: penaltyRules.error?.code, payments: payments.error?.code, auth_users: authUsersResult.error?.message
    };
    if (Object.values(readErrors).some(Boolean))
      return json(503, { error: "extended_inventory_read_failed", details: readErrors });
    return json(200, {
      environment: "test",
      owner: { email: owner.email, display_name: owner.display_name, role: owner.owner_role },
      inventory: {
        profiles: profiles.data, formations: formations.data, groups: groups.data,
        students: students.data, staff: staff.data, teachers: teachers.data, registrations: registrations.data,
        daily_attendance: dailyAttendance.data, session_attendance: sessionAttendance.data,
        course_sessions: courseSessions.data, weekly_schedule: weeklySchedule.data,
        qr_requests: qrRequests.data, kiosk_devices: kioskDevices.data, offline_events: offlineEvents.data,
        operating_days: operatingDays.data, roles: roles.data, user_roles: userRoles.data, justifications: justifications.data,
        penalties: penalties.data, penalty_rules: penaltyRules.data, payments: payments.data,
        auth_users: (authUsersResult.data?.users ?? []).map((u: any) => ({ id: u.id, email: u.email, phone: u.phone, email_confirmed_at: u.email_confirmed_at, phone_confirmed_at: u.phone_confirmed_at, last_sign_in_at: u.last_sign_in_at, banned_until: u.banned_until, created_at: u.created_at }))
      },
      capabilities: {
        inventory_read: true, people_lookup: true, registration_lookup: true, operational_inventory_read: true, qr_checkin_review: true, absence_justification_review: true, registration_review: true, kiosk_device_revoke: true, payment_validate: true,
        profile_display_name_update: true, student_assignment_repair: true, transactional_operations: true, arbitrary_sql: false, hard_delete: false
      },
    });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const ownerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const auditWrite = async (action: string, targetType: string, targetRef: string | null, reason: string, requestId: string, before: unknown, write: () => Promise<any>): Promise<Response> => {
    if (!requestId || requestId.length > 100 || reason.length < 8 || reason.length > 500) return json(400, { error: "request_id_and_reason_required" });
    const { data: duplicate } = await db.schema("wdesk_control").from("audit_events").select("id").eq("request_id", requestId).limit(1).maybeSingle();
    if (duplicate) return json(409, { error: "request_already_processed" });
    const { data: audit, error: auditError } = await db.schema("wdesk_control").from("audit_events").insert({
      actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(), action, target_type: targetType,
      target_ref: targetRef, environment: "test", outcome: "recorded", request_id: requestId,
      details: { reason, before, stage: "mutation_started" },
    }).select("id").single();
    if (auditError || !audit) return json(503, { error: "audit_start_failed_operation_not_started" });
    const { data: after, error } = await write();
    if (error) {
      await db.schema("wdesk_control").from("audit_events").update({ outcome: "failure", details: { reason, before, failure_code: error.code ?? "mutation_failed" } }).eq("id", audit.id);
      return json(error.code === "23505" ? 409 : 503, { error: error.code === "23505" ? "duplicate_or_conflicting_record" : "owner_mutation_failed" });
    }
    const { error: finishError } = await db.schema("wdesk_control").from("audit_events").update({ outcome: "success", details: { reason, before, after } }).eq("id", audit.id);
    return json(200, { ok: true, action, before, after, request_id: requestId, ...(finishError ? { audit_warning: "operation_completed_audit_update_failed" } : {}) });
  };

  if (body.action === "formation_upsert") {
    const id = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const duration = typeof body.duration === "string" ? body.duration.trim() : null;
    const status = ["active", "inactive", "archived"].includes(String(body.status)) ? String(body.status) : "active";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if ((id && !ownerUuid.test(id)) || !code || code.length > 40 || !name || name.length > 160 || (description && description.length > 2000) || (duration && duration.length > 80) || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "formation_fields_reason_and_confirmation_required" });
    let before: any = null;
    if (id) { const found = await db.from("formations").select("id,code,name,description,duration,status").eq("id", id).maybeSingle(); if (found.error) return json(503, { error: "formation_lookup_failed" }); if (!found.data) return json(404, { error: "formation_not_found" }); before = found.data; }
    const values = { code, name, description, duration, status, updated_at: new Date().toISOString() };
    return auditWrite(id ? "formation.updated" : "formation.created", "formation", id || null, reason, requestId, before, () => id ? db.from("formations").update(values).eq("id", id).select("id,code,name,description,duration,status").single() : db.from("formations").insert(values).select("id,code,name,description,duration,status").single());
  }

  if (body.action === "group_upsert") {
    const id = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const formationId = typeof body.formation_id === "string" ? body.formation_id.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const academicYear = typeof body.academic_year === "string" ? body.academic_year.trim() : "";
    const capacity = body.capacity === null || body.capacity === "" ? null : Number(body.capacity);
    const status = ["active", "inactive", "archived"].includes(String(body.status)) ? String(body.status) : "active";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if ((id && !ownerUuid.test(id)) || !ownerUuid.test(formationId) || !code || code.length > 40 || !name || name.length > 160 || !academicYear || academicYear.length > 40 || (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "group_fields_reason_and_confirmation_required" });
    const formation = await db.from("formations").select("id,status").eq("id", formationId).maybeSingle();
    if (formation.error) return json(503, { error: "formation_lookup_failed" });
    if (!formation.data) return json(404, { error: "formation_not_found" });
    if (status === "active" && formation.data.status !== "active") return json(409, { error: "active_formation_required" });
    let before: any = null;
    if (id) { const found = await db.from("groups").select("id,formation_id,code,name,academic_year,capacity,status").eq("id", id).maybeSingle(); if (found.error) return json(503, { error: "group_lookup_failed" }); if (!found.data) return json(404, { error: "group_not_found" }); before = found.data; }
    const values = { formation_id: formationId, code, name, academic_year: academicYear, capacity, status, updated_at: new Date().toISOString() };
    return auditWrite(id ? "group.updated" : "group.created", "group", id || null, reason, requestId, before, () => id ? db.from("groups").update(values).eq("id", id).select("id,formation_id,code,name,academic_year,capacity,status").single() : db.from("groups").insert(values).select("id,formation_id,code,name,academic_year,capacity,status").single());
  }

  if (body.action === "weekly_schedule_upsert") {
    const id = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const formationId = typeof body.formation_id === "string" ? body.formation_id.trim() : "";
    const weekday = Number(body.weekday_iso), subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const start = typeof body.planned_start === "string" ? body.planned_start.trim() : "";
    const end = typeof body.planned_end === "string" ? body.planned_end.trim() : "";
    const active = body.active !== false, reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
    if ((id && !ownerUuid.test(id)) || !ownerUuid.test(formationId) || !Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !subject || subject.length > 160 || !timePattern.test(start) || !timePattern.test(end) || end <= start || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "weekly_schedule_fields_reason_and_confirmation_required" });
    const formation = await db.from("formations").select("id").eq("id", formationId).maybeSingle();
    if (formation.error) return json(503, { error: "formation_lookup_failed" });
    if (!formation.data) return json(404, { error: "formation_not_found" });
    let before: any = null;
    if (id) { const found = await db.from("formation_weekly_schedule").select("id,formation_id,weekday_iso,subject,planned_start,planned_end,active").eq("id", id).maybeSingle(); if (found.error) return json(503, { error: "schedule_lookup_failed" }); if (!found.data) return json(404, { error: "schedule_not_found" }); before = found.data; }
    const values = { formation_id: formationId, weekday_iso: weekday, subject, planned_start: start, planned_end: end, active };
    return auditWrite(id ? "weekly_schedule.updated" : "weekly_schedule.created", "formation_weekly_schedule", id || null, reason, requestId, before, () => id ? db.from("formation_weekly_schedule").update(values).eq("id", id).select("id,formation_id,weekday_iso,subject,planned_start,planned_end,active").single() : db.from("formation_weekly_schedule").insert(values).select("id,formation_id,weekday_iso,subject,planned_start,planned_end,active").single());
  }

  if (body.action === "course_session_status") {
    const id = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const status = body.status === "suspended" ? "suspended" : body.status === "scheduled" ? "scheduled" : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "", requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!ownerUuid.test(id) || !status || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "course_session_status_reason_and_confirmation_required" });
    const found = await db.from("course_sessions").select("id,formation_id,group_id,session_date,planned_start,planned_end,status,subject").eq("id", id).maybeSingle();
    if (found.error) return json(503, { error: "course_session_lookup_failed" });
    if (!found.data) return json(404, { error: "course_session_not_found" });
    if (!["scheduled", "suspended"].includes(found.data.status)) return json(409, { error: "course_session_not_in_suspendable_state" });
    if (found.data.status === status) return json(409, { error: "course_session_already_in_requested_state" });
    return auditWrite(status === "suspended" ? "course_session.suspended" : "course_session.resumed", "course_session", id, reason, requestId, found.data, () => db.from("course_sessions").update({ status }).eq("id", id).select("id,formation_id,group_id,session_date,planned_start,planned_end,status,subject").single());
  }

  if (body.action === "penalty_rule_upsert") {
    const id = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const personType = ["student", "staff", "teacher"].includes(String(body.person_type)) ? String(body.person_type) : "";
    const penaltyType = typeof body.penalty_type === "string" ? body.penalty_type.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const scope = ["all", "students", "staff", "teacher"].includes(String(body.target_scope)) ? String(body.target_scope) : "";
    const mode = ["automatic", "manual"].includes(String(body.application_mode)) ? String(body.application_mode) : "";
    const minDelay = Number(body.min_delay_minutes), maxDelay = body.max_delay_minutes === null || body.max_delay_minutes === "" ? null : Number(body.max_delay_minutes);
    const tolerance = Number(body.tolerance_minutes), amount = Number(body.amount_fcfa), priority = Number(body.priority);
    const formationId = body.formation_id === null || body.formation_id === "" ? null : typeof body.formation_id === "string" ? body.formation_id.trim() : undefined;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "", requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if ((id && !ownerUuid.test(id)) || !personType || !penaltyType || penaltyType.length > 80 || !scope || !mode || !Number.isInteger(minDelay) || minDelay < 0 || (maxDelay !== null && (!Number.isInteger(maxDelay) || maxDelay < minDelay)) || !Number.isInteger(tolerance) || tolerance < 0 || !Number.isInteger(amount) || amount <= 0 || !Number.isInteger(priority) || priority < 0 || (formationId !== null && (formationId === undefined || !ownerUuid.test(formationId))) || typeof body.blocks_access !== "boolean" || typeof body.active !== "boolean" || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "penalty_rule_fields_reason_and_confirmation_required" });
    let before: any = null;
    if (id) { const found = await db.from("penalty_rules").select("*").eq("id", id).maybeSingle(); if (found.error) return json(503, { error: "penalty_rule_lookup_failed" }); if (!found.data) return json(404, { error: "penalty_rule_not_found" }); before = found.data; }
    const values = { person_type: personType, penalty_type: penaltyType, description, target_scope: scope, application_mode: mode, min_delay_minutes: minDelay, max_delay_minutes: maxDelay, tolerance_minutes: tolerance, amount_fcfa: amount, priority, formation_id: formationId, blocks_access: body.blocks_access, active: body.active };
    return auditWrite(id ? "penalty_rule.updated" : "penalty_rule.created", "penalty_rule", id || null, reason, requestId, before, () => id ? db.from("penalty_rules").update(values).eq("id", id).select("*").single() : db.from("penalty_rules").insert(values).select("*").single());
  }

  if (body.action === "role_assignment") {
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
    const roleId = typeof body.role_id === "string" ? body.role_id.trim() : "";
    const mode = body.mode === "revoke" ? "revoke" : body.mode === "assign" ? "assign" : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "", requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!ownerUuid.test(targetUserId) || !ownerUuid.test(roleId) || !mode || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "role_assignment_fields_reason_and_confirmation_required" });
    const ownerTarget = await db.schema("wdesk_control").from("owner_accounts").select("id").eq("auth_user_id", targetUserId).maybeSingle();
    if (ownerTarget.error) return json(503, { error: "owner_target_lookup_failed" });
    if (ownerTarget.data) return json(403, { error: "primary_owner_roles_are_protected" });
    const [authTarget, roleTarget] = await Promise.all([db.auth.admin.getUserById(targetUserId), db.from("roles").select("id,code,name").eq("id", roleId).maybeSingle()]);
    if (authTarget.error || !authTarget.data.user) return json(404, { error: "auth_user_not_found" });
    if (roleTarget.error) return json(503, { error: "role_lookup_failed" });
    if (!roleTarget.data || ["OWNER", "PRIMARY_OWNER", "WDESK_OWNER"].includes(String(roleTarget.data.code).toUpperCase())) return json(403, { error: "role_not_assignable" });
    const existing = await db.from("user_roles").select("user_id,role_id").eq("user_id", targetUserId).eq("role_id", roleId).maybeSingle();
    if (existing.error) return json(503, { error: "role_assignment_lookup_failed" });
    if (mode === "assign" && existing.data) return json(409, { error: "role_already_assigned" });
    if (mode === "revoke" && !existing.data) return json(404, { error: "role_assignment_not_found" });
    return auditWrite(mode === "assign" ? "user_role.assigned" : "user_role.revoked", "user_role", targetUserId + ":" + roleId, reason, requestId, existing.data, () => mode === "assign" ? db.from("user_roles").insert({ user_id: targetUserId, role_id: roleId }).select("user_id,role_id").single() : db.from("user_roles").delete().eq("user_id", targetUserId).eq("role_id", roleId).select("user_id,role_id").single());
  }


  if (body.action === "attendance_correct") {
    const targetType = body.target_type === "daily" ? "daily" : body.target_type === "session" ? "session" : "";
    const id = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const status = typeof body.status === "string" ? body.status : "";
    const arrivedAt = body.arrived_at === null || body.arrived_at === "" ? null : typeof body.arrived_at === "string" ? body.arrived_at : undefined;
    const minutes = Number(body.minutes_after_cutoff);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const validStatuses = targetType === "daily" ? ["on_time", "late", "absent", "regularized"] : ["present", "late", "absent", "pending"];
    if (!targetType || !ownerUuid.test(id) || !validStatuses.includes(status) || arrivedAt === undefined || (arrivedAt !== null && Number.isNaN(Date.parse(arrivedAt))) || !Number.isInteger(minutes) || minutes < 0 || minutes > 10000 || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "attendance_correction_fields_reason_and_confirmation_required" });
    const table = targetType === "daily" ? "daily_attendance" : "session_attendance";
    const fields = targetType === "daily" ? "id,person_id,local_date,status,arrived_at,minutes_after_cutoff" : "id,person_id,session_id,local_date,status,arrived_at,minutes_after_cutoff,daily_attendance_id";
    const found = await db.from(table).select(fields).eq("id", id).maybeSingle();
    if (found.error) return json(503, { error: "attendance_lookup_failed" });
    if (!found.data) return json(404, { error: "attendance_record_not_found" });
    return auditWrite("attendance.corrected", targetType, id, reason, requestId, found.data, async () => {
      const { data: after, error } = await db.from(table).update({ status, arrived_at: arrivedAt, minutes_after_cutoff: minutes }).eq("id", id).select(fields).single();
      if (error || !after) return { data: null, error: error ?? { code: "attendance_correction_failed" } };
      const { error: eventError } = await db.from("attendance_events").insert({
        attendance_id: targetType === "daily" ? id : (found.data as any).daily_attendance_id ?? null,
        person_id: (found.data as any).person_id, event_type: "correction", source: "wdesk_owner",
        created_by: user.id, metadata: { target_type: targetType, target_id: id, reason, request_id: requestId, before: found.data, after },
      });
      return { data: { ...after, attendance_event_error: eventError?.code ?? null }, error: null };
    });
  }

  if (body.action === "account_invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !displayName || displayName.length > 120 || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "account_invite_fields_reason_and_confirmation_required" });
    const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) return json(503, { error: "auth_user_lookup_failed" });
    if (users.data.users.some((u: any) => String(u.email ?? "").toLowerCase() === email)) return json(409, { error: "auth_user_already_exists" });
    const redirectTo = (Deno.env.get("CONTROL_CENTER_ORIGIN") ?? "https://center-work.vercel.app") + "/auth/callback";
    return auditWrite("account.invited", "auth_user", email, reason, requestId, null,
      () => db.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName }, redirectTo }));
  }

  if (body.action === "account_status") {
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
    const status = body.status === "suspended" ? "suspended" : body.status === "active" ? "active" : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!ownerUuid.test(targetUserId) || !status || reason.length < 8 || body.confirmation !== "CONFIRMER") return json(400, { error: "account_status_fields_reason_and_confirmation_required" });
    const ownerTarget = await db.schema("wdesk_control").from("owner_accounts").select("id").eq("auth_user_id", targetUserId).maybeSingle();
    if (ownerTarget.error) return json(503, { error: "owner_target_lookup_failed" });
    if (ownerTarget.data) return json(403, { error: "primary_owner_account_is_protected" });
    const found = await db.auth.admin.getUserById(targetUserId);
    if (found.error || !found.data.user) return json(404, { error: "auth_user_not_found" });
    const before = { id: found.data.user.id, email: found.data.user.email, banned_until: found.data.user.banned_until };
    const banDuration = status === "suspended" ? "876000h" : "none";
    return auditWrite(status === "suspended" ? "account.suspended" : "account.reactivated", "auth_user", targetUserId, reason, requestId, before,
      () => db.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration }));
  }

  if (body.action === "payment_validate") {
    const paymentId = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(paymentId) || !requestId || requestId.length > 100 || reason.length < 8 || reason.length > 500)
      return json(400, { error: "payment_validation_reason_required" });
    if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

    const { data: before, error: beforeError } = await db.from("payments")
      .select("id,person_id,penalty_id,amount_fcfa,payment_type,status,receipt_number,received_at,validated_at")
      .eq("id", paymentId).maybeSingle();
    if (beforeError) return json(503, { error: "payment_lookup_failed" });
    if (!before) return json(404, { error: "payment_not_found" });
    if (before.status !== "pending") return json(409, { error: "payment_not_pending_or_already_final" });

    let penaltyBefore: Record<string, unknown> | null = null;
    let attendanceBefore: Record<string, unknown> | null = null;
    if (before.penalty_id) {
      const { data } = await db.from("penalties").select("id,status,amount_fcfa,daily_attendance_id").eq("id", before.penalty_id).maybeSingle();
      penaltyBefore = data;
      if (data?.daily_attendance_id) {
        const { data: attendance } = await db.from("daily_attendance").select("id,status,local_date,arrived_at").eq("id", data.daily_attendance_id).maybeSingle();
        attendanceBefore = attendance;
      }
    }

    const { data: auditStart, error: auditStartError } = await db.schema("wdesk_control").from("audit_events")
      .insert({
        actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
        action: "payment.validated", target_type: "payment", target_ref: paymentId,
        environment: "test", outcome: "recorded", request_id: requestId,
        details: { reason, before: { status: before.status, amount_fcfa: before.amount_fcfa, penalty_id: before.penalty_id }, stage: "validation_started" },
      }).select("id").single();
    if (auditStartError?.code === "23505") return json(409, { error: "request_already_processed" });
    if (auditStartError || !auditStart) return json(503, { error: "audit_start_failed_operation_not_started" });

    const { data: after, error: validationError } = await userDb.from("payments")
      .update({ status: "validated" })
      .eq("id", paymentId).eq("status", "pending")
      .select("id,person_id,penalty_id,amount_fcfa,payment_type,status,receipt_number,received_at,validated_at,validated_by")
      .maybeSingle();
    if (validationError || !after) {
      await db.schema("wdesk_control").from("audit_events").update({
        outcome: "failure",
        details: { reason, before: { status: before.status, amount_fcfa: before.amount_fcfa, penalty_id: before.penalty_id }, failure_code: validationError?.code ?? "payment_not_updated" },
      }).eq("id", auditStart.id);
      if ((validationError?.message ?? "").includes("FINAL_PAYMENT_IMMUTABLE")) return json(409, { error: "payment_already_final" });
      if ((validationError?.message ?? "").includes("PENALTY_NOT_PAYABLE")) return json(409, { error: "linked_penalty_not_payable" });
      if ((validationError?.message ?? "").includes("Unauthorized payment validation")) return json(403, { error: "aero_finance_role_required" });
      return json(409, { error: "payment_validation_rejected_by_aero_service_rules" });
    }

    let penaltyAfter: Record<string, unknown> | null = null;
    let attendanceAfter: Record<string, unknown> | null = null;
    if (after.penalty_id) {
      const { data } = await db.from("penalties").select("id,status,amount_fcfa,daily_attendance_id").eq("id", after.penalty_id).maybeSingle();
      penaltyAfter = data;
      if (data?.daily_attendance_id) {
        const { data: attendance } = await db.from("daily_attendance").select("id,status,local_date,arrived_at").eq("id", data.daily_attendance_id).maybeSingle();
        attendanceAfter = attendance;
      }
    }
    const { error: auditFinishError } = await db.schema("wdesk_control").from("audit_events").update({
      outcome: "success",
      details: {
        reason,
        before: { payment: before, penalty: penaltyBefore, attendance: attendanceBefore },
        after: { payment: after, penalty: penaltyAfter, attendance: attendanceAfter },
        effects: { receipt_generated: Boolean(after.receipt_number), penalty_regularized: penaltyBefore?.status === "pending" && penaltyAfter?.status === "paid", attendance_regularized: attendanceBefore?.status === "late" && attendanceAfter?.status === "regularized" },
      },
    }).eq("id", auditStart.id);
    if (auditFinishError) return json(200, { ok: true, action: "payment.validated", after, audit_warning: "operation_completed_audit_update_failed" });
    return json(200, { ok: true, action: "payment.validated", before, after, penalty_before: penaltyBefore, penalty_after: penaltyAfter, attendance_before: attendanceBefore, attendance_after: attendanceAfter, request_id: requestId });
  }

  if (body.action === "kiosk_device_revoke") {
    const deviceId = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(deviceId) || !requestId || requestId.length > 100 || reason.length < 8 || reason.length > 500)
      return json(400, { error: "kiosk_device_reason_required" });
    if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

    const { data: before, error: beforeError } = await db.from("presence_kiosk_devices")
      .select("id,name,activated_at,last_used_at,revoked_at").eq("id", deviceId).maybeSingle();
    if (beforeError) return json(503, { error: "kiosk_device_lookup_failed" });
    if (!before) return json(404, { error: "kiosk_device_not_found" });
    if (before.revoked_at) return json(409, { error: "kiosk_device_already_revoked" });

    const { data: auditStart, error: auditStartError } = await db.schema("wdesk_control").from("audit_events")
      .insert({
        actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
        action: "kiosk.device_revoked", target_type: "presence_kiosk_device", target_ref: deviceId,
        environment: "test", outcome: "recorded", request_id: requestId,
        details: { reason, before: { name: before.name, revoked_at: before.revoked_at }, stage: "revocation_started" },
      }).select("id").single();
    if (auditStartError?.code === "23505") return json(409, { error: "request_already_processed" });
    if (auditStartError || !auditStart) return json(503, { error: "audit_start_failed_operation_not_started" });

    const { data: result, error: revokeError } = await userDb.rpc("revoke_presence_kiosk", { p_device_id: deviceId });
    if (revokeError) {
      await db.schema("wdesk_control").from("audit_events").update({
        outcome: "failure",
        details: { reason, before: { name: before.name, revoked_at: before.revoked_at }, failure_code: revokeError.code ?? "revoke_failed" },
      }).eq("id", auditStart.id);
      if ((revokeError.message ?? "").includes("KIOSK_ADMIN_REQUIRED")) return json(403, { error: "aero_director_role_required_for_kiosk_revoke" });
      if ((revokeError.message ?? "").includes("KIOSK_NOT_FOUND_OR_ALREADY_REVOKED")) return json(409, { error: "kiosk_device_already_revoked" });
      return json(409, { error: "kiosk_revocation_rejected_by_aero_service_rules" });
    }

    const { data: after } = await db.from("presence_kiosk_devices")
      .select("id,name,activated_at,last_used_at,revoked_at").eq("id", deviceId).maybeSingle();
    const { error: auditFinishError } = await db.schema("wdesk_control").from("audit_events").update({
      outcome: "success",
      details: { reason, before: { name: before.name, revoked_at: before.revoked_at }, after: after ?? { revoked: true }, result },
    }).eq("id", auditStart.id);
    if (auditFinishError) return json(200, { ok: true, action: "kiosk.device_revoked", result, audit_warning: "operation_completed_audit_update_failed" });
    return json(200, { ok: true, action: "kiosk.device_revoked", result, before, after, request_id: requestId });
  }

  if (body.action === "registration_review") {
    const registrationId = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(registrationId) || !requestId || requestId.length > 100 || !decision || reason.length < 8 || reason.length > 500)
      return json(400, { error: "registration_decision_reason_required" });
    if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

    const { data: before, error: beforeError } = await db.from("registrations")
      .select("id,registration_number,person_id,formation_id,group_id,registration_date,status,review_comment,created_at")
      .eq("id", registrationId).maybeSingle();
    if (beforeError) return json(503, { error: "registration_lookup_failed" });
    if (!before) return json(404, { error: "registration_not_found" });
    if (before.status !== "pending") return json(409, { error: "registration_not_pending" });

    const { data: auditStart, error: auditStartError } = await db.schema("wdesk_control").from("audit_events")
      .insert({
        actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
        action: "registration.reviewed", target_type: "registration", target_ref: registrationId,
        environment: "test", outcome: "recorded", request_id: requestId,
        details: { reason, decision, before: { status: before.status, person_id: before.person_id, formation_id: before.formation_id, group_id: before.group_id }, stage: "review_started" },
      }).select("id").single();
    if (auditStartError?.code === "23505") return json(409, { error: "request_already_processed" });
    if (auditStartError || !auditStart) return json(503, { error: "audit_start_failed_operation_not_started" });

    const { data: result, error: reviewError } = await userDb.rpc("review_registration_and_activate_student", {
      p_registration_id: registrationId, p_decision: decision, p_comment: reason,
    });
    if (reviewError) {
      await db.schema("wdesk_control").from("audit_events").update({
        outcome: "failure",
        details: { reason, decision, before: { status: before.status }, failure_code: reviewError.code ?? "review_failed" },
      }).eq("id", auditStart.id);
      const message = reviewError.message ?? "";
      if (message.includes("REGISTRATION_REVIEW_FORBIDDEN")) return json(403, { error: "aero_director_or_secretariat_role_required" });
      if (message.includes("REGISTRATION_NOT_FOUND")) return json(404, { error: "registration_not_found" });
      if (message.includes("INVALID_REGISTRATION_DECISION")) return json(400, { error: "invalid_registration_decision" });
      if (message.includes("ACTIVE_FORMATION_REQUIRED")) return json(409, { error: "active_formation_required" });
      if (message.includes("LEARNER_PROFILE_NOT_FOUND")) return json(409, { error: "learner_profile_not_found" });
      if (message.includes("STUDENT_ROLE_NOT_CONFIGURED")) return json(503, { error: "student_role_not_configured" });
      return json(409, { error: "registration_review_rejected_by_aero_service_rules" });
    }

    const { data: after } = await db.from("registrations")
      .select("id,status,review_comment,person_id,formation_id,group_id")
      .eq("id", registrationId).maybeSingle();
    const { error: auditFinishError } = await db.schema("wdesk_control").from("audit_events").update({
      outcome: "success",
      details: { reason, decision, before, after: after ?? { status: decision }, result },
    }).eq("id", auditStart.id);
    if (auditFinishError) return json(200, { ok: true, action: "registration.reviewed", result, audit_warning: "operation_completed_audit_update_failed" });
    return json(200, { ok: true, action: "registration.reviewed", before, after, result, request_id: requestId });
  }

  if (body.action === "absence_justification_review") {
    const justificationId = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(justificationId) || !requestId || requestId.length > 100 || !decision || reason.length < 8 || reason.length > 500)
      return json(400, { error: "absence_justification_decision_reason_required" });
    if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

    const { data: before, error: beforeError } = await db.from("absence_justifications")
      .select("id,attendance_id,person_id,reason_type,reason,submitted_at,status,reviewed_by,reviewed_at,review_comment")
      .eq("id", justificationId).maybeSingle();
    if (beforeError) return json(503, { error: "absence_justification_lookup_failed" });
    if (!before) return json(404, { error: "absence_justification_not_found" });
    if (before.status !== "pending") return json(409, { error: "absence_justification_already_reviewed" });

    const { data: auditStart, error: auditStartError } = await db.schema("wdesk_control").from("audit_events")
      .insert({
        actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
        action: "absence.justification_reviewed", target_type: "absence_justification", target_ref: justificationId,
        environment: "test", outcome: "recorded", request_id: requestId,
        details: { reason, decision, before: { status: before.status, attendance_id: before.attendance_id }, stage: "review_started" },
      }).select("id").single();
    if (auditStartError?.code === "23505") return json(409, { error: "request_already_processed" });
    if (auditStartError || !auditStart) return json(503, { error: "audit_start_failed_operation_not_started" });

    const { data: result, error: reviewError } = await userDb.rpc("review_absence_justification", {
      p_justification_id: justificationId, p_decision: decision, p_comment: reason,
    });
    if (reviewError) {
      await db.schema("wdesk_control").from("audit_events").update({
        outcome: "failure",
        details: { reason, decision, before: { status: before.status }, failure_code: reviewError.code ?? "review_failed" },
      }).eq("id", auditStart.id);
      const message = reviewError.message ?? "";
      if (message.includes("ADMIN_REVIEW_REQUIRED")) return json(403, { error: "aero_director_or_secretariat_role_required" });
      if (message.includes("JUSTIFICATION_NOT_FOUND")) return json(404, { error: "absence_justification_not_found" });
      if (message.includes("JUSTIFICATION_ALREADY_REVIEWED")) return json(409, { error: "absence_justification_already_reviewed" });
      if (message.includes("INVALID_JUSTIFICATION_DECISION")) return json(400, { error: "invalid_absence_justification_decision" });
      return json(409, { error: "absence_justification_review_rejected_by_aero_service_rules" });
    }

    const { data: after } = await db.from("absence_justifications")
      .select("id,attendance_id,person_id,status,reviewed_by,reviewed_at,review_comment")
      .eq("id", justificationId).maybeSingle();
    const { error: auditFinishError } = await db.schema("wdesk_control").from("audit_events").update({
      outcome: "success",
      details: { reason, decision, before, after: after ?? { status: decision }, result },
    }).eq("id", auditStart.id);
    if (auditFinishError) return json(200, { ok: true, action: "absence.justification_reviewed", result, audit_warning: "operation_completed_audit_update_failed" });
    return json(200, { ok: true, action: "absence.justification_reviewed", before, after, result, request_id: requestId });
  }

  if (body.action === "qr_checkin_review") {
    const requestTarget = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(requestTarget) || !requestId || requestId.length > 100 || !decision || reason.length < 8 || reason.length > 500)
      return json(400, { error: "qr_request_decision_reason_required" });
    if (body.confirmation !== "CONFIRMER") return json(400, { error: "explicit_confirmation_required" });

    const { data: before, error: beforeError } = await db.from("qr_checkin_requests")
      .select("id,person_id,session_id,requested_at,status,rejection_reason,daily_attendance_id,penalty_id")
      .eq("id", requestTarget).maybeSingle();
    if (beforeError) return json(503, { error: "qr_request_lookup_failed" });
    if (!before) return json(404, { error: "qr_request_not_found" });
    if (before.status !== "pending_confirmation") return json(409, { error: "qr_request_not_pending_confirmation" });

    const { data: auditStart, error: auditStartError } = await db.schema("wdesk_control").from("audit_events")
      .insert({
        actor_auth_user_id: user.id, actor_email: user.email.toLowerCase(),
        action: "qr.request_reviewed", target_type: "qr_checkin_request", target_ref: requestTarget,
        environment: "test", outcome: "recorded", request_id: requestId,
        details: { reason, decision, before: { status: before.status }, stage: "review_started" },
      }).select("id").single();
    if (auditStartError?.code === "23505") return json(409, { error: "request_already_processed" });
    if (auditStartError || !auditStart) return json(503, { error: "audit_start_failed_operation_not_started" });

    const { data: result, error: reviewError } = await userDb.rpc("review_qr_checkin_request", {
      p_request_id: requestTarget, p_decision: decision, p_comment: reason,
    });
    if (reviewError) {
      await db.schema("wdesk_control").from("audit_events").update({
        outcome: "failure",
        details: { reason, decision, before: { status: before.status }, failure_code: reviewError.code ?? "review_failed" },
      }).eq("id", auditStart.id);
      const message = reviewError.message ?? "";
      if (message.includes("QR_CHECKIN_REQUEST_NOT_PENDING")) return json(409, { error: "qr_request_not_pending_confirmation" });
      if (message.includes("ATTENDANCE_ALREADY_RECORDED")) return json(409, { error: "attendance_already_recorded" });
      if (message.includes("NO_TRAINING_SESSION_SCHEDULED_TODAY")) return json(409, { error: "no_training_session_scheduled" });
      if (message.includes("QR_CHECKIN_REVIEW_FORBIDDEN")) return json(403, { error: "aero_role_required_for_qr_review" });
      return json(409, { error: "qr_review_rejected_by_aero_service_rules" });
    }

    const { data: after } = await db.from("qr_checkin_requests")
      .select("id,status,rejection_reason,reviewed_by,reviewed_at,daily_attendance_id,penalty_id")
      .eq("id", requestTarget).maybeSingle();
    const { error: auditFinishError } = await db.schema("wdesk_control").from("audit_events").update({
      outcome: "success",
      details: { reason, decision, before: { status: before.status }, after: after ?? { status: decision }, result },
    }).eq("id", auditStart.id);
    if (auditFinishError) return json(200, { ok: true, action: "qr.request_reviewed", result, audit_warning: "operation_completed_audit_update_failed" });
    return json(200, { ok: true, action: "qr.request_reviewed", result, before, after, request_id: requestId });
  }

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
