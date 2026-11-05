"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function patchFolder(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/folders/${id}`, {
    method: body.delete ? "DELETE" : "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body.delete ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save. Try again.");
}

/** Rename or delete a folder. Team only. */
export function FolderHeaderControls({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(body: Record<string, unknown>, after: () => void) {
    setBusy(true);
    setError(undefined);
    try {
      await patchFolder(id, body);
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "rename") {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run({ name: value }, () => {
            setMode("idle");
            router.refresh();
          });
        }}
      >
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} aria-label="Folder name" className="field min-w-56" />
        <button type="submit" disabled={busy || !value.trim()} className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" onClick={() => setMode("idle")} className="btn btn-quiet btn-sm">
          Cancel
        </button>
        {error && <p className="basis-full text-sm font-bold text-fb-red">{error}</p>}
      </form>
    );
  }
  if (mode === "delete") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Delete this folder? The campaigns in it stay as they are.</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ delete: true }, () => router.push("/campaigns?type=folders"))}
          className="btn btn-primary btn-sm"
        >
          Delete folder
        </button>
        <button type="button" onClick={() => setMode("idle")} className="btn btn-quiet btn-sm">
          Cancel
        </button>
        {error && <p className="basis-full text-sm font-bold text-fb-red">{error}</p>}
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setMode("rename")} className="btn">
        Rename
      </button>
      <button type="button" onClick={() => setMode("delete")} className="btn btn-quiet">
        Delete folder
      </button>
    </>
  );
}

/** Pick a campaign (either type) to add to the folder. */
export function AddToFolder({ id, options }: { id: string; options: { id: string; label: string; group: string }[] }) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <form
      className="filter-row is-collapsed"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pick) return;
        setBusy(true);
        setError(undefined);
        try {
          await patchFolder(id, { add: [pick] });
          setPick("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grow max-w-xl">
        Add a campaign
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="w-full">
          <option value="">{options.length ? "Choose a campaign…" : "Every campaign is already in this folder"}</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy || !pick} className="btn btn-primary">
        {busy ? "Adding…" : "Add to folder"}
      </button>
      {error && <p className="basis-full text-sm font-bold text-fb-red">{error}</p>}
    </form>
  );
}

/** Takes one campaign out of the folder (the campaign itself is untouched). */
export function RemoveFromFolder({ id, campaignId, name }: { id: string; campaignId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Take ${name} out of this folder`}
      title="Take out of this folder"
      onClick={async () => {
        setBusy(true);
        try {
          await patchFolder(id, { remove: [campaignId] });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="btn btn-quiet btn-sm"
    >
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}
