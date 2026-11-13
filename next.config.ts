import type { NextConfig } from "next";
import { dashboardPaths } from "./lib/dashboard-sections";

const nextConfig: NextConfig = {
  async rewrites() {
    return Object.values(dashboardPaths)
      .filter(path => path !== dashboardPaths.Home)
      .map(source => ({ source, destination: dashboardPaths.Home }));
  },
};

export default nextConfig;
