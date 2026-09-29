"use client";

// The one Try again action: under a failed reply, and under a conversation's
// last message when it never got an answer.
export function TryAgainButton({
  onClick,
  disabled = false,
  label = "Try again",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-white px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
    >
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
        <path d="M3 3v4h4" />
      </svg>
      {label}
    </button>
  );
}
