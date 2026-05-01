import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: ["pdfjs-dist"],
    experimental: {
        proxyClientMaxBodySize: "100mb"
    }
};

export default nextConfig;
