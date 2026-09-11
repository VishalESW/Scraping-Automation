# SmartScout Research (web app)

Next.js (App Router) UI for interactive brand / product / marketplace research, built on top
of the `smartscout-mcp` data layer. It reuses `smartscout-mcp`'s `client.ts` and response
mappers directly (npm workspace + `transpilePackages`) — no MCP round-trip.

## Two views
- **Subcategory** — enter an Amazon browse-node `subcategoryId` (+ optional revenue / seller
  filters) → brands table → click a brand for **Products**, **Marketplaces**, **Sellers**, and
  **Search terms**. Fully wired chain.
- **Seller Map** — filter by category, seller type, revenue → seller list (name, est. sales,
  type, geo). **Seller list only**: SmartScout exposes no seller→brands endpoint, so reach
  brands/products/marketplaces via the Subcategory view.

## Run
```bash
# from repo root, once:
npm install

# token (server-side only, never sent to the browser):
cp web/.env.local.example web/.env.local   # paste SMARTSCOUT_TOKEN

cd web
npm run dev        # http://localhost:3000
```
The token is read server-side by the `/api/*` route handlers; the browser only ever calls
`/api/*`. On a 401/403 (expired token) the app shows a re-capture banner instead of crashing.

## Notes
- **Marketplace-specific IDs.** The global marketplace selector is carried through every
  drill-down so `brandId` / `subcategoryId` stay consistent.
- **Rate limit.** All requests pass through the shared client's serializer
  (`SMARTSCOUT_MIN_INTERVAL_MS`, default 1200 ms), so parallel calls queue. Fine for
  interactive research.
- **ToU.** Same personal-scale, session-token caveats as `smartscout-mcp` — no bulk export.
