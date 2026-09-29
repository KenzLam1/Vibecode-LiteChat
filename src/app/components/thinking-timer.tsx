"use client";

import { useEffect, useState } from "react";

// "Thinking… (3.4s)", counting up from when it mounts. Mount it when a reply is
// requested and unmount it when the first answer token arrives.
export function ThinkingTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(
      () => setElapsedMs(performance.now() - start),
      100,
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      Thinking… ({(elapsedMs / 1000).toFixed(1)}s)
    </p>
  );
}
