// Draft videos can be a file in our Blob store or a link to wherever the creator keeps it.
// Safe to import from client components: no secrets, no server calls.

export type DraftPlayer =
  | { kind: "video"; src: string } // plays in a <video> tag
  | { kind: "iframe"; src: string } // the service's own player
  | { kind: "link" }; // can't play on the page; show an Open button

export interface DraftSource {
  /** Where the draft lives, for labels like "Open on Google Drive". */
  label: string;
  player: DraftPlayer;
  /** True when the file sits in Firebird's own Blob store. */
  hosted: boolean;
}

const SERVICES: { test: RegExp; label: string }[] = [
  { test: /(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/, label: "Google Drive" },
  { test: /(^|\.)dropbox\.com$|(^|\.)dropboxusercontent\.com$/, label: "Dropbox" },
  { test: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, label: "YouTube" },
  { test: /(^|\.)vimeo\.com$/, label: "Vimeo" },
  { test: /(^|\.)icloud\.com$/, label: "iCloud" },
  { test: /(^|\.)wetransfer\.com$|(^|\.)we\.tl$/, label: "WeTransfer" },
  { test: /(^|\.)box\.com$/, label: "Box" },
  { test: /(^|\.)frame\.io$|(^|\.)f\.io$/, label: "Frame.io" },
  { test: /(^|\.)onedrive\.live\.com$|(^|\.)1drv\.ms$|(^|\.)sharepoint\.com$/, label: "OneDrive" },
  { test: /(^|\.)tiktok\.com$/, label: "TikTok" },
  { test: /(^|\.)instagram\.com$/, label: "Instagram" },
];

export const LINK_SERVICES = "Google Drive, Dropbox, YouTube (unlisted), Vimeo, iCloud, WeTransfer or Frame.io";

export function isBlobUrl(url: URL) {
  return url.hostname.endsWith(".blob.vercel-storage.com");
}

/** A creator- or team-supplied link we're willing to save: https, and not a page on this site. */
export function checkDraftLink(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "That doesn't look like a link. Copy the full share link and paste it here." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Use the https:// share link." };
  if (isBlobUrl(url)) return { ok: false, error: "Upload the file with the file option instead." };
  return { ok: true, url: url.toString() };
}

export function draftSource(raw: string): DraftSource {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { label: "the link", player: { kind: "link" }, hosted: false };
  }
  const host = url.hostname.toLowerCase();
  if (isBlobUrl(url)) return { label: "Firebird", player: { kind: "video", src: raw }, hosted: true };

  const label = SERVICES.find((s) => s.test.test(host))?.label ?? host.replace(/^www\./, "");

  // YouTube: watch?v=, youtu.be/, /shorts/, /embed/
  if (label === "YouTube") {
    const id =
      url.searchParams.get("v") ??
      (host.endsWith("youtu.be") ? url.pathname.slice(1) : url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1]);
    if (id) return { label, player: { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` }, hosted: false };
  }

  // Vimeo, including unlisted links with a privacy hash: vimeo.com/123456/abcdef
  if (label === "Vimeo") {
    const m = url.pathname.match(/\/(?:video\/)?(\d+)(?:\/([\da-f]+))?/);
    const hash = m?.[2] ?? url.searchParams.get("h");
    if (m) {
      return {
        label,
        player: { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}` },
        hosted: false,
      };
    }
  }

  // Google Drive file links play in Drive's preview player when shared as "Anyone with the link".
  if (label === "Google Drive") {
    const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
    if (id) return { label, player: { kind: "iframe", src: `https://drive.google.com/file/d/${id}/preview` }, hosted: false };
  }

  // Dropbox shared files stream directly with raw=1.
  if (label === "Dropbox" && /\/(s|scl\/fi)\//.test(url.pathname)) {
    const src = new URL(url);
    src.searchParams.delete("dl");
    src.searchParams.set("raw", "1");
    return { label, player: { kind: "video", src: src.toString() }, hosted: false };
  }

  return { label, player: { kind: "link" }, hosted: false };
}
