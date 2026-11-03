import { Logo } from "@/components/Logo";
import { RosterShowcase } from "@/components/RosterShowcase";
import { REQUEST_FORM_URL } from "@/lib/config";
import type { Creator } from "@/lib/types";

/** The shareable creators page. Pass creators already run through rosterCreator(). */
export function RosterPage({ creators, preview, showRates = false }: { creators: Creator[]; preview?: boolean; showRates?: boolean }) {
  return (
    <>
      {preview && (
        <p className="bg-fb-red px-6 py-2 text-sm font-bold text-white">
          Preview: this is exactly what people with the {showRates ? "link with rates" : "shareable link"} see.{" "}
          <a href={showRates ? "/creators/preview" : "/creators/preview?rates=1"} className="underline underline-offset-2">
            {showRates ? "See the standard link" : "See the link with rates"}
          </a>
          {" · "}
          <a href="/creators" className="underline underline-offset-2">
            Back to Creators
          </a>
        </p>
      )}
      <main className="app public-page">
        <header className="py-2">
          {/* Brand rule: the red logo anchors the top-left with clear space around it. */}
          <Logo />
          <h1 className="headline mt-10 text-4xl max-sm:text-3xl">Creators that move fans</h1>
          <p className="mt-3 max-w-prose text-[15px] text-secondary">
            The creators Firebird works with, grouped by what they make. Tap anyone to see their content.
          </p>
        </header>
        <RosterShowcase creators={creators} requestUrl={REQUEST_FORM_URL} showRates={showRates} />
      </main>
    </>
  );
}
