/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT_MODE === "export" ? "export" : undefined,
  transpilePackages: ["@vibogit/shared", "@vibogit/ui"],
  images: {
    unoptimized: true,
  },
  trailingSlash: process.env.NEXT_OUTPUT_MODE === "export" ? true : undefined,
};

export default nextConfig;
