/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: ["@vibogit/shared"],
  images: {
    unoptimized: true,
  },
  // Disable server-side features for Tauri
  trailingSlash: true,
};

module.exports = nextConfig;
