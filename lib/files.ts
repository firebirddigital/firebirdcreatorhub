// Draft video files: where they live and how pages get to play them. Server-side only.
// Files sit on the hub's disk under drafts/… and are served by /api/files/<key>. That route only answers
// to links signed with AUTH_SECRET that expire after a few hours, so a forwarded or leaked file address
// stops working, the same way the old private store behaved.
import { fileSignature } from "./auth";
import { FILES_PATH, hostedKey } from "./draft-links";

/** How long a signed viewing link works. Long enough to review a campaign in one sitting. */
const VIEW_HOURS = 6;

/** The saved address for a stored file, e.g. https://hub.example.com/api/files/drafts/rec1/v1-abc.mp4 */
export const fileUrl = (origin: string, key: string) => `${origin}${FILES_PATH}${key}`;

/** Swaps stored file addresses for signed viewing links. Everything else is left as is. */
export async function signDraftUrls<T extends { videoUrl?: string }>(drafts: T[]): Promise<T[]> {
  const exp = Date.now() + VIEW_HOURS * 60 * 60 * 1000;
  return Promise.all(
    drafts.map(async (d) => {
      const key = d.videoUrl ? hostedKey(d.videoUrl) : undefined;
      if (!key) return d;
      const sig = await fileSignature(key, exp);
      // Relative, so it works on whatever domain the page is being viewed on.
      return { ...d, videoUrl: `${FILES_PATH}${key}?exp=${exp}&sig=${sig}` };
    }),
  );
}
