import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Link previews need full addresses for their images.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  title: "Firebird Creator Hub",
  description: "Creator roster and live campaign results",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Montserrat:wght@700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
