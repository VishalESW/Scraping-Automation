/** @type {import('next').NextConfig} */
const nextConfig = {
  // Consume the SmartScout client from TypeScript source in the workspace.
  transpilePackages: ["smartscout-mcp"],
  webpack: (config) => {
    // client.ts uses NodeNext-style ".js" import specifiers that actually point
    // to ".ts" source files. Let webpack resolve those to the TS sources.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "m.media-amazon.com" }],
  },
};

module.exports = nextConfig;
