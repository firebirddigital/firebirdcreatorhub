// Links to the Analytics page with filters. Safe for client code.
export type Period = "all" | "year" | "90d";

export function analyticsHref(f: { period?: Period; artist?: string; partner?: string }) {
  const q = new URLSearchParams();
  if (f.period && f.period !== "all") q.set("period", f.period);
  if (f.artist) q.set("artist", f.artist);
  if (f.partner) q.set("partner", f.partner);
  const s = q.toString();
  return s ? `/analytics?${s}` : "/analytics";
}
