import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() { return forward("GET"); }
export async function POST(request: Request) { return forward("POST", await request.text()); }

async function forward(method: "GET" | "POST", body?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "server_configuration_missing" }, { status: 503 });

  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const response = await fetch(`${url}/functions/v1/wdesk-owner-commands`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body } : {}),
    cache: "no-store",
  });
  const raw = await response.text();
  return new NextResponse(raw, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" },
  });
}
