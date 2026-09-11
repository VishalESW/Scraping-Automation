import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchProducts, getProduct, getBrandProducts } from "../client.js";
import { toResult, marketplaceParam } from "./util.js";
import { mapProducts } from "../map.js";

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    "search_products",
    {
      title: "Search SmartScout products",
      description:
        "Look up Amazon products in your SmartScout account by ASIN/identifier, with sorting and paging. " +
        "Returns a compact set of fields; set raw=true for the full response. " +
        "To list ALL products for a BRAND (by brand name), do NOT use this — use get_brand_products with a " +
        "brandId from search_brands. Free-text title search and numeric filters are not wired here.",
      inputSchema: {
        query: z.string().optional().describe("ASIN / identifier to match"),
        exact: z
          .boolean()
          .optional()
          .describe("Exact match (default true). Substring match on identifiers if false."),
        sortBy: z
          .string()
          .optional()
          .describe(
            "Column to sort by, e.g. monthlyRevenueEstimate, rank, reviewCount, opportunityScore, buyBoxPrice",
          ),
        sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction (default desc)"),
        page: z.number().int().positive().optional().describe("1-based page number"),
        pageSize: z.number().int().positive().max(200).optional().describe("Rows per page (default 25)"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const { raw, exact, ...rest } = args;
        const res = await searchProducts({ ...rest, exact: exact ?? true });
        return raw ? res : mapProducts(res);
      }),
  );

  server.registerTool(
    "get_product",
    {
      title: "Get a SmartScout product by ASIN",
      description: "Fetch a single product's SmartScout detail by exact ASIN.",
      inputSchema: {
        asin: z.string().describe("Amazon ASIN, e.g. B0GFDYX1R2"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const res = await getProduct(args.asin, args.marketplace);
        return args.raw ? res : mapProducts(res);
      }),
  );

  server.registerTool(
    "get_brand_products",
    {
      title: "List all products (ASINs) for a brand",
      description:
        "List every product (ASIN) for a brand, with revenue, rank, reviews, price, etc. Search a brand " +
        "first, then pass its brandId. Sort by monthlyRevenueEstimate, rank, reviewCount, etc. Use page/" +
        "pageSize to page through large brands. Set raw=true for the full response.",
      inputSchema: {
        brandId: z
          .union([z.string(), z.number()])
          .describe("Brand id from a brand search result, e.g. 2904632"),
        sortBy: z
          .string()
          .optional()
          .describe("Column to sort by, e.g. monthlyRevenueEstimate, rank, reviewCount, buyBoxPrice"),
        sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction (default desc)"),
        page: z.number().int().positive().optional().describe("1-based page number"),
        pageSize: z.number().int().positive().max(1000).optional().describe("Rows per page (default 50)"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const { raw, ...a } = args;
        const res = await getBrandProducts(a);
        return raw ? res : mapProducts(res);
      }),
  );
}
