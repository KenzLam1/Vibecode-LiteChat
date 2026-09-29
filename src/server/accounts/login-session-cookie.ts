// The login session cookie. Kept free of server-only imports so that the
// proxy can use it too.

export const LOGIN_SESSION_COOKIE = "litechat_login_session";
export const LOGIN_SESSION_DAYS = 30;

// HttpOnly and SameSite=Lax always; Secure everywhere except localhost, where
// the dev server runs over plain http.
export function loginSessionCookieOptions(host: string | null) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !isLocalhost(host),
    maxAge: LOGIN_SESSION_DAYS * 24 * 60 * 60,
  };
}

function isLocalhost(host: string | null) {
  if (!host) return false;
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

// Writes must come from a page on this same host. Browsers send Origin on
// every non-GET request, so a missing one is treated as foreign.
export function isSameOrigin(origin: string | null, host: string | null) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
