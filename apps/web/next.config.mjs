import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiSrc = path.resolve(__dirname, "../../packages/ui/src");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT_MODE === "export" ? "export" : undefined,
  transpilePackages: ["@vibogit/shared", "@vibogit/ui"],
  images: {
    unoptimized: true,
  },
  trailingSlash: process.env.NEXT_OUTPUT_MODE === "export" ? true : undefined,
  webpack(config) {
    config.resolve.alias["@/components"] = path.join(uiSrc, "components");
    config.resolve.alias["@/lib"] = path.join(uiSrc, "lib");
    config.resolve.alias["@/providers"] = path.join(uiSrc, "providers");
    return config;
  },
};

export default nextConfig;
