import { compact, shortDate } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";
import { LineChart, type Series } from "./nest/charts/LineChart";

const H = 280;
const DAY = 86_400_000;
const isDay = (d: string) => d.length === 10;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const dayAfter = (d: string) => new Date(dayMs(d) + DAY).toISOString().slice(0, 10);

/** Same-day refreshes carry a time; show it in Nashville time so the server and the team agree. */
function pointLabel(date: string): string {
  if (date.length === 10) return shortDate(date);
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });
}

export function ViewsChart({ series }: { series: SeriesPoint[] }) {
  if (series.length < 2) {
    return <p className="empty">The views chart fills in after the first stats refresh.</p>;
  }

  // The kit's line chart works in whole days. While a campaign has only one day of refreshes each
  // point carries a time, so that stretch uses the hand-drawn chart below instead.
  if (!series.every((p) => isDay(p.date))) return <IntradayChart series={series} />;

  /*
   * The zero starting point isn't a measured refresh, so the stretch up to the first real one is
   * dashed. The kit dashes a line across a day with no reading, so a blank day goes in between the
   * two when there is one to use.
   */
  const estimated = Boolean(series[0].estimated);
  const gapDay = estimated && dayMs(series[1].date) - dayMs(series[0].date) > DAY ? dayAfter(series[0].date) : undefined;
  const points: Series["points"] = series.map((p) => ({ date: p.date, value: p.views }));
  if (gapDay) points.splice(1, 0, { date: gapDay, value: null });
  const bridgeDays = gapDay ? Math.ceil((dayMs(series[1].date) - dayMs(series[0].date)) / DAY) + 1 : false;

  return (
    <figure>
      <LineChart
        height={H}
        series={[{ key: "views", label: "Views", color: "var(--series-1)", points }]}
        bridgeGaps={bridgeDays}
      />
      {gapDay && (
        <figcaption className="mt-2 text-xs text-muted">
          Dashed: from 0 views on the first post date to the first stats refresh.
        </figcaption>
      )}
    </figure>
  );
}

/** One day of refreshes, each to the minute: a plain line in the kit's colours. */
function IntradayChart({ series }: { series: SeriesPoint[] }) {
  const W = 1000;
  const max = Math.max(...series.map((p) => p.views)) * 1.08 || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const pt = (i: number) => `${x(i).toFixed(1)},${y(series[i].views).toFixed(1)}`;
  const start = series[0].estimated ? 1 : 0;
  const line = series.slice(start).map((_, i) => `${i ? "L" : "M"}${pt(i + start)}`).join(" ");
  const lead = start ? `M${pt(0)} L${pt(1)}` : "";
  const sameDay = series.every((p) => p.date.slice(0, 10) === series[0].date.slice(0, 10));
  const gridValues = [0.25, 0.5, 0.75, 1].map((f) => max * f);
  const last = series[series.length - 1];
  const mid = series[Math.floor(series.length / 2)];

  return (
    <figure>
      <div className="relative h-[280px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`Total views grew to ${compact(last.views)} by ${shortDate(last.date)}${sameDay && last.date.length > 10 ? `, ${pointLabel(last.date)}` : ""}`}
        >
          {gridValues.map((v) => (
            <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--grid)" vectorEffect="non-scaling-stroke" />
          ))}
          {lead && (
            <path
              d={lead}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeDasharray="4 5"
              strokeOpacity={0.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={line}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--axis)" vectorEffect="non-scaling-stroke" />
        </svg>
        {gridValues.map((v) => (
          <span
            key={v}
            className="absolute left-0 -translate-y-full pb-1 text-[10px] tabular-nums text-muted"
            style={{ top: `${(y(v) / H) * 100}%` }}
          >
            {compact(v)}
          </span>
        ))}
        <span
          className="absolute right-0 size-2.5 rounded-full bg-fb-red ring-2 ring-[color:var(--surface-1)] translate-x-1/2 -translate-y-1/2"
          style={{ top: `${(y(last.views) / H) * 100}%` }}
          aria-hidden
        />
      </div>
      <figcaption className="mt-2 flex justify-between text-[10px] tabular-nums text-muted">
        <span>{shortDate(series[0].date)}</span>
        {series.length > 2 && <span>{sameDay ? pointLabel(mid.date) : shortDate(mid.date)}</span>}
        <span>{sameDay ? pointLabel(last.date) : shortDate(last.date)}</span>
      </figcaption>
      {start > 0 && (
        <p className="mt-2 text-xs text-muted">Dashed: from 0 views on the first post date to the first stats refresh.</p>
      )}
    </figure>
  );
}
