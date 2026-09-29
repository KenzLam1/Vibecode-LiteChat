import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { accountService, loginSessionToken, type User } from "./accounts";

export type CurrentUser = User;

// The user this request's login session cookie belongs to, or null when
// logged out. Resolved once per request. Route Handlers use this and answer
// 401 on null; pages and Server Functions use requireUser().
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await loginSessionToken();
  if (!token) return null;
  return accountService().resolve(token);
});

// The only way pages and Server Functions get the current user. Logged-out
// visitors are sent to the login page.
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
