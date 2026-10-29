import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/campaigns";

  return (
    <main className="min-h-dvh bg-fb-black text-fb-white flex flex-col">
      <div className="p-[57px] max-sm:p-6">
        <Logo variant="white" />
      </div>
      <div className="flex-1 flex items-center px-[57px] max-sm:px-6 pb-24">
        <div className="w-full max-w-md">
          <h1 className="headline text-6xl max-sm:text-5xl">Creator hub</h1>
          <p className="mt-4 text-fb-white/80">Sign in with the team password to see creators and campaign results.</p>
          <LoginForm next={safeNext} />
        </div>
      </div>
    </main>
  );
}
