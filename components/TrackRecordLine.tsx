import { compact, times } from "@/lib/format";
import type { TrackRecord } from "@/lib/types";

/** "2 campaigns · 48K views · 1.3× usual". Team only: it draws on other clients' campaigns. */
export function trackRecordText(r?: TrackRecord): string | undefined {
  if (!r) return undefined;
  const vs = r.benchmark && times(r.benchmark.views, r.benchmark.expected);
  return [
    `${r.campaigns} ${r.campaigns === 1 ? "campaign" : "campaigns"}`,
    `${compact(r.views)} views`,
    vs ? `${vs} usual` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export const trackRecordRatio = (r?: TrackRecord) => (r?.benchmark?.expected ? r.benchmark.views / r.benchmark.expected : -1);
