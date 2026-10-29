import { compact, shortDate } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";

const W = 1000;
const H = 280;

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
    return (
      <div className="h-[280px] border-2 border-dashed border-fb-black/30 flex items-center justify-center p-6 text-center">
        <p className="max-w-xs text-sm">
          The views chart fills in after the first stats refresh.
        </p>
      </div>
    );
  }

  const max = Math.max(...series.map((p) => p.views)) * 1.08 || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const pt = (i: number) => `${x(i).toFixed(1)},${y(series[i].views).toFixed(1)}`;
  // The zero starting point isn't a measured refresh, so the stretch up to the first real one is dashed.
  const start = series[0].estimated ? 1 : 0;
  const line = series.slice(start).map((_, i) => `${i ? "L" : "M"}${pt(i + start)}`).join(" ");
  const lead = start ? `M${pt(0)} L${pt(1)}` : "";
  const area = `M${pt(0)} ${series.slice(1).map((_, i) => `L${pt(i + 1)}`).join(" ")} L${W},${H} L0,${H} Z`;
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
            <line
              key={v}
              x1={0}
              x2={W}
              y1={y(v)}
              y2={y(v)}
              stroke="#000005"
              strokeOpacity={0.12}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="#ED2124" fillOpacity={0.1} />
          {lead && (
            <path
              d={lead}
              fill="none"
              stroke="#ED2124"
              strokeWidth={3}
              strokeDasharray="6 6"
              strokeOpacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={line}
            fill="none"
            stroke="#ED2124"
            strokeWidth={3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <line x1={0} x2={W} y1={H} y2={H} stroke="#000005" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {gridValues.map((v) => (
          <span
            key={v}
            className="absolute left-0 -translate-y-full pb-1 text-xs tabular-nums"
            style={{ top: `${(y(v) / H) * 100}%` }}
          >
            {compact(v)}
          </span>
        ))}
        <span
          className="absolute right-0 size-3 rounded-full bg-fb-red ring-4 ring-fb-white translate-x-1/2 -translate-y-1/2"
          style={{ top: `${(y(last.views) / H) * 100}%` }}
          aria-hidden
        />
      </div>
      <figcaption className="mt-3 flex justify-between text-xs tabular-nums">
        <span>{shortDate(series[0].date)}</span>
        {series.length > 2 && <span>{sameDay ? pointLabel(mid.date) : shortDate(mid.date)}</span>}
        <span>{sameDay ? pointLabel(last.date) : shortDate(last.date)}</span>
      </figcaption>
      {start > 0 && (
        <p className="mt-2 text-xs text-fb-black/70">
          Dashed: from 0 views on the first post date to the first stats refresh.
        </p>
      )}
    </figure>
  );
}
