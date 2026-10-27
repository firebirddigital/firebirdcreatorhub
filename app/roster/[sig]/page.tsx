import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorBrowser } from "@/components/CreatorBrowser";
import { Logo } from "@/components/Logo";
import { isValidRoster } from "@/lib/auth";
import { REQUEST_FORM_URL } from "@/lib/config";
import { getCreators } from "@/lib/data";
import { rosterCreator } from "@/lib/partner-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Firebird creators", robots: { index: false, follow: false } };

// Shareable creators database for labels, managers and artist teams. Emails, notes, rates and
// track records are stripped here, before anything reaches the browser.
export default async function RosterPage({ params }: { params: Promise<{ sig: string }> }) {
  const { sig } = await params;
  if (!(await isValidRoster(sig))) notFound();
  const creators = (await getCreators()).map(rosterCreator);

  return (
    <>
      <header className="bg-fb-black text-fb-white px-[57px] max-sm:px-6 pt-[57px] max-sm:pt-8 pb-14">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <Logo variant="white" />
          <a
            href={REQUEST_FORM_URL}
            target="_blank"
            rel="noreferrer"
            className="subtitle bg-fb-red px-6 py-3.5 text-sm text-fb-white hover:bg-fb-white hover:text-fb-black transition-colors"
          >
            Request a campaign
          </a>
        </div>
        <h1 className="headline mt-16 text-7xl max-sm:text-5xl">Our creators</h1>
        <p className="mt-4 max-w-prose text-lg">
          Browse the creators Firebird works with. Filter by niche, platform, followers and average views. When you&apos;ve
          found the fit, request a campaign and we&apos;ll take it from there.
        </p>
      </header>
      <main className="px-[57px] max-sm:px-6 pb-24">
        <CreatorBrowser creators={creators} editable={false} audience="partner" />
      </main>
    </>
  );
}
