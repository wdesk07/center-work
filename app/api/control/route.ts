import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "server_configuration_missing" }, { status: 503 });

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  // Validate the user against Supabase Auth on the server before trusting the session.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const response = await fetch(`${url}/functions/v1/wdesk-control-api`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${sessionData.session.access_token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// No write proxy is exposed until each future action has a dedicated,
// allowlisted server handler and an explicit owner-approval flow.
export async function POST() {
  return NextResponse.json(
    { error: "operator_write_actions_not_enabled" },
    { status: 405, headers: { Allow: "GET" } },
  );
}
