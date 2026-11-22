import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.SATSWAY_DEMO_PROXY_API === "true" ? ".next-demo" : ".next",
  async rewrites() {
    if (process.env.SATSWAY_DEMO_PROXY_API !== "true") return [];
    const apiPort = process.env.SATSWAY_DEMO_API_PORT ?? "8001";
    return [
      { source: "/api/sandbox/grid-links/:path*", destination: `http://127.0.0.1:${apiPort}/api/sandbox/grid-links/:path*` },
      { source: "/api/rates", destination: `http://127.0.0.1:${apiPort}/api/rates` },
    ];
  },
};

export default nextConfig;
