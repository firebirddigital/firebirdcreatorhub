import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCampaigns } from "@/lib/data";
import { cleanFolderName, deleteFolder, isFolderId, updateFolder } from "@/lib/folders";

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Team only (middleware). Rename a folder, or add and remove campaigns.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isFolderId(id)) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; add?: unknown; remove?: unknown };
  const name = "name" in body ? cleanFolderName(body.name) : undefined;
  if (name === "") return NextResponse.json({ error: "Give the folder a name." }, { status: 400 });
  const known = new Set((await getCampaigns()).map((c) => c.id));
  const folder = await updateFolder(id, { name, add: ids(body.add).filter((c) => known.has(c)), remove: ids(body.remove) });
  if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  revalidatePath("/campaigns", "layout");
  return NextResponse.json({ ok: true, folder });
}

// Delete a folder. The campaigns in it are not touched.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isFolderId(id) || !(await deleteFolder(id))) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  revalidatePath("/campaigns", "layout");
  return NextResponse.json({ ok: true });
}
