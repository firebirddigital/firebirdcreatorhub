"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Checks for new request form submissions in the background and shows any campaigns it just created. */
export function RequestImport() {
  const router = useRouter();
  const [created, setCreated] = useState<{ campaignId: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/requests/import", { method: "POST" })
      .then((r) => r.json())
      .then((d: { created?: { campaignId: string; name: string }[] }) => {
        if (cancelled || !d.created?.length) return;
        setCreated(d.created);
        router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!created.length) return null;
  return (
    <p role="status" className="mt-6 border-2 border-fb-red p-4 text-sm">
      <span className="font-bold">
        {created.length === 1 ? "A new request became a campaign: " : `${created.length} new requests became campaigns: `}
      </span>
      {created.map((c, i) => (
        <span key={c.campaignId}>
          {i > 0 && ", "}
          <a href={`/campaigns/${c.campaignId}`} className="underline underline-offset-2 hover:text-fb-red">
            {c.name}
          </a>
        </span>
      ))}
      . They start in Planning with the partner link off.
    </p>
  );
}
