import "server-only";

import { cookies, headers } from "next/headers";

import { getDb } from "@/server/db";

import {
  LOGIN_SESSION_COOKIE,
  loginSessionCookieOptions,
} from "./login-session-cookie";
import { createAccountService, type AccountService } from "./service";

export {
  AccountError,
  type AccountService,
  type LoginSession,
  type User,
} from "./service";

// The app's Account service, on the real database.
let service: AccountService | undefined;

export function accountService(): AccountService {
  service ??= createAccountService({ db: getDb() });
  return service;
}

// The login session token this browser sent, if any.
export async function loginSessionToken(): Promise<string | null> {
  return (await cookies()).get(LOGIN_SESSION_COOKIE)?.value ?? null;
}

// Only callable from Server Functions and Route Handlers.
export async function setLoginSessionCookie(token: string) {
  const host = (await headers()).get("host");
  (await cookies()).set(
    LOGIN_SESSION_COOKIE,
    token,
    loginSessionCookieOptions(host),
  );
}

// Only callable from Server Functions and Route Handlers.
export async function clearLoginSessionCookie() {
  const host = (await headers()).get("host");
  (await cookies()).set(LOGIN_SESSION_COOKIE, "", {
    ...loginSessionCookieOptions(host),
    maxAge: 0,
  });
}
