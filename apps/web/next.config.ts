import type { NextConfig } from "next";
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Django API uses trailing slashes. Preserve them to avoid redirect loops and lost POST bodies.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*/` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};
export default config;
