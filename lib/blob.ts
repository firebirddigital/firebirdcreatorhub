// Private draft storage. Server-side only.
// Draft videos go to a private Blob store; pages that play them get short-lived signed links,
// so a forwarded or leaked file address stops working after a few hours.
import { issueSignedToken, presignUrl } from "@vercel/blob";

/** Read-write key for the private drafts store (separate from the older public store). */
export const privateBlobToken = () => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;

/** How long a signed viewing link works. Long enough to review a campaign in one sitting. */
const VIEW_HOURS = 6;

export function isPrivateBlobUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".blob.vercel-storage.com") && host.includes(".private.");
  } catch {
    return false;
  }
}

/** Swaps private draft file addresses for signed viewing links. Everything else is left as is. */
export async function signDraftUrls<T extends { videoUrl?: string }>(drafts: T[]): Promise<T[]> {
  const token = privateBlobToken();
  if (!token || !drafts.some((d) => isPrivateBlobUrl(d.videoUrl))) return drafts;
  try {
    const signed = await issueSignedToken({
      token,
      pathname: "*",
      operations: ["get"],
      validUntil: Date.now() + VIEW_HOURS * 60 * 60 * 1000,
    });
    return Promise.all(
      drafts.map(async (d) => {
        if (!isPrivateBlobUrl(d.videoUrl)) return d;
        const pathname = decodeURIComponent(new URL(d.videoUrl!).pathname.replace(/^\//, ""));
        const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname, access: "private" });
        return { ...d, videoUrl: presignedUrl };
      }),
    );
  } catch {
    // If signing fails the videos won't play, but the rest of the page still works.
    return drafts.map((d) => (isPrivateBlobUrl(d.videoUrl) ? { ...d, videoUrl: undefined } : d));
  }
}
