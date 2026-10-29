"use client";

import { upload } from "@vercel/blob/client";
import { checkDraftLink, draftSource, LINK_SERVICES } from "@/lib/draft-links";

export const MAX_MB = 500;

export type DraftChoice = { mode: "link" | "file"; link: string; file: File | null };

export const emptyChoice = (): DraftChoice => ({ mode: "link", link: "", file: null });

export function choiceReady(c: DraftChoice) {
  return c.mode === "link" ? Boolean(c.link.trim()) : Boolean(c.file);
}

/** Turns the choice into a saved video URL: checks the link, or uploads the file to Blob. */
export async function resolveDraft(
  c: DraftChoice,
  opts: { path: string; handleUploadUrl: string; onProgress: (pct: number) => void },
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
  const ext = c.file.name.split(".").pop()?.toLowerCase() || "mp4";
  const blob = await upload(`${opts.path}.${ext}`, c.file, {
    access: "private",
    handleUploadUrl: opts.handleUploadUrl,
    onUploadProgress: ({ percentage }) => opts.onProgress(Math.round(percentage)),
  });
  return blob.url;
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
      <div role="tablist" aria-label="How to send the draft" className="flex gap-6 text-sm">
        {(["link", "file"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={value.mode === m}
            disabled={disabled}
            onClick={() => onChange({ ...value, mode: m })}
            className={`pb-1 font-bold border-b-2 ${
              value.mode === m ? "border-fb-red text-fb-black" : "border-transparent text-fb-black/60 hover:text-fb-black"
            } disabled:opacity-50`}
          >
            {m === "link" ? "Paste a link" : "Upload a file"}
          </button>
        ))}
      </div>

      {value.mode === "link" ? (
        <label className="mt-4 block">
          <span className="text-sm font-bold">Link to the video</span>
          <span className="block text-xs">
            {LINK_SERVICES}. Set sharing to “Anyone with the link”{audience === "creator" ? " and don't change the file after you send it" : ""}.
          </span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={value.link}
            onChange={(e) => onChange({ ...value, link: e.target.value })}
            disabled={disabled}
            className="mt-2 w-full border-b-2 border-fb-black bg-transparent py-2.5 outline-none focus:border-fb-red disabled:opacity-50"
          />
          {checked && !checked.ok && <span className="mt-2 block text-xs text-fb-red font-bold">{checked.error}</span>}
          {source && (
            <span className="mt-2 block text-xs">
              {source.label} link.{" "}
              {source.player.kind === "link"
                ? "Reviewers will open it in a new tab."
                : "It will play right on the review page if sharing is open."}
            </span>
          )}
        </label>
      ) : (
        <label className="mt-4 block">
          <span className="text-sm font-bold">Video file</span>
          <span className="block text-xs">MP4 or MOV, up to {MAX_MB}MB. Vertical 9:16 works best.</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v"
            disabled={disabled}
            onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
            className="mt-3 block w-full text-sm file:mr-4 file:border-2 file:border-fb-black file:bg-fb-white file:px-4 file:py-2 file:font-bold hover:file:bg-fb-black hover:file:text-fb-white disabled:opacity-50"
          />
          {value.file && <span className="mt-2 block text-xs">Selected: {value.file.name}</span>}
        </label>
      )}
    </div>
  );
}

export function UploadProgress({ progress }: { progress?: number }) {
  if (progress === undefined) return null;
  return (
    <div aria-live="polite">
      <div className="h-2 bg-fb-black/10">
        <div className="h-full bg-fb-red transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-sm">Uploading {progress}%. Keep this page open.</p>
    </div>
  );
}
