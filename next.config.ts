import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js/Turbopack from bundling sharp into the serverless function.
  // Sharp must be loaded by Node.js directly at runtime so its native libvips binary works.
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
