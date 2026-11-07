import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const buildReads = (production: SupabaseClient) => ({
  profiles: () => production.from("profiles").select("id,public_id,first_name,last_name,display_name,phone,whatsapp,email,status,created_at,updated_at").order("display_name").limit(500),
  students: () => production.from("students").select("id,student_number,formation_id,group_id,enrollment_date,education_level").limit(500),
  staff: () => production.from("staff").select("id,staff_number,department,position,hire_date,status").limit(250),
  teachers: () => production.from("teachers").select("id,teacher_number,specialization,hire_date,status").limit(250),
  formations: () => production.from("formations").select("id,code,name,description,duration,status").order("name").limit(150),
  groups: () => production.from("groups").select("id,formation_id,code,name,academic_year,capacity,status").order("name").limit(250),
  registrations: () => production.from("registrations").select("id,registration_number,person_id,formation_id,group_id,registration_date,status,submitted_at,reviewed_at,review_comment").order("created_at",{ascending:false}).limit(500),
  attendance: () => production.from("attendance").select("id,session_id,person_id,person_type,status,planned_at,arrived_at,delay_minutes,access_blocked,source,anomaly,anomaly_reason,created_at,updated_at").order("created_at",{ascending:false}).limit(1500),
  attendance_events: () => production.from("attendance_events").select("id,attendance_id,person_id,event_type,occurred_at,source,metadata,created_by").order("occurred_at",{ascending:false}).limit(2000),
  course_sessions: () => production.from("course_sessions").select("id,schedule_template_id,formation_id,group_id,subject_id,teacher_id,room_id,session_date,planned_start,planned_end,session_type,status,cancellation_reason").order("session_date",{ascending:false}).limit(750),
  schedule_templates: () => production.from("schedule_templates").select("id,formation_id,group_id,subject_id,teacher_id,room_id,weekday,start_time,end_time,valid_from,valid_until,recurrence_rule,status").limit(500),
  session_attendees: () => production.from("session_attendees").select("session_id,student_id,expected").limit(1500),
  roles: () => production.from("roles").select("id,code,name,description,is_system").order("code").limit(100),
  user_roles: () => production.from("user_roles").select("user_id,role_id,assigned_by,assigned_at").limit(1500),
  permissions: () => production.from("permissions").select("id,code,name,module,description").order("module").limit(250),
  role_permissions: () => production.from("role_permissions").select("role_id,permission_id").limit(1000),
  penalty_rules: () => production.from("penalty_rules").select("id,person_type,min_delay_minutes,max_delay_minutes,amount_fcfa,tolerance_minutes,blocks_access,priority,active,effective_from,effective_until,penalty_type,description,formation_id,target_scope,application_mode,applies_after_time").order("priority").limit(250),
  penalties: () => production.from("penalties").select("id,attendance_id,person_id,rule_id,amount_fcfa,status,calculated_at,cancelled_reason,created_at,penalty_type,description").order("created_at",{ascending:false}).limit(750),
  payments: () => production.from("payments").select("id,penalty_id,person_id,amount_fcfa,method,provider,transaction_reference,status,received_at,received_by,validated_at,validated_by,refusal_reason,receipt_number,payment_type,payment_category,payer_name,payer_phone,payer_identifier,payment_description").order("received_at",{ascending:false}).limit(750),
  checkpoints: () => production.from("checkpoints").select("id,code,name,type,latitude,longitude,radius_m,active,created_at").limit(100),
  kiosk_devices: () => production.from("presence_kiosk_devices").select("id,name,activated_by,activated_at,last_used_at,revoked_at").order("activated_at",{ascending:false}).limit(100),
  kiosk_auth_attempts: () => production.from("kiosk_auth_attempts").select("id,success,attempted_at").order("attempted_at",{ascending:false}).limit(500),
  qr_requests: () => production.from("qr_checkin_requests").select("id,person_id,session_id,requested_at,status,reviewed_by,reviewed_at,attendance_id,penalty_id,rejection_reason").order("requested_at",{ascending:false}).limit(500),
  operating_days: () => production.from("operating_days").select("business_date,status,opened_at,opened_by,closed_at,closed_by,updated_at").order("business_date",{ascending:false}).limit(100),
  course_suspensions: () => production.from("course_suspensions").select("id,formation_id,starts_on,ends_on,reason,created_by,created_at,revoked_at,revoked_by").order("created_at",{ascending:false}).limit(250),
  system_settings: () => production.from("system_settings").select("key,value,description,updated_at").order("key").limit(250),
  audit_logs: () => production.from("audit_logs").select("id,actor_id,action,module,entity_type,entity_id,old_values,new_values,created_at,visibility").order("created_at",{ascending:false}).limit(1000),
});

async function authorizeOwner(accessToken: string, url: string, key: string) {
  const response = await fetch(`${url}/functions/v1/wdesk-owner-commands`, {
    method: "GET",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const payload = await response.json().catch(() => null);
  return payload?.environment === "test" && payload?.owner?.role != null;
}

export async function GET() {
  const wdeskUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const wdeskKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const productionUrl = process.env.AERO_PRODUCTION_SUPABASE_URL;
  const productionKey = process.env.AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;

  if (!wdeskUrl || !wdeskKey || !productionUrl || !productionKey) {
    return NextResponse.json({ error: "production_readonly_not_configured", environment: "production", writable: false }, { status: 503 });
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
  if (sessionError || !accessToken) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const isOwner = await authorizeOwner(accessToken, wdeskUrl, wdeskKey);
  if (!isOwner) return NextResponse.json({ error: "primary_owner_only" }, { status: 403 });

  if (!productionUrl.startsWith("https://") || !productionUrl.includes("tsyhuuqtbcdpolhmmeri.supabase.co")) {
    return NextResponse.json({ error: "production_project_mismatch", environment: "production", writable: false }, { status: 503 });
  }

  const production = createClient(productionUrl, productionKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-WDESK-Environment": "production-read-only" } },
  });

  const reads = buildReads(production);
  const entries = await Promise.all(Object.entries(reads).map(async ([name, query]) => {
    const result = await query();
    return [name, result] as const;
  }));
  const errors = Object.fromEntries(entries.filter(([, result]) => result.error).map(([name, result]) => [name, result.error?.code ?? "read_failed"]));
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "production_inventory_read_failed", environment: "production", writable: false, details: errors }, { status: 503 });
  }

  return NextResponse.json({
    environment: "production",
    writable: false,
    read_only: true,
    project_ref: "tsyhuuqtbcdpolhmmeri",
    owner: { verified: true },
    inventory: Object.fromEntries(entries.map(([name, result]) => [name, result.data])),
    capabilities: { inventory_read: true, mutations: false, arbitrary_sql: false, auth_user_admin: false },
  }, { headers: { "Cache-Control": "no-store, private" } });
}

export async function POST() {
  return NextResponse.json({ error: "production_read_only", writable: false }, { status: 405 });
}
