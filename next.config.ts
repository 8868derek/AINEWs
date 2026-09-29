import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-cron"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
