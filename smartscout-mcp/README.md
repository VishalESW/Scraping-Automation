# SmartScout MCP

A small MCP server that lets Claude query **your** SmartScout account — products, brands,
sellers, and search terms — using your own logged-in session token.

---

## Status

| Data | Endpoint | State |
| --- | --- | --- |
| Products — ASIN lookup | `POST /api/products/search` | ✅ **Confirmed & tested live** (ASIN match, sort, paging). |
| Brand → products (all ASINs) | `POST /api/products/search` (filter `{brandId}`) | ✅ **Confirmed & tested live** (`get_brand_products`). |
| Products — keyword/title search | (column filter) | 🟡 `searchTexts` is ASIN-only; title search needs a column-filter capture. |
| Numeric filters (min revenue/reviews) | (column filter) | 🟡 Need one capture with a filter applied to learn the filter JSON. |
| Brands | `POST /api/brands/search` | ✅ **Confirmed & tested live** (name substring search, sort, paging). |
| Brands filtered (category + revenue + sellers) | `POST /api/subcategories/brands` | ✅ **Confirmed & tested live** (`search_subcategory_brands`; numeric filters use `{min,max}`). |
| Sellers | `POST /api/sellers/search` | 🟡 Path assumed — needs a capture to confirm. |
| Seller Map (category, seller type, revenue) | `POST /api/sellermaps/search` | ✅ **Confirmed & tested live** (`seller_map`; flat body, response is a bare array). |
| **Brand → sellers** | `POST /api/brandcoverage/search` | ✅ **Confirmed & tested live** (`get_brand_sellers`, body `{brandId}`). |
| **Brand → marketplaces** | `POST /api/brands/by-brand-marketplaces` | ✅ **Confirmed & tested live** (`get_brand_marketplaces`; bare-array response). |
| Brand search terms (keywords) | `POST /api/search-terms/search-term-brands` | ✅ **Confirmed & tested live** (`get_brand_search_terms`, body `{filter:{brandId}}`). |

Confirmed tools return **compact** results; unconfirmed tools return the **raw** response so we
can see the real shape and finalize the mapping.

---

## How it works

```
Claude ─stdio▶ server.ts ─▶ tools/* ─▶ client.ts ─HTTP+token▶ smartscoutapi-east.azurewebsites.net
```

- `src/config.ts` — env-driven config (token, base URL, marketplace, headers, rate limit).
- `src/client.ts` — one function per endpoint + a shared request helper (auth, marketplace
  header, rate limiting, error handling) and the ag-Grid-style body builder.
- `src/tools/*` — MCP tools with typed parameters.
- `src/server.ts` — registers the tools and speaks MCP over stdio.

The list endpoints use an ag-Grid-style POST body:
`{ filter:{ searchTexts:[{filter,type}] }, pageFilter:{ startRow,endRow,sortModel,fields }, ... }`
and the response is `{ payload: [...], pageInfo: { totalRowCount } }`.

---

## Getting your token

1. Log into SmartScout, open DevTools (F12) → **Network** → filter **Fetch/XHR**.
2. Run a product search; click the `products/search` request → **Headers**.
3. Copy the value after `Authorization: Bearer ` — that's your `SMARTSCOUT_TOKEN`.
   (It's a JWT and expires periodically; re-capture when you start getting 401s.)

## Capturing the remaining endpoints (brands / sellers / search terms / filters)

In the Network tab (filter `mime-type:application/json`), perform the action in SmartScout,
then **Copy as cURL (bash)** + **Copy response** for the `*/search` request and send both.
For numeric filters, apply a Revenue/Reviews filter in the UI first so the capture shows the
filter JSON.

---

## Install & build

```bash
cd smartscout-mcp
npm install
npm run build
```

## Configure

```bash
cp .env.example .env   # then paste your token into SMARTSCOUT_TOKEN
```

| Variable | Purpose |
| --- | --- |
| `SMARTSCOUT_TOKEN` | Your bearer token. **Required.** |
| `SMARTSCOUT_BASE_URL` | API backend (default = the confirmed Azure host). |
| `SMARTSCOUT_MARKETPLACE` | Default marketplace (US, UK, DE, CA, MX, FR, IT, ES). |
| `SMARTSCOUT_MIN_INTERVAL_MS` | Minimum gap between requests (default 1200). |

Advanced overrides (auth header/prefix, content-type, origin/referer, extra headers) exist in
`.env.example` but default to what the real web app sends.

## Test locally

```bash
npm run smoke        # hits products/search directly (needs a valid token)
npm run inspector    # interactive MCP inspector
```

## Register with Claude

**Claude Desktop** — `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "smartscout": {
      "command": "node",
      "args": ["D:/AI Projects/3xperimental/smartscout-mcp/dist/server.js"],
      "env": { "SMARTSCOUT_TOKEN": "your-token-here" }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add smartscout --env SMARTSCOUT_TOKEN=your-token-here -- node D:/AI Projects/3xperimental/smartscout-mcp/dist/server.js
```

Restart Claude; the tools below appear.

## Tools

| Tool | Parameters |
| --- | --- |
| `search_products` | query, sortBy, sortDir, page, pageSize, marketplace, raw |
| `get_product` | asin, marketplace, raw |
| `get_brand_products` | brandId, sortBy, sortDir, page, pageSize, marketplace |
| `search_brands` | query, sortBy, sortDir, page, pageSize, marketplace |
| `get_brand` | brand, marketplace |
| `search_subcategory_brands` | subcategoryId, minRevenue, maxRevenue, minAvgSellers, maxAvgSellers, sortBy, sortDir, page, pageSize, marketplace |
| `get_brand_marketplaces` | brandId, marketplace |
| `search_sellers` | query, sortBy, sortDir, page, pageSize, marketplace |
| `get_seller` | sellerId, marketplace |
| `get_brand_sellers` | brandId, marketplace |
| `seller_map` | categoryId, sellerTypeId, minRevenue, maxRevenue, sellerName, maxCount, marketplace |
| `get_brand_search_terms` | brandId, sortBy, sortDir, page, pageSize, marketplace |

`sortBy` takes a column id, e.g. `monthlyRevenueEstimate`, `rank`, `reviewCount`,
`opportunityScore`, `buyBoxPrice`.

## Marketplaces

Every tool takes an optional **`marketplace`** parameter: `US, UK, DE, CA, MX, FR, IT, ES, AU, JP, IN`.
Omit it to use the server default (`SMARTSCOUT_MARKETPLACE`, or `US`). It's sent as the
`X-SmartScout-Marketplace` request header, so the same tools work across all marketplaces.

⚠️ **IDs are marketplace-specific.** A brand has a different `brandId` per marketplace (e.g. Pure
Encapsulations is `376831` in US but `208478` in UK), and the same is true for `subcategoryId` and
`sellerId`. So a multi-step workflow must **stay on one marketplace**: search in UK → use the UK
`brandId` with `marketplace: "UK"` on the follow-up calls. Mixing a US id with a UK marketplace
returns wrong or empty data. The `marketplace` param's description tells Claude this, so it keeps
the marketplace consistent when you say e.g. *"in the UK marketplace…"*.

To make a non-US marketplace the default, set `SMARTSCOUT_MARKETPLACE` (e.g. `UK`) in the server's
`env` block.

## Troubleshooting

- **401 / 403** → expired/invalid token. Re-capture and update `SMARTSCOUT_TOKEN`.
- **Non-JSON response** → wrong base URL/path, or an HTML login page (bad token).
- **404 on brands/sellers/search terms** → the assumed path is wrong; send a capture and it's a
  one-line fix in `src/client.ts`.
