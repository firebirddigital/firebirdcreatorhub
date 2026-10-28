import { NextResponse } from "next/server";
import { finishConnect, validState } from "@/lib/gmail";
import { siteOrigin } from "@/lib/origin";

// Team only (middleware). Google sends the browser back here after approval.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = await siteOrigin();
  const page = req.headers.get("cookie")?.match(/(?:^|;\s*)fb_gmail_back=([^;]+)/)?.[1];
  const path = page && /^\/campaigns(\/rec[A-Za-z0-9]{14})?$/.test(decodeURIComponent(page)) ? decodeURIComponent(page) : "/campaigns";
  const back = (q: string) => {
    const res = NextResponse.redirect(`${origin}${path}?gmail=${q}`);
    res.cookies.delete({ name: "fb_gmail_back", path: "/api/gmail" });
    return res;
  };
  if (url.searchParams.get("error")) return back("cancelled");
  if (!validState(url.searchParams.get("state"))) return back("expired");
  const code = url.searchParams.get("code");
  if (!code) return back("cancelled");
  try {
    await finishConnect(origin, code);
    return back("connected");
  } catch (e) {
    console.error("Gmail connect failed:", e);
    return back("failed");
  }
}
