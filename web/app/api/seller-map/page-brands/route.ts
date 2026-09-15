import { getSellerBrands, mapSellerBrands, toApiError } from "@/lib/smartscout";
import { parseMarketplace, num } from "@/lib/respond";
import type { SellerBrand } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3000;

// Brand names carried by each seller shown on the current seller-map page.
// The browser sends only the ~50 sellerIds visible on one page, so this stays a
// light, per-page load (one brandcoverage call per seller, rate-limited in the
// client) instead of fetching brands for the whole result set at once.
export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  const marketplace = parseMarketplace(b.marketplace);
  const perSeller = num(b.perSeller) ?? 100;
  const ids: number[] = Array.isArray(b.sellerIds)
    ? b.sellerIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n))
    : [];

  if (ids.length === 0) return Response.json({ brandsBySeller: {} });

  try {
    const brandsBySeller: Record<string, { brandId: number; brandName: string | null }[]> = {};
    // Serialized by the client-side rate limiter; Promise.all just queues them.
    await Promise.all(
      ids.map(async (sellerId) => {
        try {
          const mapped = mapSellerBrands(await getSellerBrands(sellerId, marketplace)) as {
            returned: number;
            brands: SellerBrand[];
          };
          brandsBySeller[sellerId] = mapped.brands
            .slice(0, perSeller)
            .map((x) => ({ brandId: x.brandId, brandName: x.brandName }));
        } catch {
          // A single seller failing shouldn't fail the whole page.
          brandsBySeller[sellerId] = [];
        }
      }),
    );
    return Response.json({ brandsBySeller });
  } catch (err) {
    const e = toApiError(err);
    return Response.json(e, { status: e.status });
  }
}
