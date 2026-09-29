import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentUser } from "@/server/current-user";

import { logIn } from "../auth-actions";
import { AuthCard } from "../components/auth-card";
import { AuthForm } from "../components/auth-form";

export const metadata: Metadata = { title: "Log in · LiteChat" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard
      subtitle="Log in to your conversations"
      footer="New to LiteChat?"
      footerLink="Create an account"
      footerHref="/signup"
    >
      <AuthForm action={logIn} submitLabel="Log in" />
    </AuthCard>
  );
}
