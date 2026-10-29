// Sending email through a team member's Gmail (Google Workspace) with Gmail's API. Server-side only.
// The hub asks Google for send-only access (it can't read, search or delete mail). The refresh token
// Google returns is encrypted with AUTH_SECRET and kept in the private Blob store, never in Airtable.
//   GOOGLE_CLIENT_ID      OAuth client from Google Cloud (Web application)
//   GOOGLE_CLIENT_SECRET  Its secret
//   GMAIL_FROM_NAME       Optional display name, e.g. "Firebird" (defaults to "Firebird")
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import { privateBlobToken } from "./blob";

const PATH = "email/gmail-connection.json";
const SCOPES = ["https://www.googleapis.com/auth/gmail.send", "openid", "email"];

export const gmailConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && privateBlobToken());

const secret = () => process.env.AUTH_SECRET || "dev-only-secret-change-me";
const key = () => createHash("sha256").update(`gmail-token:${secret()}`).digest();

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ---------- Connecting ----------

/** Signed "state" so Google's redirect back can only complete a connection this hub started. */
function state(): string {
  const nonce = randomBytes(12).toString("base64url");
  const issued = Date.now().toString(36);
  const sig = createHmac("sha256", secret()).update(`gmail-state:${nonce}.${issued}`).digest("base64url").slice(0, 32);
  return `${nonce}.${issued}.${sig}`;
}

export function validState(value: string | null): boolean {
  const [nonce, issued, sig] = (value ?? "").split(".");
  if (!nonce || !issued || !sig) return false;
  if (Date.now() - parseInt(issued, 36) > 15 * 60_000) return false;
  const expected = createHmac("sha256", secret()).update(`gmail-state:${nonce}.${issued}`).digest("base64url").slice(0, 32);
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export const redirectUri = (origin: string) => `${origin}/api/gmail/callback`;

export function authUrl(origin: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: state(),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

interface Connection {
  email: string;
  refreshToken: string; // encrypted
  connectedAt: string;
}

/** Swaps Google's one-time code for a refresh token and saves it (encrypted). Returns the Gmail address. */
export async function finishConnect(origin: string, code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { refresh_token?: string; id_token?: string; scope?: string; error_description?: string };
  if (!res.ok) throw new Error(data.error_description ?? "Google didn't accept the sign-in. Try again.");
  if (!data.scope?.includes("gmail.send")) throw new Error("Tick the box that lets the hub send email, then try again.");
  if (!data.refresh_token) throw new Error("Google didn't return a long-lived sign-in. Disconnect the hub in your Google account and try again.");
  // The ID token comes straight from Google over TLS, so reading the email claim is enough here.
  const claims = JSON.parse(Buffer.from((data.id_token ?? "").split(".")[1] ?? "", "base64url").toString() || "{}") as { email?: string };
  if (!claims.email) throw new Error("Couldn't tell which Gmail account this is. Try again.");

  const connection: Connection = { email: claims.email, refreshToken: encrypt(data.refresh_token), connectedAt: new Date().toISOString() };
  await put(PATH, JSON.stringify(connection), {
    access: "private",
    token: privateBlobToken(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return claims.email;
}

async function connection(): Promise<Connection | undefined> {
  const token = privateBlobToken();
  if (!token || !process.env.GOOGLE_CLIENT_ID) return undefined;
  try {
    const res = await get(PATH, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200) return undefined;
    return JSON.parse(await new Response(res.stream).text()) as Connection;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return undefined;
    throw e;
  }
}

/** The connected Gmail address, if any. */
export async function gmailSender(): Promise<{ email: string; connectedAt: string } | undefined> {
  const c = await connection();
  return c && { email: c.email, connectedAt: c.connectedAt };
}

/** Forgets the connection and asks Google to revoke it. */
export async function disconnectGmail() {
  const c = await connection();
  if (c) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(c.refreshToken))}`, { method: "POST" });
    } catch {
      // Still forget it locally; it can also be removed at myaccount.google.com/permissions.
    }
  }
  try {
    await del(PATH, { token: privateBlobToken() });
  } catch (e) {
    if (!(e instanceof BlobNotFoundError)) throw e;
  }
}

// ---------- Sending ----------

async function accessToken(c: Connection): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(c.refreshToken),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error === "invalid_grant"
        ? "The Gmail connection has expired or was removed. Connect Gmail again."
        : "Couldn't sign in to Gmail. Try again.",
    );
  }
  return data.access_token;
}

/** Encodes a header value that may contain non-ASCII (names, curly quotes). */
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);
const b64Lines = (s: string) => Buffer.from(s).toString("base64").replace(/.{76}/g, "$&\r\n");

/** Sends one email from the connected Gmail. Returns an error message, or undefined when it went. */
export async function sendViaGmail(to: string, subject: string, html: string, text: string): Promise<string | undefined> {
  const c = await connection();
  if (!c) return "Gmail isn't connected.";
  try {
    const boundary = `fb-${randomBytes(9).toString("hex")}`;
    const fromName = process.env.GMAIL_FROM_NAME || "Firebird";
    const mime = [
      `From: ${header(fromName)} <${c.email}>`,
      `To: ${to}`,
      `Subject: ${header(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64Lines(text),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64Lines(html),
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(c)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
      cache: "no-store",
    });
    if (!res.ok) return `Gmail didn't send it (${res.status}): ${(await res.text()).slice(0, 200)}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
