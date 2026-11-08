import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyProductionOwner() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || new URL(url).hostname !== "tsyhuuqtbcdpolhmmeri.supabase.co" || !key || !serviceKey) {
    return { error: "production_owner_auth_not_configured", status: 503 as const };
  }

  const store = await cookies();
  const auth = createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { data: sessionData, error: sessionError } = await auth.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) return { error: "authentication_required", status: 401 as const };

  const { data: userData, error: userError } = await auth.auth.getUser(token);
  const user = userData.user;
  if (userError || !user || String(user.email ?? "").toLowerCase() !== "wdesk87@gmail.com") {
    return { error: "primary_owner_only", status: 403 as const };
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id,email,status,display_name,first_name,last_name")
    .eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active" || String(profile.email ?? "").toLowerCase() !== "wdesk87@gmail.com") {
    return { error: "production_owner_profile_not_verified", status: 403 as const };
  }
  const { data: assignments, error: assignmentsError } = await db.from("user_roles")
    .select("role_id").eq("user_id", profile.id);
  if (assignmentsError) return { error: "production_owner_roles_unavailable", status: 503 as const };
  const roleIds = (assignments ?? []).map(x => x.role_id);
  const { data: roles, error: rolesError } = roleIds.length
    ? await db.from("roles").select("code").in("id", roleIds)
    : { data: [], error: null };
  const roleCodes = new Set((roles ?? []).map(x => String(x.code).toUpperCase()));
  if (rolesError || !roleCodes.has("DIRECTOR") || !roleCodes.has("PRE_ADMIN")) {
    return { error: "production_owner_roles_not_verified", status: 403 as const };
  }
  return { db, profile, roleCodes };
}

export async function GET() {
  const verified = await verifyProductionOwner();
  if ("error" in verified) return NextResponse.json({ error: verified.error }, { status: verified.status });
  const { data: audit, error: auditError, count } = await verified.db.from("audit_logs")
    .select("id,actor_id,action,module,entity_type,entity_id,old_values,new_values,created_at,visibility", { count: "exact" })
    .order("created_at", { ascending: false }).limit(40);
  const ownerName = verified.profile.display_name || [verified.profile.first_name, verified.profile.last_name].filter(Boolean).join(" ") || "WDESK Principal";
  return NextResponse.json({
    environment: "production",
    owner: { email: "wdesk87@gmail.com", display_name: ownerName, role: "WDESK OWNER" },
    projects: [{ platform: "Supabase", project_name: "Aéro Service PROD", environment: "PRODUCTION", external_ref: "tsyhuuqtbcdpolhmmeri", connection_status: "connected", dashboard_url: "https://supabase.com/dashboard/project/tsyhuuqtbcdpolhmmeri" }],
    recent_audit: auditError ? [] : (audit ?? []).map(x => ({ id: x.id, occurred_at: x.created_at, actor_email: x.actor_id === verified.profile.id ? "wdesk87@gmail.com" : undefined, action: x.action, target_type: x.entity_type, target_ref: x.entity_id, environment: "PRODUCTION", outcome: "success", details: { module: x.module, old_values: x.old_values, new_values: x.new_values } })),
    audit_total: count ?? 0,
    diagnostics: null,
    incidents: [],
    capabilities: { provider_operations: false, diagnostics_read: true, incident_tracking: false },
  }, { headers: { "Cache-Control": "no-store, private" } });
}

export async function POST() {
  const verified = await verifyProductionOwner();
  if ("error" in verified) return NextResponse.json({ error: verified.error }, { status: verified.status });
  return NextResponse.json({ ok: true, environment: "production", owner_verified: true }, { headers: { "Cache-Control": "no-store" } });
}
