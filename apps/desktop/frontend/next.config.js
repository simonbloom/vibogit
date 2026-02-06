const path = require("path");

const uiSrc = path.resolve(__dirname, "../../../packages/ui/src");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: ["@vibogit/shared", "@vibogit/ui"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config) {
    // Resolve @/ path alias imports inside @vibogit/ui to the UI package's src directory
    config.resolve.alias["@/components"] = path.join(uiSrc, "components");
    config.resolve.alias["@/lib"] = path.join(uiSrc, "lib");
    config.resolve.alias["@/providers"] = path.join(uiSrc, "providers");
    config.resolve.alias["@/platform"] = path.join(uiSrc, "platform");
    return config;
  },
};

module.exports = nextConfig;
