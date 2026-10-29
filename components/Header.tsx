import Link from "next/link";
import { authEnabled } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { Logo } from "./Logo";

export function Header({ active }: { active?: "campaigns" | "creators" | "analytics" }) {
  const navClass = (key: string) =>
    `subtitle text-sm pb-1 border-b-2 ${active === key ? "border-fb-red" : "border-transparent hover:border-fb-black"}`;

  return (
    <>
      {isSampleMode() && (
        <div className="bg-fb-black text-fb-white text-sm px-6 py-2">
          You&apos;re looking at sample data. Add your Airtable keys to go live.
        </div>
      )}
      {/* 57px clear space around the logo, per brand guidelines */}
      <header className="flex flex-wrap items-center justify-between gap-6 px-[57px] py-[57px] max-sm:px-6 max-sm:py-8">
        <Link href="/campaigns" aria-label="Firebird Creator Hub home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-8">
          <Link href="/campaigns" className={navClass("campaigns")}>
            Campaigns
          </Link>
          <Link href="/creators" className={navClass("creators")}>
            Creators
          </Link>
          <Link href="/analytics" className={navClass("analytics")}>
            Analytics
          </Link>
          {authEnabled() && (
            <form action="/api/logout" method="post">
              <button className="text-sm underline underline-offset-4 hover:text-fb-red">Sign out</button>
            </form>
          )}
        </nav>
      </header>
    </>
  );
}
