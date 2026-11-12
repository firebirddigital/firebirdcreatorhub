"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addToCampaign } from "../CreatorImport";
import { profileFromUrl } from "@/lib/social";

type Platform = "tiktok" | "instagram";

const isLink = (v: string) => /^https?:|^www\.|\.com\b|\//i.test(v);

/**
 * Splits pasted text into entries: one per line, comma, semicolon or tab. A line with spaces is split on them
 * only when every word is an @handle or a link, so "not a handle" is flagged instead of read as three handles.
 */
function entries(text: string): string[] {
  return text
    .split(/[\n,;\t]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .flatMap((t) => {
      const words = t.split(/\s+/);
      return words.length > 1 && words.every((w) => w.startsWith("@") || isLink(w)) ? words : [t];
    });
}

/** One pasted entry: a profile link (platform known) or a bare handle (platform from the picker). */
function parse(text: string, platform: Platform) {
  const seen = new Set<string>();
  const rows: { tiktok?: string; instagram?: string; links?: string[] }[] = [];
  const unreadable: string[] = [];
  for (const raw of entries(text)) {
    const v = raw.trim();
    if (!v) continue;
    const link = isLink(v) ? profileFromUrl(v) : undefined;
    const handle = link ? link.handle : /^@?[\w.]{1,30}$/.test(v) ? v.replace(/^@/, "").toLowerCase() : undefined;
    const p = link?.platform ?? platform;
    if (!handle) {
      unreadable.push(v);
      continue;
    }
    const key = `${p}:${handle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(p === "tiktok" ? { tiktok: handle } : { instagram: handle });
  }
  return { rows, unreadable };
}

/**
 * Paste a list of handles or profile links to add them all to a campaign at once. Anyone new goes into the
 * Creators database (named after their handle until stats come in); anyone already there is matched by handle.
 */
export function PasteHandles({ campaignId, status, sample }: { campaignId: string; status: "Reached Out" | "Proposed"; sample: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const { rows, unreadable } = useMemo(() => parse(text, platform), [text, platform]);
  const bare = useMemo(() => entries(text).filter((v) => !isLink(v)).length, [text]);

  async function add() {
    setBusy(true);
    setMessage(undefined);
    try {
      const ids: string[] = [];
      let created = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const res = await fetch("/api/creators/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rows.slice(i, i + 200), dryRun: false, firstRow: i + 1 }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; results?: { id?: string; action: string }[] };
        if (!res.ok || !data.results) throw new Error(data.error ?? "Couldn't save those creators. Try again.");
        data.results.forEach((r) => {
          if (r.id) ids.push(r.id);
          if (r.action === "create") created++;
        });
      }
      const added = await addToCampaign(campaignId, ids, status);
      const already = new Set(ids).size - added;
      setText("");
      setMessage({
        text: `Added ${added} to this campaign as ${status}${created ? ` (${created} new to the Creators database)` : ""}${
          already ? `; ${already} were already on it` : ""
        }. Their followers, median views and engagement are being pulled now; reload in a few minutes to see names and stats.`,
      });
      router.refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="field-label">Handles or profile links</span>
        <span className="mb-2 block text-xs text-muted">One per line, or separated by commas. Profile links tell us the platform on their own.</span>
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"@creatorone\n@creatortwo\nhttps://www.instagram.com/creatorthree"}
          disabled={sample}
          className="field font-mono text-sm"
        />
      </label>
      {bare > 0 && (
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">Platform for plain handles</legend>
          <span className="text-xs font-bold">Plain handles are on</span>
          <div className="seg">
            {(["tiktok", "instagram"] as Platform[]).map((p) => (
              <button key={p} type="button" onClick={() => setPlatform(p)} aria-pressed={platform === p}>
                {p === "tiktok" ? "TikTok" : "Instagram"}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {unreadable.length > 0 && (
        <p className="text-xs font-bold text-fb-red">
          Can&apos;t read {unreadable.slice(0, 5).map((u) => `“${u.slice(0, 40)}”`).join(", ")}
          {unreadable.length > 5 ? ` and ${unreadable.length - 5} more` : ""}. Use a handle or a TikTok or Instagram profile link.
        </p>
      )}
      <button type="button" onClick={add} disabled={sample || busy || !rows.length} className="btn btn-primary">
        {busy ? "Adding" : rows.length ? `Add ${rows.length} ${rows.length === 1 ? "creator" : "creators"}` : "Add creators"}
      </button>
      {message && (
        <p role="status" className={`text-sm ${message.error ? "font-bold text-fb-red" : ""}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
