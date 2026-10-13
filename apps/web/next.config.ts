import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ainews/shared"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
