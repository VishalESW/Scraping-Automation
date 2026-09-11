#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProductTools } from "./tools/products.js";
import { registerBrandTools } from "./tools/brands.js";
import { registerSellerTools } from "./tools/sellers.js";
import { registerSearchTermTools } from "./tools/searchTerms.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: "smartscout", version: "0.1.0" });

  registerProductTools(server);
  registerBrandTools(server);
  registerSellerTools(server);
  registerSearchTermTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // NOTE: never write to stdout here — stdout is the JSON-RPC channel.
  // Diagnostics go to stderr.
  console.error("smartscout MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting smartscout MCP server:", err);
  process.exit(1);
});
