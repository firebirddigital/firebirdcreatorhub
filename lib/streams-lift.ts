// Pure streams maths, safe anywhere (no storage calls).

export interface StreamDay {
  date: string; // YYYY-MM-DD
  streams: number;
}

/** Average daily streams the week before launch vs since launch. */
export function streamsLift(days: StreamDay[], startDate?: string) {
  if (!startDate || !days.length) return undefined;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const weekBefore = start - 7 * 86_400_000;
  const avg = (xs: StreamDay[]) => (xs.length ? xs.reduce((t, d) => t + d.streams, 0) / xs.length : undefined);
  const before = avg(days.filter((d) => {
    const t = new Date(`${d.date}T00:00:00Z`).getTime();
    return t >= weekBefore && t < start;
  }));
  const during = avg(days.filter((d) => new Date(`${d.date}T00:00:00Z`).getTime() >= start));
  if (before === undefined || during === undefined) return { before, during, change: undefined };
  return { before, during, change: before ? (during - before) / before : undefined };
}
