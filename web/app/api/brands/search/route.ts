import { searchBrands, mapBrands } from "@/lib/smartscout";
import { respond, parseMarketplace, num } from "@/lib/respond";
import type { SortDir } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  return respond(
    () =>
      searchBrands({
        query: q.get("query") || undefined,
        sortBy: q.get("sortBy") || undefined,
        sortDir: (q.get("sortDir") as SortDir) || undefined,
        page: num(q.get("page")),
        pageSize: num(q.get("pageSize")),
        marketplace: parseMarketplace(q.get("marketplace")),
      }),
    mapBrands,
  );
}
