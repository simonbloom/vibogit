/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: ["@vibogit/shared"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

module.exports = nextConfig;
