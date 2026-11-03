"use client";

import { checkDraftLink, draftSource, LINK_SERVICES } from "@/lib/draft-links";

export const MAX_MB = 500;

export type DraftChoice = { mode: "link" | "file"; link: string; file: File | null };

export const emptyChoice = (): DraftChoice => ({ mode: "link", link: "", file: null });

export function choiceReady(c: DraftChoice) {
  return c.mode === "link" ? Boolean(c.link.trim()) : Boolean(c.file);
}

/** Each piece of a file upload. Small enough that no proxy limit or timeout gets in the way. */
const CHUNK_BYTES = 8 * 1024 * 1024;

async function api<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Upload interrupted. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Upload failed. Try again.");
  return data;
}

/** Sends the file to the hub in pieces (see lib/upload.ts) and returns its saved address. */
async function uploadFile(file: File, path: string, uploadUrl: string, onProgress: (pct: number) => void): Promise<string> {
  const { uploadId } = await api<{ uploadId: string }>(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", path, name: file.name, size: file.size, type: file.type }),
  });
  let sent = 0;
  while (sent < file.size) {
    const piece = file.slice(sent, Math.min(sent + CHUNK_BYTES, file.size));
    const { received } = await api<{ received: number }>(`${uploadUrl}?uploadId=${uploadId}&offset=${sent}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: piece,
    });
    sent = received;
    onProgress(Math.min(99, Math.round((sent / file.size) * 100)));
  }
  const { url } = await api<{ url: string }>(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "finish", uploadId }),
  });
  onProgress(100);
  return url;
}

/** Turns the choice into a saved video URL: checks the link, or uploads the file to the hub. */
export async function resolveDraft(
  c: DraftChoice,
  opts: { path: string; uploadUrl: string; onProgress: (pct: number) => void },
): Promise<string> {
  if (c.mode === "link") {
    const link = checkDraftLink(c.link);
    if (!link.ok) throw new Error(link.error);
    return link.url;
  }
  if (!c.file) throw new Error("Choose a video file.");
  if (c.file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`That file is over ${MAX_MB}MB. Paste a link instead, or export a smaller version.`);
  }
  return uploadFile(c.file, opts.path, opts.uploadUrl, opts.onProgress);
}

/** "Paste a link" (the default) or "Upload a file", with a hint about how the link will show up. */
export function DraftSourceInput({
  value,
  onChange,
  disabled,
  audience,
}: {
  value: DraftChoice;
  onChange: (c: DraftChoice) => void;
  disabled: boolean;
  audience: "creator" | "team";
}) {
  const link = value.link.trim();
  const checked = link ? checkDraftLink(link) : undefined;
  const source = checked?.ok ? draftSource(checked.url) : undefined;

  return (
    <div>
      <div role="tablist" aria-label="How to send the draft" className="tabs mt-0">
        {(["link", "file"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={value.mode === m}
            disabled={disabled}
            onClick={() => onChange({ ...value, mode: m })}
            className="disabled:cursor-not-allowed disabled:opacity-50"
          >
            {m === "link" ? "Paste a link" : "Upload a file"}
          </button>
        ))}
      </div>

      {value.mode === "link" ? (
        <label className="mt-4 block">
          <span className="field-label">Link to the video</span>
          <span className="-mt-0.5 mb-2 block text-xs text-muted">
            {LINK_SERVICES}. Set sharing to “Anyone with the link”{audience === "creator" ? " and don't change the file after you send it" : ""}.
          </span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={value.link}
            onChange={(e) => onChange({ ...value, link: e.target.value })}
            disabled={disabled}
            className="field"
          />
          {checked && !checked.ok && <span className="mt-2 block text-xs text-fb-red font-bold">{checked.error}</span>}
          {source && (
            <span className="mt-2 block text-xs text-muted">
              {source.label} link.{" "}
              {source.player.kind === "link"
                ? "Reviewers will open it in a new tab."
                : "It will play right on the review page if sharing is open."}
            </span>
          )}
        </label>
      ) : (
        <label className="mt-4 block">
          <span className="field-label">Video file</span>
          <span className="-mt-0.5 mb-2 block text-xs text-muted">MP4 or MOV, up to {MAX_MB}MB. Vertical 9:16 works best.</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v"
            disabled={disabled}
            onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
            className="block w-full cursor-pointer rounded-control border border-dashed border-line-strong bg-wash-neutral p-2 text-sm text-secondary file:mr-4 file:cursor-pointer file:rounded-control file:border file:border-solid file:border-line-strong file:bg-surface file:px-3.5 file:py-2 file:text-[13px] file:font-bold file:text-fb-black file:shadow-tile file:transition-colors hover:file:bg-wash-neutral focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fb-red disabled:cursor-not-allowed disabled:opacity-50"
          />
          {value.file && <span className="mt-2 block text-xs text-muted">Selected: {value.file.name}</span>}
        </label>
      )}
    </div>
  );
}

export function UploadProgress({ progress }: { progress?: number }) {
  if (progress === undefined) return null;
  return (
    <div aria-live="polite">
      <div className="h-2 overflow-hidden rounded-full bg-wash-neutral">
        <div className="h-full rounded-full bg-fb-red transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-secondary">Uploading {progress}%. Keep this page open.</p>
    </div>
  );
}
