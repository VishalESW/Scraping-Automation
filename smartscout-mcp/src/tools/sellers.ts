import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchSellers, getSeller, getBrandSellers, sellerMapSearch } from "../client.js";
import { toResult, marketplaceParam } from "./util.js";
import { mapBrandSellers, mapSellerMap } from "../map.js";

// NOTE: endpoint path + response shape not yet confirmed from a capture.
// Returns the raw response until we verify it (see README -> Phase 0).
export function registerSellerTools(server: McpServer): void {
  server.registerTool(
    "search_sellers",
    {
      title: "Search SmartScout sellers",
      description:
        "Search Amazon sellers in your SmartScout account. (Endpoint pending capture confirmation — returns raw response.)",
      inputSchema: {
        query: z.string().optional().describe("Seller name / search text"),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(200).optional(),
        marketplace: marketplaceParam,
      },
    },
    async (args) => toResult(() => searchSellers(args)),
  );

  server.registerTool(
    "get_seller",
    {
      title: "Get a SmartScout seller",
      description: "Fetch a single seller by seller id. (Pending capture confirmation.)",
      inputSchema: {
        sellerId: z.string().describe("Amazon seller id, e.g. A1B2C3D4E5"),
        marketplace: marketplaceParam,
      },
    },
    async (args) => toResult(() => getSeller(args.sellerId, args.marketplace)),
  );

  server.registerTool(
    "get_brand_sellers",
    {
      title: "Get the sellers of a brand",
      description:
        "List the Amazon sellers carrying a given brand and each seller's share of brand sales " +
        "(SmartScout 'brand coverage'). Search a brand first, then pass its brandId. " +
        "Returns sellers ordered by share; set raw=true for the full response.",
      inputSchema: {
        brandId: z
          .union([z.string(), z.number()])
          .describe("Brand id from a brand search result, e.g. 2904632"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const res = await getBrandSellers(args.brandId, args.marketplace);
        return args.raw ? res : mapBrandSellers(res);
      }),
  );

  server.registerTool(
    "seller_map",
    {
      title: "Seller Map (find sellers by category, type, revenue)",
      description:
        "Find Amazon sellers filtered by category, seller type, and monthly revenue range, sorted by " +
        "estimated revenue (with geo location). categoryId is SmartScout's category id (e.g. 12 = Pet " +
        "Supplies; it matches primaryCategoryId on brand/product results). sellerTypeId e.g. 'PrivateLabel'. " +
        "Set raw=true for the full response.",
      inputSchema: {
        categoryId: z
          .union([z.string(), z.number()])
          .optional()
          .describe("SmartScout category id (e.g. 12 = Pet Supplies; matches primaryCategoryId)"),
        sellerTypeId: z
          .string()
          .optional()
          .describe("Seller type, e.g. PrivateLabel (other values exist in the SmartScout UI)"),
        minRevenue: z.number().optional().describe("Minimum monthly revenue (USD)"),
        maxRevenue: z.number().optional().describe("Maximum monthly revenue (USD)"),
        sellerName: z.string().optional().describe("Optional seller name filter"),
        maxCount: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .describe("Max sellers to return, top by revenue (default 100)"),
        marketplace: marketplaceParam,
        raw: z.boolean().optional().describe("Return the full untrimmed response"),
      },
    },
    async (args) =>
      toResult(async () => {
        const { raw, ...a } = args;
        const res = await sellerMapSearch(a);
        return raw ? res : mapSellerMap(res);
      }),
  );
}
