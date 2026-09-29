import { NextResponse, type NextRequest } from "next/server";

import {
  LOGIN_SESSION_COOKIE,
  isSameOrigin,
  loginSessionCookieOptions,
} from "@/server/accounts/login-session-cookie";

// Runs before every route. It only looks at the cookie; whether the login
// session is real is decided by requireUser() and currentUser(), which every
// page, Server Function and API route calls.

const PUBLIC_PATHS = new Set(["/login", "/signup"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const safe = SAFE_METHODS.has(request.method);

  // Writes (API calls and Server Functions) must come from this app's pages.
  if (!safe && !isSameOrigin(request.headers.get("origin"), host)) {
    return new NextResponse("Cross-origin request refused.", { status: 403 });
  }

  const { pathname } = request.nextUrl;
  const token = request.cookies.get(LOGIN_SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return new NextResponse("You're logged out. Log in and try again.", {
        status: 401,
      });
    }
    // Server Function posts go through to requireUser(), which redirects
    // in a way the client understands.
    if (safe && !PUBLIC_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const response = NextResponse.next();
  // The database extends a login session while it's used; keep the cookie in
  // step. Only on GET, so it can never overwrite a cookie a write just set.
  if (token && request.method === "GET") {
    response.cookies.set(
      LOGIN_SESSION_COOKIE,
      token,
      loginSessionCookieOptions(host),
    );
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|__nextjs|favicon\\.ico).*)"],
};
