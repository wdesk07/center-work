import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function forward(request: Request, method: "GET" | "POST") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error:"server_configuration_missing" }, { status:503 });

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) return NextResponse.json({ error:"authentication_required" }, { status:401 });

  const headers = new Headers({
    "apikey": key,
    "Authorization": `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
  });
  const response = await fetch(`${url}/functions/v1/wdesk-control-api`, {
    method,
    headers,
    ...(method === "POST" ? { body: await request.text() } : {}),
    cache:"no-store",
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control":"no-store" },
  });
}

export async function GET(request: Request) { return forward(request, "GET"); }
export async function POST(request: Request) { return forward(request, "POST"); }
