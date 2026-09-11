import { searchSubcategoryBrands, mapSubcategoryBrands } from "@/lib/smartscout";
import { respond, parseMarketplace, num } from "@/lib/respond";
import type { SortDir } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  if (b.subcategoryId === undefined || b.subcategoryId === null || b.subcategoryId === "") {
    return Response.json({ error: "subcategoryId is required", status: 400 }, { status: 400 });
  }
  return respond(
    () =>
      searchSubcategoryBrands({
        subcategoryId: b.subcategoryId,
        minRevenue: num(b.minRevenue),
        maxRevenue: num(b.maxRevenue),
        minAvgSellers: num(b.minAvgSellers),
        maxAvgSellers: num(b.maxAvgSellers),
        sortBy: b.sortBy || undefined,
        sortDir: (b.sortDir as SortDir) || undefined,
        page: num(b.page),
        pageSize: num(b.pageSize),
        marketplace: parseMarketplace(b.marketplace),
      }),
    mapSubcategoryBrands,
  );
}
