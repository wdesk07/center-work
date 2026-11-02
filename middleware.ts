import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const loginUrl = new URL("/login", request.url);

  if (!url || !key) {
    loginUrl.searchParams.set("setup", "required");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.redirect(loginUrl);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return NextResponse.redirect(loginUrl);

  const ownerCheck = await fetch(`${url}/functions/v1/wdesk-control-api`, {
    headers: { apikey:key, Authorization:`Bearer ${token}` },
    cache:"no-store",
  });
  if (ownerCheck.status === 403) return NextResponse.redirect(new URL("/activate-owner", request.url));
  if (!ownerCheck.ok) return new NextResponse("Contrôle d’accès temporairement indisponible.", { status:503 });
  return response;
}

export const config = { matcher: ["/", "/api/control/:path*"] };
