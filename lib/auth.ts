// Works in both the Edge (middleware) and Node runtimes: uses Web Crypto only.

export const SESSION_COOKIE = "fb_session";

const enc = new TextEncoder();

async function hmac(message: string): Promise<string> {
  const secret = process.env.AUTH_SECRET || "dev-only-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function authEnabled() {
  return Boolean(process.env.TEAM_PASSWORD);
}

/** Cookie value for a signed-in team member. Changes if the password or secret changes. */
export async function sessionToken(): Promise<string> {
  return hmac(`session:${process.env.TEAM_PASSWORD ?? ""}`);
}

export async function isValidSession(cookieValue?: string): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken());
}

/** Signature for a campaign's client share link: /share/<campaignId>/<sig> */
export async function shareSignature(campaignId: string): Promise<string> {
  return (await hmac(`share:${campaignId}`)).slice(0, 24);
}

export async function isValidShare(campaignId: string, sig: string): Promise<boolean> {
  return safeEqual(sig, await shareSignature(campaignId));
}

/** Signature for an artist's results link: /artist/<artistKey>/<sig>, where artistKey is the normalized name. */
export async function artistSignature(artistKey: string): Promise<string> {
  return (await hmac(`artist:${artistKey}`)).slice(0, 24);
}

export async function isValidArtistShare(artistKey: string, sig: string): Promise<boolean> {
  return safeEqual(sig, await artistSignature(artistKey));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signature for a creator's private draft-upload link: /submit/<assignmentId>/<sig> */
export async function submitSignature(assignmentId: string): Promise<string> {
  return (await hmac(`submit:${assignmentId}`)).slice(0, 24);
}

export async function isValidSubmit(assignmentId: string, sig: string): Promise<boolean> {
  return safeEqual(sig, await submitSignature(assignmentId));
}

/**
 * Signature for the shareable creators link: /roster/<sig>. Change ROSTER_LINK_VERSION (any new value)
 * to switch off every roster link already sent, without touching campaign links.
 */
export async function rosterSignature(opts: { rates?: boolean } = {}): Promise<string> {
  const kind = opts.rates ? "roster-rates" : "roster";
  return (await hmac(`${kind}:${process.env.ROSTER_LINK_VERSION ?? "1"}`)).slice(0, 24);
}

/** Which roster link this is: the standard one, the one that shows rates, or neither. */
export async function rosterLinkKind(sig: string): Promise<"standard" | "rates" | undefined> {
  if (safeEqual(sig, await rosterSignature())) return "standard";
  if (safeEqual(sig, await rosterSignature({ rates: true }))) return "rates";
  return undefined;
}
