import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchBrands,
  getBrand,
  searchSubcategoryBrands,
  getBrandMarketplaces,
} from "../client.js";
import { toResult, marketplaceParam } from "./util.js";
import { mapBrands, mapSubcategoryBrands, mapBrandMarketplaces } from "../map.js";

export function registerBrandTools(server: McpServer): void {
  server.registerTool(
    "search_brands",
    {
      title: "Search SmartScout brands",
      description:
        "Search brands in your SmartScout account by name (substring match). Returns compact fields " +
        "including each brand's brandId (feed it to get_brand_sellers) and its dominant seller. " +
        "Set raw=true for the full response.",
      inputSchema: {
        query: z.string().optional().describe("Brand name / search text (substring match)"),
        sortBy: z
          .string()
          .optional()
          .describe("Column to sort by, e.g. monthlyRevenue, ttm, brandScore, totalProducts"),
        sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction (default desc)"),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(200).optional().describe("Rows per page (default 25)"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const { raw, ...search } = args;
        const res = await searchBrands(search);
        return raw ? res : mapBrands(res);
      }),
  );

  server.registerTool(
    "get_brand",
    {
      title: "Get a SmartScout brand",
      description: "Fetch a single brand by exact name.",
      inputSchema: {
        brand: z.string().describe("Exact brand name"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const res = await getBrand(args.brand, args.marketplace);
        return args.raw ? res : mapBrands(res);
      }),
  );

  server.registerTool(
    "search_subcategory_brands",
    {
      title: "Filter brands within a subcategory",
      description:
        "List brands in a subcategory (with market share) filtered by monthly revenue range and " +
        "average number of sellers range. Requires a subcategoryId (Amazon browse-node id). " +
        "Sort by revenue, marketshare, avgNumberSellers, etc. Set raw=true for the full response.",
      inputSchema: {
        subcategoryId: z
          .union([z.string(), z.number()])
          .describe("Subcategory (Amazon browse-node) id, e.g. 17044954011"),
        minRevenue: z.number().optional().describe("Minimum monthly revenue (USD)"),
        maxRevenue: z.number().optional().describe("Maximum monthly revenue (USD)"),
        minAvgSellers: z.number().optional().describe("Minimum average number of sellers"),
        maxAvgSellers: z.number().optional().describe("Maximum average number of sellers"),
        sortBy: z
          .string()
          .optional()
          .describe("Column to sort by, e.g. revenue, marketshare, avgNumberSellers, totalReviews"),
        sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction (default desc)"),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(1000).optional().describe("Rows per page (default 50)"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const { raw, ...a } = args;
        const res = await searchSubcategoryBrands(a);
        return raw ? res : mapSubcategoryBrands(res);
      }),
  );

  server.registerTool(
    "get_brand_marketplaces",
    {
      title: "Get a brand's stats across Amazon marketplaces",
      description:
        "For a brand, list its presence and stats in every Amazon marketplace it sells in (US, UK, DE, " +
        "JP, CA, …): monthly revenue, units sold, total products, out-of-stock count, avg sellers, brand " +
        "score, review rating. Search a brand first, then pass its brandId. Set raw=true for the full response.",
      inputSchema: {
        brandId: z
          .union([z.string(), z.number()])
          .describe("Brand id from a brand search result, e.g. 376831"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const res = await getBrandMarketplaces({ brandId: args.brandId, marketplace: args.marketplace });
        return args.raw ? res : mapBrandMarketplaces(res);
      }),
  );
}
