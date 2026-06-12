import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["@memex/shared"],
    experimental: {
        proxyClientMaxBodySize: "100mb"
    }
};

export default nextConfig;
