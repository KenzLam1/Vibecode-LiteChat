import Link from "next/link";
import { connection } from "next/server";

import { requireUser } from "@/server/current-user";
import { getSystemPrompt } from "@/server/system-prompt";

import { SystemPromptForm } from "./system-prompt-form";

export default async function ProfilePage() {
  await connection();
  const user = await requireUser();
  const systemPrompt = getSystemPrompt(user);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">Signed in as {user.username}</p>
        </div>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Back to conversations
        </Link>
      </div>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-gray-600">
          This instruction applies to every conversation from its next turn.
        </p>
        <SystemPromptForm initialValue={systemPrompt} />
      </section>
    </main>
  );
}
