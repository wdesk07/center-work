import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const loginUrl = new URL("/login", request.url);

  // Some previously issued magic links may return to the site root with the
  // PKCE code. Exchange it through the dedicated callback before owner checks.
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode) {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("code", authCode);
    return NextResponse.redirect(callbackUrl);
  }

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
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (ownerCheck.status === 401) return NextResponse.redirect(loginUrl);
  if (ownerCheck.status === 403) return NextResponse.redirect(new URL("/activate-owner", request.url));
  if (!ownerCheck.ok) {
    return new NextResponse("Le contrôle d’accès est momentanément indisponible. Réessayez dans quelques instants.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return response;
}

// The API route performs its own session check and the Edge Function enforces
// the owner allowlist. Excluding it here is required for first-time activation.
export const config = { matcher: ["/", "/operator/:path*"] };
