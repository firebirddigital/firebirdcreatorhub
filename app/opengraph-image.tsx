import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "Firebird Creator Hub";
export const size = OG_SIZE;
export const contentType = "image/png";

// The default link preview for every page.
export default function Image() {
  return ogImage({ headline: "Creator Hub", caption: "Creator roster and live campaign results" });
}
