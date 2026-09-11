// Quick manual smoke test of the HTTP client, independent of MCP.
// Usage: npm run build && npm run smoke
// Requires a valid SMARTSCOUT_TOKEN in .env and confirmed endpoint mappings.
import { searchProducts } from "./client.js";

async function main(): Promise<void> {
  const result = await searchProducts({ query: "yoga mat", pageSize: 3 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
