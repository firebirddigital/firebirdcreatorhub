import { compact, shortDate } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";

const W = 1000;
const H = 280;

export function ViewsChart({ series }: { series: SeriesPoint[] }) {
  if (series.length < 2) {
    return (
      <div className="h-[280px] border-2 border-dashed border-fb-black/30 flex items-center justify-center p-6 text-center">
        <p className="max-w-xs text-sm">
          The views chart fills in after the stats have refreshed on at least two different days.
        </p>
      </div>
    );
  }

  const max = Math.max(...series.map((p) => p.views)) * 1.08 || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.views).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
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
          aria-label={`Total views grew to ${compact(last.views)} by ${shortDate(last.date)}`}
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
        <span>{shortDate(mid.date)}</span>
        <span>{shortDate(last.date)}</span>
      </figcaption>
    </figure>
  );
}
