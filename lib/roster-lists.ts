// Partner shortlists on the shareable creators page. Kept in the partner's own browser (no accounts),
// and shareable as a link that carries the creator IDs. Partners can't download the roster or a list.
// Safe for client code.
import type { Creator } from "./types";

export interface RosterList {
  id: string;
  name: string;
  creatorIds: string[];
}

const KEY = "fb-roster-lists";

export function loadLists(): RosterList[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as RosterList[];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.name === "string" && Array.isArray(l.creatorIds)) : [];
  } catch {
    return [];
  }
}

export function saveLists(lists: RosterList[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    // Private windows can block storage; lists still work until the page closes.
  }
}

export const newListId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface ListTotals {
  creators: number;
  followers: number;
  /** Sum of each creator's average views: roughly what one post from everyone would get. */
  combinedViews: number;
  /** Average of the creators' average views. */
  avgViews?: number;
  withViews: number;
  spend: number;
  withRates: number;
  /** Spend ÷ combined views × 1,000, using only creators with both a rate and average views. */
  costPer1k?: number;
}

export function listTotals(members: Creator[]): ListTotals {
  const withViews = members.filter((c) => c.avgViews);
  const withRates = members.filter((c) => c.rate);
  const both = members.filter((c) => c.rate && c.avgViews);
  const bothViews = both.reduce((t, c) => t + (c.avgViews ?? 0), 0);
  return {
    creators: members.length,
    followers: members.reduce((t, c) => t + c.instagramFollowers + c.tiktokFollowers, 0),
    combinedViews: withViews.reduce((t, c) => t + (c.avgViews ?? 0), 0),
    avgViews: withViews.length ? withViews.reduce((t, c) => t + (c.avgViews ?? 0), 0) / withViews.length : undefined,
    withViews: withViews.length,
    spend: withRates.reduce((t, c) => t + (c.rate ?? 0), 0),
    withRates: withRates.length,
    costPer1k: bothViews ? (both.reduce((t, c) => t + (c.rate ?? 0), 0) / bothViews) * 1000 : undefined,
  };
}

const n = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

/** The request form, pre-filled with the shortlist (Airtable forms accept prefill_<Field name> in the address). */
export function requestUrlFor(formUrl: string, list: RosterList, members: Creator[], showRates: boolean): string {
  const t = listTotals(members);
  const lines = members.map((c) => {
    const handles = [c.tiktok && `TikTok @${c.tiktok}`, c.instagram && `Instagram @${c.instagram}`].filter(Boolean).join(", ");
    const stats = [
      `${n(c.instagramFollowers + c.tiktokFollowers)} followers`,
      c.avgViews ? `${n(c.avgViews)} median views` : "",
      showRates && c.rate ? `$${c.rate.toLocaleString("en-US")}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `- ${c.name}${handles ? ` (${handles})` : ""}: ${stats}`;
  });
  const text = [
    `Shortlist “${list.name}” from the Firebird creators page (${[
      `${members.length} creators`,
      `${n(t.followers)} followers`,
      t.withViews ? `${n(t.combinedViews)} combined median views` : "",
    ]
      .filter(Boolean)
      .join(", ")}):`,
    ...lines,
  ].join("\n");
  const params = new URLSearchParams({ "prefill_Types of Creators / Creator Examples": text });
  if (showRates && t.spend) params.set("prefill_Budget", String(Math.round(t.spend)));
  return `${formUrl}${formUrl.includes("?") ? "&" : "?"}${params.toString()}`;
}

/** A link to this page that opens with the shortlist loaded, for sending to a colleague. */
export function shareUrlFor(list: RosterList): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("list", list.creatorIds.join(","));
  url.searchParams.set("listName", list.name);
  return url.toString();
}
