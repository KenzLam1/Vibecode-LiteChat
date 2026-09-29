import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentUser } from "@/server/current-user";

import { signUp } from "../auth-actions";
import { AuthCard } from "../components/auth-card";
import { AuthForm } from "../components/auth-form";

export const metadata: Metadata = { title: "Sign up · LiteChat" };

export default async function SignUpPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard
      subtitle="Create an account"
      footer="Already have an account?"
      footerLink="Log in"
      footerHref="/login"
    >
      <AuthForm action={signUp} submitLabel="Sign up" newPassword />
    </AuthCard>
  );
}
