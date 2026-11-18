import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./uploads/**/*", "./backups/**/*", "./storage/**/*", "./.git/**/*"],
  },
};

export default nextConfig;
