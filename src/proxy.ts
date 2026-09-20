import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ERROR_MESSAGES } from "@/shared/errors";
import { isPublicDemo } from "@/auth/public-demo";

const PUBLIC_PATHS = new Set([
  "/sign-in",
  "/api/health",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public demo: nobody signs in. Send the sign-in and invite pages home.
  if (isPublicDemo()) {
    if (pathname === "/sign-in" || pathname.startsWith("/invite/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    if (isPublic(pathname)) return response;
    return unauthorized(request, pathname);
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user || isPublic(pathname)) {
    return response;
  }

  return unauthorized(request, pathname);
}

function unauthorized(request: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: ERROR_MESSAGES.unauthorized,
        },
      },
      { status: 401 },
    );
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
