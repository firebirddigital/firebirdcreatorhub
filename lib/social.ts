import type { Platform } from "./types";

export function detectPlatform(url: string): Platform | undefined {
  const u = url.toLowerCase();
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  return undefined;
}

/** Instagram shortcode, e.g. instagram.com/reel/DdotQALCHZz → "DdotQALCHZz" */
export function instagramCode(url: string): string | undefined {
  return url.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)?.[1];
}

/** TikTok video ID, e.g. tiktok.com/@name/video/7351234567890 → "7351234567890" */
export function tiktokId(url: string): string | undefined {
  return url.match(/\/(?:video|photo)\/(\d+)/)?.[1];
}

/** A stable key used to match scraper results back to posts. */
export function postKey(url: string): string {
  const platform = detectPlatform(url);
  const id = platform === "instagram" ? instagramCode(url) : platform === "tiktok" ? tiktokId(url) : undefined;
  return id ? `${platform}:${id}` : `url:${normalizeUrl(url)}`;
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** iframe embed URL; works without any API token. */
export function embedUrl(url: string): string | undefined {
  const platform = detectPlatform(url);
  if (platform === "instagram") {
    const code = instagramCode(url);
    return code ? `https://www.instagram.com/p/${code}/embed` : undefined;
  }
  if (platform === "tiktok") {
    const id = tiktokId(url);
    return id ? `https://www.tiktok.com/embed/v2/${id}` : undefined;
  }
  return undefined;
}

const IG_NOT_PROFILES = new Set(["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about"]);

/**
 * Platform and handle from a profile link (or a TikTok video link, which includes the handle).
 * instagram.com/name/ → instagram:name, tiktok.com/@name → tiktok:name. Instagram post links
 * don't include the handle, so they return undefined.
 */
export function profileFromUrl(raw: string): { platform: Platform; handle: string } | undefined {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  const first = url.pathname.split("/").filter(Boolean)[0];
  if (host.endsWith("tiktok.com")) {
    const handle = first?.startsWith("@") ? first.slice(1) : undefined;
    return handle && /^[\w.]{2,24}$/.test(handle) ? { platform: "tiktok", handle: handle.toLowerCase() } : undefined;
  }
  if (host.endsWith("instagram.com")) {
    return first && !IG_NOT_PROFILES.has(first.toLowerCase()) && /^[\w.]{1,30}$/.test(first)
      ? { platform: "instagram", handle: first.toLowerCase() }
      : undefined;
  }
  return undefined;
}

export function handleFromUrl(url: string): string | undefined {
  return url.match(/tiktok\.com\/@([\w.]+)/i)?.[1];
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};
