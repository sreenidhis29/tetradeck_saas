import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production build optimizations
  typescript: {
    // Skip type checking during build - we check in CI
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build
    ignoreDuringBuilds: true,
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
};

export default nextConfig;
