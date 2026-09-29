"use client";

import { useActionState } from "react";

import type { AuthFormState } from "../auth-actions";

// The shared login and sign-up form. Errors come back from the server
// action; the username is kept so a typo in the password costs one field.
export function AuthForm({
  action,
  submitLabel,
  newPassword,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  newPassword?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    username: "",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
        Username
        <input
          name="username"
          defaultValue={state.username}
          key={state.username}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-normal text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={newPassword ? 8 : undefined}
          autoComplete={newPassword ? "new-password" : "current-password"}
          className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-normal text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {newPassword && (
          <span className="text-xs font-normal text-gray-500">
            At least 8 characters.
          </span>
        )}
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-primary px-5 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
