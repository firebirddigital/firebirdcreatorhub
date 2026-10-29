import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Airtable attachment thumbnails
    remotePatterns: [{ protocol: "https", hostname: "**.airtableusercontent.com" }],
  },
};

export default nextConfig;
