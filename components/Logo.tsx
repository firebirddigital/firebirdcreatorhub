// Uses the official Firebird logotype files from the "Firebird and Portco Branding" Drive folder.
// Drop them into /public/brand (see public/brand/README.md). Never redraw the logo.
export function Logo({ variant = "red", className = "" }: { variant?: "red" | "white"; className?: string }) {
  const src = variant === "white" ? "/brand/firebird-logotype-white.png" : "/brand/firebird-logotype-red.png";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Firebird" className={`h-8 w-auto ${className}`} />;
}
