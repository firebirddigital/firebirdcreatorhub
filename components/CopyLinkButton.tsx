"use client";

import { useState } from "react";

export function CopyLinkButton({ url, label = "Copy share link", className = "" }: { url: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={className || "text-xs underline underline-offset-4 hover:text-fb-red"}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
