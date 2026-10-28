// Link preview images (Open Graph) in Firebird's look: black card, white logo, red caps headline.
// Server-side only.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Montserrat ExtraBold for headlines, straight from Google Fonts (TTF). Falls back to the default font. */
async function montserrat(): Promise<ArrayBuffer | undefined> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Montserrat:wght@800")).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : undefined;
  } catch {
    return undefined;
  }
}

async function logo(): Promise<string> {
  const png = await readFile(join(process.cwd(), "public/brand/firebird-logotype-white.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** The preview card. `figure` is an optional big red number, e.g. "10M". */
export async function ogImage(opts: { eyebrow?: string; headline: string; figure?: string; caption?: string }) {
  const [font, src] = await Promise.all([montserrat(), logo()]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000005",
          color: "#ffffff",
          padding: 72,
          fontFamily: font ? "Montserrat" : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={254} height={60} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {opts.eyebrow && <div style={{ fontSize: 30, textTransform: "uppercase", marginBottom: 16 }}>{opts.eyebrow}</div>}
          <div
            style={{
              fontSize: opts.headline.length > 28 ? 64 : 84,
              lineHeight: 1.02,
              color: "#ED2124",
              textTransform: "uppercase",
              maxWidth: 1050,
            }}
          >
            {opts.headline}
          </div>
          {opts.figure && (
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 24 }}>
              <div style={{ fontSize: 120, lineHeight: 1, color: "#ED2124" }}>{opts.figure}</div>
              {opts.caption && <div style={{ fontSize: 32, marginLeft: 24, marginBottom: 14 }}>{opts.caption}</div>}
            </div>
          )}
          {!opts.figure && opts.caption && <div style={{ fontSize: 32, marginTop: 20 }}>{opts.caption}</div>}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: "Montserrat", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
