import type { NextConfig } from "next";

// Use static export ONLY when building for Chrome extension
// Dev server runs normally without static export restrictions
const isExport = process.env.NEXT_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport && {
    output: "export",
    trailingSlash: true,
    // ↓ KEY FIX: Tell Next.js to use /next_assets/ for all JS chunks at build time
    // This way we just rename the _next folder and ALL references are already correct
    assetPrefix: "/next_assets",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
