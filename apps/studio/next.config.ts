import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.CINEWEAVE_TEST_MODE === "1" ? ".next-test" : ".next",
  turbopack: { root: process.cwd() }
};
export default nextConfig;
