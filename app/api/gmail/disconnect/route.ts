import { NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/gmail";

// Team only (middleware). Stops the hub sending from Gmail and revokes its access.
export async function POST() {
  await disconnectGmail();
  return NextResponse.json({ ok: true });
}
