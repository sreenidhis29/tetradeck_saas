import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable turbopack to avoid thread panic issues
  // Using webpack for stability
};

export default nextConfig;
