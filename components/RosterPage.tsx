import { Logo } from "@/components/Logo";
import { RosterShowcase } from "@/components/RosterShowcase";
import { REQUEST_FORM_URL } from "@/lib/config";
import type { Creator } from "@/lib/types";

/** The shareable creators page. Pass creators already run through rosterCreator(). */
export function RosterPage({ creators, preview, showRates = false }: { creators: Creator[]; preview?: boolean; showRates?: boolean }) {
  return (
    <div className="min-h-dvh bg-fb-black text-fb-white">
      {preview && (
        <p className="bg-fb-red px-6 py-2 text-sm font-bold text-fb-white">
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
      <header className="px-[57px] max-sm:px-6 pt-[57px] max-sm:pt-8">
        {/* Logo top-left with 57px clear space, per brand guidelines */}
        <Logo variant="white" />
        <h1 className="headline mt-14 text-6xl max-sm:text-4xl">Creators that move fans</h1>
        <p className="mt-3 max-w-prose text-lg">
          The creators Firebird works with, grouped by what they make. Tap anyone to see their content.
        </p>
      </header>
      <RosterShowcase creators={creators} requestUrl={REQUEST_FORM_URL} showRates={showRates} />
    </div>
  );
}
