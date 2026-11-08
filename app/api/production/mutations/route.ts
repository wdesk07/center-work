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
]);

function fail(error: string, status: number) {
  return NextResponse.json({ error, environment: "production", writable: false }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const wdeskUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const wdeskKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const productionUrl = process.env.AERO_PRODUCTION_SUPABASE_URL;
  const productionKey = process.env.AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;

  if (!wdeskUrl || !wdeskKey || !productionUrl || !productionKey) return fail("production_mutations_not_configured", 503);
  if (new URL(wdeskUrl).hostname !== "nuijzdqnhjzcnqpfqvvl.supabase.co") return fail("wdesk_test_project_mismatch", 503);
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

  const ownerCheck = await fetch(`${wdeskUrl}/functions/v1/wdesk-owner-commands`, {
    method: "GET",
    headers: { apikey: wdeskKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!ownerCheck.ok) return fail("primary_owner_only", 403);
  const ownerPayload = await ownerCheck.json().catch(() => null);
  if (ownerPayload?.environment !== "test" || String(ownerPayload?.owner?.email ?? "").toLowerCase() !== "wdesk87@gmail.com" || !ownerPayload?.owner?.role) {
    return fail("primary_owner_only", 403);
  }

  const production = createClient(productionUrl, productionKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-WDESK-Environment": "production-owner-mutation" } },
  });
  const { data: ownerProfile, error: profileError } = await production
    .from("profiles").select("id,status,email").eq("email", "wdesk87@gmail.com").maybeSingle();
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
