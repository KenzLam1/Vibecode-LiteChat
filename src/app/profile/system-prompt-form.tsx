"use client";

import { useState, type FormEvent } from "react";

import { SYSTEM_PROMPT_MAX_CHARS } from "@/lib/limits";

export function SystemPromptForm({ initialValue }: { initialValue: string }) {
  const [systemPrompt, setSystemPrompt] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (systemPrompt.length > SYSTEM_PROMPT_MAX_CHARS) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const response = await fetch("/api/profile/system-prompt", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      if (!response.ok) throw new Error(await response.text());
      setMessage("System prompt saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "System prompt couldn't be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void save(event)}>
      <label htmlFor="system-prompt" className="font-medium text-gray-800">
        System prompt
      </label>
      <textarea
        id="system-prompt"
        aria-describedby="system-prompt-count"
        className="min-h-56 rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-primary"
        maxLength={SYSTEM_PROMPT_MAX_CHARS}
        placeholder="For example: Always answer in French."
        value={systemPrompt}
        onChange={(event) => setSystemPrompt(event.target.value)}
      />
      <div className="flex items-center justify-between gap-4 text-sm">
        <span id="system-prompt-count" className="text-gray-500">
          {systemPrompt.length.toLocaleString()} / {SYSTEM_PROMPT_MAX_CHARS.toLocaleString()}
        </span>
        <button
          type="submit"
          disabled={saving || systemPrompt.length > SYSTEM_PROMPT_MAX_CHARS}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {message && (
        <p className="text-sm text-gray-600" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
