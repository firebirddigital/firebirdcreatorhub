"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FIELD_LABELS,
  guessField,
  parseCsv,
  TEMPLATE_CSV,
  toRawRows,
  type ImportField,
  type RawCreatorRow,
} from "@/lib/csv-import";
import type { ImportAction, ImportRowResult } from "@/lib/creator-import";
import { pullStatsInBatches } from "@/lib/pull-stats";

const BATCH = 200;
const MAX_ROWS = 5000;

type Counts = Record<ImportAction, number>;

const ACTION_LABEL: Record<ImportAction, string> = {
  create: "New",
  update: "Adds info",
  unchanged: "Already there",
  duplicate: "Repeat in file",
  skip: "Skipped",
};

const BUTTON =
  "subtitle border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50";
const BUTTON_PRIMARY =
  "subtitle border-2 border-fb-red bg-fb-red text-fb-white px-5 py-2.5 text-sm hover:bg-fb-black hover:border-fb-black transition-colors disabled:opacity-50";

async function post(rows: RawCreatorRow[], dryRun: boolean, firstRow: number) {
  const res = await fetch("/api/creators/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, dryRun, firstRow }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; results?: ImportRowResult[]; counts?: Counts };
  if (!res.ok || !data.results || !data.counts) throw new Error(data.error ?? "The import didn't go through. Try again.");
  return { results: data.results, counts: data.counts };
}

/** "Import CSV" on the Creators page: pick a file, check the columns, preview, then import. */
export function CreatorImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [preview, setPreview] = useState<{ results: ImportRowResult[]; counts: Counts }>();
  const [filter, setFilter] = useState<ImportAction | "warnings" | "all">("all");
  const [busy, setBusy] = useState<"checking" | "importing">();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<Counts>();
  const [newIds, setNewIds] = useState<string[]>([]);
  const [stats, setStats] = useState<{ state: "pulling" | "done"; done: number; text?: string }>();

  const rawRows = useMemo(() => toRawRows(body, mapping, headers), [body, mapping, headers]);
  const hasIdentity = mapping.some((m) => m === "name" || m === "instagram" || m === "tiktok" || m === "link");

  function reset() {
    setFileName("");
    setHeaders([]);
    setBody([]);
    setMapping([]);
    setPreview(undefined);
    setError(undefined);
    setDone(undefined);
    setNewIds([]);
    setStats(undefined);
    setProgress(0);
    setFilter("all");
  }

  async function readFile(file: File) {
    reset();
    if (/\.xlsx?$/i.test(file.name)) {
      setError("That's an Excel file. In Excel or Google Sheets, use File → Download / Save as → CSV, then choose that file.");
      return;
    }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setError("That file has no creators under the header row.");
      return;
    }
    if (rows.length - 1 > MAX_ROWS) {
      setError(`That file has ${(rows.length - 1).toLocaleString()} rows. Import up to ${MAX_ROWS.toLocaleString()} at a time.`);
      return;
    }
    setFileName(file.name);
    setHeaders(rows[0].map((h) => h.trim()));
    setBody(rows.slice(1));
    setMapping(rows[0].map(guessField));
  }

  async function pullNewStats() {
    setStats({ state: "pulling", done: 0 });
    try {
      const r = await pullStatsInBatches(newIds, (d) => setStats({ state: "pulling", done: d }));
      setStats({
        state: "done",
        done: newIds.length,
        text: `Pulled followers and median views (last 10 posts) for ${r.updated} of ${r.requested}.${
          r.requested - r.updated ? ` ${r.requested - r.updated} had no public TikTok or Instagram to read.` : ""
        }`,
      });
      router.refresh();
    } catch (e) {
      setStats({ state: "done", done: 0, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function check() {
    setBusy("checking");
    setError(undefined);
    try {
      setPreview(await post(rawRows, true, 2));
      setFilter("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(undefined);
    }
  }

  async function runImport() {
    setBusy("importing");
    setError(undefined);
    setProgress(0);
    const total: Counts = { create: 0, update: 0, unchanged: 0, duplicate: 0, skip: 0 };
    const created: string[] = [];
    try {
      for (let i = 0; i < rawRows.length; i += BATCH) {
        const { counts, results } = await post(rawRows.slice(i, i + BATCH), false, i + 2);
        (Object.keys(total) as ImportAction[]).forEach((k) => (total[k] += counts[k]));
        results.forEach((r) => r.action === "create" && r.id && created.push(r.id));
        setNewIds([...created]);
        setProgress(Math.min(rawRows.length, i + BATCH));
      }
      setDone(total);
      setPreview(undefined);
      router.refresh();
    } catch (e) {
      const saved = total.create + total.update;
      setError(
        `${e instanceof Error ? e.message : String(e)}${
          saved ? ` ${saved} creators were saved before it stopped; importing the same file again skips them.` : ""
        }`,
      );
    } finally {
      setBusy(undefined);
    }
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    a.download = "creator-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={BUTTON}>
        Import CSV
      </button>
    );
  }

  const shown = (preview?.results ?? []).filter((r) =>
    filter === "all" ? true : filter === "warnings" ? r.warnings.length > 0 : r.action === filter,
  );
  const warningCount = preview?.results.filter((r) => r.warnings.length).length ?? 0;
  const toWrite = preview ? preview.counts.create + preview.counts.update : 0;

  return (
    <section aria-label="Import creators" className="basis-full w-full mt-4 border-2 border-fb-black p-6 max-sm:p-4 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="headline text-3xl">Import creators</h2>
          <p className="mt-1 max-w-prose text-sm">
            Upload a CSV with one creator per row: name, TikTok and Instagram links or handles, email, tags, location, rate.
            Anyone already in the database is matched by handle, so they get your new tags and any missing details added,
            never overwritten. Nothing saves until you click Import.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button onClick={downloadTemplate} className="font-bold underline underline-offset-4 hover:text-fb-red">
            Download a template
          </button>
          <button
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="underline underline-offset-4"
          >
            Close
          </button>
        </div>
      </div>

      {!done && (
        <label
          className="block border-2 border-dashed border-fb-black p-6 text-center cursor-pointer hover:bg-fb-black/5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) readFile(f);
          }}
        >
          <span className="font-bold">{fileName ? `${fileName} · ${body.length.toLocaleString()} rows` : "Choose a CSV file or drop it here"}</span>
          <span className="block text-xs mt-1">From Google Sheets or Excel: File → Download / Save as → CSV.</span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {headers.length > 0 && !done && (
        <div>
          <h3 className="subtitle text-lg">Match the columns</h3>
          <p className="text-xs">We guessed from the headers. Fix any that are wrong; several columns can go into Tags.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm border-t-2 border-fb-black">
              <thead>
                <tr className="border-b-2 border-fb-black text-left text-xs">
                  <th className="py-2 pr-4">Column in your file</th>
                  <th className="py-2 pr-4">First value</th>
                  <th className="py-2">Import as</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} className="border-b border-fb-black/20">
                    <td className="py-2 pr-4 font-bold">{h || `Column ${i + 1}`}</td>
                    <td className="py-2 pr-4 max-w-64 truncate">{body.find((r) => r[i]?.trim())?.[i] ?? "—"}</td>
                    <td className="py-2">
                      <select
                        value={mapping[i]}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = e.target.value as ImportField;
                          setMapping(next);
                          setPreview(undefined);
                        }}
                        className={`border-b-2 border-fb-black bg-transparent py-1 font-bold outline-none focus:border-fb-red ${
                          mapping[i] === "skip" ? "text-fb-black/50" : ""
                        }`}
                      >
                        {(Object.keys(FIELD_LABELS) as ImportField[]).map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasIdentity && (
            <p className="mt-3 text-sm font-bold text-fb-red">
              Pick at least one column for Name, TikTok, Instagram or Profile link.
            </p>
          )}
          {!preview && (
            <button onClick={check} disabled={!hasIdentity || Boolean(busy)} className={`mt-4 ${BUTTON_PRIMARY}`}>
              {busy === "checking" ? "Checking" : `Check ${body.length.toLocaleString()} rows`}
            </button>
          )}
        </div>
      )}

      {preview && !done && (
        <div>
          <h3 className="subtitle text-lg">Before you import</h3>
          <div role="group" aria-label="Filter rows" className="mt-3 flex flex-wrap gap-2 text-sm">
            {(
              [
                ["all", `All ${preview.results.length}`],
                ["create", `${preview.counts.create} new`],
                ["update", `${preview.counts.update} add info to existing`],
                ["unchanged", `${preview.counts.unchanged} already there`],
                ["duplicate", `${preview.counts.duplicate} repeats in file`],
                ["skip", `${preview.counts.skip} skipped`],
                ["warnings", `${warningCount} with notes`],
              ] as [typeof filter, string][]
            )
              .filter(([k, label]) => k === "all" || !label.startsWith("0 "))
              .map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  aria-pressed={filter === k}
                  className={`px-3 py-1.5 font-bold border-2 ${
                    filter === k ? "bg-fb-black border-fb-black text-fb-white" : "border-fb-black hover:bg-fb-black/10"
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>
          <div className="mt-3 max-h-96 overflow-auto border-t-2 border-fb-black">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-fb-white">
                <tr className="border-b-2 border-fb-black text-left text-xs">
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Creator</th>
                  <th className="py-2 pr-3">What happens</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((r) => (
                  <tr key={r.row} className="border-b border-fb-black/20 align-top">
                    <td className="py-2 pr-3 tabular-nums">{r.row}</td>
                    <td className="py-2 pr-3 font-bold">{r.name ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 text-xs font-bold ${
                          r.action === "create"
                            ? "bg-fb-red text-fb-white"
                            : r.action === "update"
                              ? "bg-fb-black text-fb-white"
                              : "border border-fb-black"
                        }`}
                      >
                        {ACTION_LABEL[r.action]}
                      </span>
                    </td>
                    <td className="py-2 text-xs">
                      {r.detail}
                      {r.warnings.map((w, i) => (
                        <span key={i} className="block text-fb-red">
                          {w}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 500 && <p className="py-2 text-xs">Showing the first 500 of {shown.length}.</p>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button onClick={runImport} disabled={!toWrite || Boolean(busy)} className={BUTTON_PRIMARY}>
              {busy === "importing"
                ? `Importing ${progress.toLocaleString()} of ${rawRows.length.toLocaleString()}`
                : toWrite
                  ? `Import: ${preview.counts.create} new, ${preview.counts.update} updated`
                  : "Nothing new to import"}
            </button>
            <span className="text-xs">Rows marked Skipped or Already there aren&apos;t changed.</span>
          </div>
          {busy === "importing" && (
            <div className="mt-3 h-2 bg-fb-black/10" aria-hidden>
              <div className="h-full bg-fb-red transition-[width]" style={{ width: `${(progress / rawRows.length) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {done && (
        <div role="status">
          <p className="subtitle text-xl">Import finished</p>
          <p className="mt-1 text-sm">
            Added {done.create} new {done.create === 1 ? "creator" : "creators"}, updated {done.update}
            {done.skip ? `, skipped ${done.skip}` : ""}. They&apos;re in the list below. Use Needs tags to find anyone still untagged.
          </p>
          {newIds.length > 0 && (
            <div className="mt-4 border-2 border-fb-black p-4">
              <p className="text-sm">
                Pull followers and median views (last 10 posts) for the {newIds.length} new{" "}
                {newIds.length === 1 ? "creator" : "creators"}? It runs about 10 at a time and uses a little Apify credit
                per creator{newIds.length > 50 ? ", so a big list takes a few minutes. Keep this page open" : ""}.
              </p>
              {stats?.state !== "done" && (
                <button onClick={pullNewStats} disabled={stats?.state === "pulling"} className={`mt-3 ${BUTTON_PRIMARY}`}>
                  {stats?.state === "pulling" ? `Pulling stats ${stats.done} of ${newIds.length}` : "Pull stats now"}
                </button>
              )}
              {stats?.text && <p className="mt-3 text-sm font-bold">{stats.text}</p>}
            </div>
          )}
          <button onClick={reset} className={`mt-4 ${BUTTON}`}>
            Import another file
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
    </section>
  );
}
