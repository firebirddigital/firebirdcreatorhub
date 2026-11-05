import type { CampaignStatus } from "@/lib/types";

/** The kit's pill. Live is the one that gets the brand red; Canceled is struck through. */
export function StatusTag({ status, inverse = false }: { status: CampaignStatus; inverse?: boolean }) {
  const live = status === "Live";
  return (
    <span
      className={`pill ${live ? "border-fb-red bg-fb-red text-white" : inverse ? "border-white/60 text-white" : "text-secondary"}`}
    >
      {live && <span aria-hidden className="dot bg-white" />}
      <span className={status === "Canceled" ? "line-through" : undefined}>{status}</span>
    </span>
  );
}
