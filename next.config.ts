import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable strict mode for better development
  reactStrictMode: true,

  // Disable type checking during build for faster builds
  // (type checking should be done separately)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Configure images to allow external domains if needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },

  // Ensure trailing slashes for cleaner URLs
  trailingSlash: false,
};

export default nextConfig;
