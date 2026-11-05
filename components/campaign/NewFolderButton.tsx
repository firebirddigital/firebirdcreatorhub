"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** "New folder" on the Folders tab. Opens the new folder once it's made. */
export function NewFolderButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; folder?: { id: string } };
    setBusy(false);
    if (!res.ok || !data.folder) {
      setError(data.error ?? "That didn't save. Try again.");
      return;
    }
    router.push(`/campaigns/folders/${data.folder.id}`);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        New folder
      </button>
    );
  }
  return (
    <form onSubmit={create} className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name, e.g. Q4 country push"
        aria-label="Folder name"
        maxLength={80}
        className="field min-w-64"
      />
      <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">
        {busy ? "Creating…" : "Create folder"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
        Cancel
      </button>
      {error && <p className="basis-full text-sm font-bold text-fb-red">{error}</p>}
    </form>
  );
}
