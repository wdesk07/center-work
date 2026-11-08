import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const loginUrl = new URL("/login", request.url);

  // Always complete PKCE on this WDESK deployment's own origin.
  // Never fall back to the Aéro Service application URL.
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode) {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("code", authCode);
    return NextResponse.redirect(callbackUrl);
  }

  if (!url || new URL(url).hostname !== "tsyhuuqtbcdpolhmmeri.supabase.co" || !key) {
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

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return NextResponse.redirect(loginUrl);

  // Owner authorization and every data/API operation are verified server-side
  // against Aéro Service PRODUCTION by /api/control and /api/production.
  // Do not call the retired TEST Edge Function from middleware.
  return response;
}

export const config = { matcher: ["/"] };
