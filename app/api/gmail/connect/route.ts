import { NextResponse } from "next/server";
import { authUrl, gmailConfigured } from "@/lib/gmail";
import { siteOrigin } from "@/lib/origin";

// Team only (middleware). Sends the browser to Google to approve send-only Gmail access, remembering
// which campaign page to come back to.
export async function GET(req: Request) {
  if (!gmailConfigured()) {
    return NextResponse.json({ error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the hub first." }, { status: 400 });
  }
  const back = new URL(req.url).searchParams.get("back") ?? "";
  const res = NextResponse.redirect(authUrl(await siteOrigin()));
  if (/^\/campaigns(\/rec[A-Za-z0-9]{14})?$/.test(back)) {
    res.cookies.set("fb_gmail_back", back, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 900, path: "/api/gmail" });
  }
  return res;
}
