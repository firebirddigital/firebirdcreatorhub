import { NextResponse } from "next/server";
import { setPartnerRemoved } from "@/lib/removed-partners";

// Team only (middleware). Removes a partner from Analytics, or restores it.
export async function POST(req: Request) {
  const { name, removed } = (await req.json().catch(() => ({}))) as { name?: unknown; removed?: unknown };
  if (typeof name !== "string" || !name.trim() || name.length > 200 || typeof removed !== "boolean") {
    return NextResponse.json({ error: "Say which partner, and whether to remove or restore it." }, { status: 400 });
  }
  try {
    const names = await setPartnerRemoved(name.trim(), removed);
    return NextResponse.json({ ok: true, removed: names });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
