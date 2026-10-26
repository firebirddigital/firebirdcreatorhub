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

export function handleFromUrl(url: string): string | undefined {
  return url.match(/tiktok\.com\/@([\w.]+)/i)?.[1];
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};
