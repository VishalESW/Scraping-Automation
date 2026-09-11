import { sellerMapSearch, mapSellerMap } from "@/lib/smartscout";
import { respond, parseMarketplace, num } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  return respond(
    () =>
      sellerMapSearch({
        categoryId: b.categoryId === "" ? undefined : b.categoryId,
        sellerTypeId: b.sellerTypeId || undefined,
        minRevenue: num(b.minRevenue),
        maxRevenue: num(b.maxRevenue),
        sellerName: b.sellerName || undefined,
        maxCount: num(b.maxCount),
        marketplace: parseMarketplace(b.marketplace),
      }),
    mapSellerMap,
  );
}
