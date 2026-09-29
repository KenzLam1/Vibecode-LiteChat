"use server";

import { redirect } from "next/navigation";

import {
  AccountError,
  accountService,
  clearLoginSessionCookie,
  loginSessionToken,
  setLoginSessionCookie,
} from "@/server/accounts";

export type AuthFormState = { error: string | null; username: string };

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function logIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = field(formData, "username");
  try {
    const { token } = await accountService().logIn(
      username,
      field(formData, "password"),
    );
    await setLoginSessionCookie(token);
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message, username };
    throw error;
  }
  redirect("/");
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = field(formData, "username");
  const password = field(formData, "password");
  try {
    const accounts = accountService();
    await accounts.signUp(username, password);
    const { token } = await accounts.logIn(username, password);
    await setLoginSessionCookie(token);
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message, username };
    throw error;
  }
  redirect("/");
}

export async function logOut() {
  const token = await loginSessionToken();
  if (token) await accountService().logOut(token);
  await clearLoginSessionCookie();
  redirect("/login");
}
