import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js NOT to bundle these packages into the serverless function —
  // let Node.js load them at runtime so native binaries (e.g. sharp/libvips) work correctly.
  serverExternalPackages: ['sharp'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "eadzqgspkrsdoaimggrg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
