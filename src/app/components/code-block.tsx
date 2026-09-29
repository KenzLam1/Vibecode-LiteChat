"use client";

import type { Element, ElementContent } from "hast";
import { useEffect, useState, type ReactNode } from "react";

// A fenced code block from a reply: highlighted code with its language and a
// Copy button. The copied text comes from the markdown tree, not the DOM, so it
// is the code exactly as the model wrote it.
export function CodeBlock({
  node,
  children,
}: {
  node?: Element;
  children: ReactNode;
}) {
  const { code, language } = readCodeBlock(node);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = setTimeout(() => setCopyState("idle"), 1500);
    return () => clearTimeout(timeout);
  }, [copyState]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language ?? "code"}</span>
        <button type="button" onClick={copy} className="code-block-copy">
          {copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Copy failed"
              : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function readCodeBlock(pre: Element | undefined): {
  code: string;
  language: string | undefined;
} {
  const codeElement = pre?.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "code",
  );
  if (!codeElement) return { code: pre ? textOf(pre) : "", language: undefined };

  const classNames = codeElement.properties.className;
  const languageClass = Array.isArray(classNames)
    ? classNames.find(
        (name): name is string =>
          typeof name === "string" && name.startsWith("language-"),
      )
    : undefined;

  return {
    // Markdown always ends a fenced block's text with one newline.
    code: textOf(codeElement).replace(/\n$/, ""),
    language: languageClass?.slice("language-".length),
  };
}

function textOf(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}
