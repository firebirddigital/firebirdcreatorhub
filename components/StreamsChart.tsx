import { compact, pct, shortDate } from "@/lib/format";
import type { StreamDay } from "@/lib/streams-lift";

const W = 1000;
const H = 220;

/**
 * Daily Spotify streams as a black line, with a red marker where the campaign started.
 * Shows the 7-day average before launch against the average since launch.
 */
export function StreamsChart({
  days,
  startDate,
  song,
  lift,
}: {
  days: StreamDay[];
  startDate?: string;
  song?: string;
  lift?: { before?: number; during?: number; change?: number };
}) {
  if (days.length < 2) {
    return <p className="text-sm">Upload at least two days of streams to see the chart.</p>;
  }
  const max = Math.max(...days.map((d) => d.streams)) * 1.08 || 1;
  const x = (i: number) => (i / (days.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const line = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.streams).toFixed(1)}`).join(" ");
  const startIndex = startDate ? days.findIndex((d) => d.date >= startDate) : -1;
  const grid = [0.5, 1].map((f) => max * f);

  return (
    <figure>
      {lift && (lift.before !== undefined || lift.during !== undefined) && (
        <dl className="mb-6 grid grid-cols-3 max-sm:grid-cols-1 border-t-2 border-fb-black">
          <div className="border-b border-fb-black py-3 pr-4">
            <dt className="text-sm">Avg daily streams, week before</dt>
            <dd className="figure mt-1 text-2xl">{lift.before !== undefined ? compact(lift.before) : "—"}</dd>
          </div>
          <div className="border-b border-fb-black py-3 pr-4">
            <dt className="text-sm">Avg daily streams, since launch</dt>
            <dd className="figure mt-1 text-2xl">{lift.during !== undefined ? compact(lift.during) : "—"}</dd>
          </div>
          <div className="border-b border-fb-black py-3 pr-4">
            <dt className="text-sm">Change</dt>
            <dd className={`figure mt-1 text-2xl ${lift.change && lift.change > 0 ? "text-fb-red" : ""}`}>
              {lift.change !== undefined ? `${lift.change > 0 ? "+" : ""}${pct(lift.change, 0)}` : "—"}
            </dd>
          </div>
        </dl>
      )}
      <div className="relative h-[220px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`Daily Spotify streams${song ? ` for ${song}` : ""} from ${shortDate(days[0].date)} to ${shortDate(days.at(-1)!.date)}`}
        >
          {grid.map((v) => (
            <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="#000005" strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
          ))}
          {startIndex > 0 && (
            <line x1={x(startIndex)} x2={x(startIndex)} y1={0} y2={H} stroke="#ED2124" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          )}
          <path d={line} fill="none" stroke="#000005" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={W} y1={H} y2={H} stroke="#000005" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {grid.map((v) => (
          <span key={v} className="absolute left-0 -translate-y-full pb-1 text-xs tabular-nums" style={{ top: `${(y(v) / H) * 100}%` }}>
            {compact(v)}
          </span>
        ))}
        {startIndex > 0 && (
          <span
            className="absolute top-0 -translate-x-1/2 bg-fb-red px-1.5 py-0.5 text-xs font-bold text-fb-white"
            style={{ left: `${(x(startIndex) / W) * 100}%` }}
          >
            Campaign start
          </span>
        )}
      </div>
      <figcaption className="mt-3 flex justify-between text-xs tabular-nums">
        <span>{shortDate(days[0].date)}</span>
        <span>{song ? `Spotify streams, “${song}”` : "Spotify streams"}</span>
        <span>{shortDate(days.at(-1)!.date)}</span>
      </figcaption>
    </figure>
  );
}
