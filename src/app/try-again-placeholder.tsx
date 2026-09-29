// Placeholder until ticket 02's Try again button lands; swap it in at merge.
export function TryAgainPlaceholder({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded-lg border border-gray-300 px-3 py-1 text-sm"
    >
      Try again
    </button>
  );
}
