import type { CampaignStatus } from "@/lib/types";

export function StatusTag({ status, inverse = false }: { status: CampaignStatus; inverse?: boolean }) {
  const live = status === "Live";
  const base = "inline-flex items-center gap-2 text-xs font-bold px-2.5 py-1";
  const style = live
    ? "bg-fb-red text-fb-white"
    : inverse
      ? "border border-fb-white text-fb-white"
      : "border border-fb-black text-fb-black";
  return (
    <span className={`${base} ${style}`}>
      {live && <span aria-hidden className="size-1.5 rounded-full bg-fb-white" />}
      {status}
    </span>
  );
}
