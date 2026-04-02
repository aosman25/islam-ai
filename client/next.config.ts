import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  images: {
    remotePatterns: [
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/gateway/:path*",
        destination: `${process.env.GATEWAY_INTERNAL_URL || "http://localhost:8100"}/:path*`,
      },
      {
        source: "/master/:path*",
        destination: `${process.env.MASTER_INTERNAL_URL || "http://localhost:8200"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
