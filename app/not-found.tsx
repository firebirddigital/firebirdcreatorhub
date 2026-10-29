import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="min-h-dvh p-[57px] max-sm:p-6">
      <Logo />
      <h1 className="headline mt-24 text-6xl">Not here</h1>
      <p className="mt-4 max-w-prose">
        This page doesn&apos;t exist, or the share link has been turned off. Ask the Firebird team for a new link.
      </p>
      <Link href="/campaigns" className="mt-8 inline-block font-bold underline underline-offset-4 hover:text-fb-red">
        Go to campaigns
      </Link>
    </main>
  );
}
