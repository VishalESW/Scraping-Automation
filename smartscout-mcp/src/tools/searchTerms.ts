import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBrandSearchTerms } from "../client.js";
import { toResult, marketplaceParam } from "./util.js";
import { mapBrandSearchTerms } from "../map.js";

export function registerSearchTermTools(server: McpServer): void {
  server.registerTool(
    "get_brand_search_terms",
    {
      title: "Get a brand's search terms (ranking keywords)",
      description:
        "List the Amazon search terms (keywords) a brand ranks for, with search volume, keyword sales, " +
        "opportunity score, CPC, and the brand's ad/organic win rates. Search a brand first, then pass " +
        "its brandId. Sort by columns like searchTerm.estimateSearches or searchTerm.opportunityScore. " +
        "Set raw=true for the full response.",
      inputSchema: {
        brandId: z
          .union([z.string(), z.number()])
          .describe("Brand id from a brand search result, e.g. 2904632"),
        sortBy: z
          .string()
          .optional()
          .describe(
            "Column to sort by, e.g. searchTerm.estimateSearches, searchTerm.opportunityScore, totalAdSpend",
          ),
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
        const res = await getBrandSearchTerms(a);
        return raw ? res : mapBrandSearchTerms(res);
      }),
  );
}
