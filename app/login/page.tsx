import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/campaigns";

  return (
    <main className="signin">
      <div className="signin-card shadow-tile">
        <Logo className="mx-auto" />
        <h1 className="headline">Creator hub</h1>
        <p>Sign in with the team password to see creators and campaign results.</p>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
