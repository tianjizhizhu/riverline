import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 线上部署在 https://www.cloudfleets.cloud/riverline，本地开发不设该变量即根路径
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // 生产环境不产出浏览器 source map，避免源码结构被探测
  productionBrowserSourceMaps: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
