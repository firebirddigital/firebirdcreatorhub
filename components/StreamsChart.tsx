import { compact, pct } from "@/lib/format";
import type { StreamDay } from "@/lib/streams-lift";
import { LineChart, type Series } from "./nest/charts/LineChart";

/**
 * Daily Spotify streams: ink before the campaign started, red from launch on, so the start reads
 * from the change of colour. Shows the 7-day average before launch against the average since launch.
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
    return <p className="empty">Upload at least two days of streams to see the chart.</p>;
  }
  const startIndex = startDate ? days.findIndex((d) => d.date >= startDate) : -1;
  const point = (d: StreamDay) => ({ date: d.date, value: d.streams });
  // The two lines share the launch day, so they join up.
  const series: Series[] =
    startIndex > 0
      ? [
          { key: "before", label: "Before launch", color: "var(--neutral-mark)", points: days.slice(0, startIndex + 1).map(point) },
          { key: "since", label: "Since launch", color: "var(--series-1)", points: days.slice(startIndex).map(point) },
        ]
      : [{ key: "streams", label: "Spotify streams", color: "var(--series-1)", points: days.map(point) }];

  return (
    <figure>
      {lift && (lift.before !== undefined || lift.during !== undefined) && (
        <dl className="mb-5 grid grid-cols-3 max-sm:grid-cols-1 gap-3.5 border-b border-line pb-4">
          <div>
            <dt className="tile-label">Avg daily streams, week before</dt>
            <dd className="tile-value text-[22px]">{lift.before !== undefined ? compact(lift.before) : "—"}</dd>
          </div>
          <div>
            <dt className="tile-label">Avg daily streams, since launch</dt>
            <dd className="tile-value text-[22px]">{lift.during !== undefined ? compact(lift.during) : "—"}</dd>
          </div>
          <div>
            <dt className="tile-label">Change</dt>
            <dd className={`tile-value text-[22px] ${lift.change && lift.change > 0 ? "text-fb-red" : ""}`}>
              {lift.change !== undefined ? `${lift.change > 0 ? "+" : ""}${pct(lift.change, 0)}` : "—"}
            </dd>
          </div>
        </dl>
      )}
      <LineChart height={220} series={series} />
      <figcaption className="mt-2 text-xs text-muted">
        {song ? `Spotify streams, “${song}”` : "Spotify streams"}
      </figcaption>
    </figure>
  );
}
