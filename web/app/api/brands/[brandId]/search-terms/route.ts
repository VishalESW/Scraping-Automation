import { getBrandSearchTerms, mapBrandSearchTerms } from "@/lib/smartscout";
import { respond, parseMarketplace, num } from "@/lib/respond";
import type { SortDir } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { brandId: string } },
): Promise<Response> {
  const q = new URL(req.url).searchParams;
  return respond(
    () =>
      getBrandSearchTerms({
        brandId: params.brandId,
        sortBy: q.get("sortBy") || "searchTerm.estimateSearches",
        sortDir: (q.get("sortDir") as SortDir) || "desc",
        page: num(q.get("page")),
        pageSize: num(q.get("pageSize")),
        marketplace: parseMarketplace(q.get("marketplace")),
      }),
    mapBrandSearchTerms,
  );
}
