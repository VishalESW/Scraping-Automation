import { getBrandSellers, mapBrandSellers, toApiError } from "@/lib/smartscout";
import { parseMarketplace, num } from "@/lib/respond";
import { summarizeSellers, type SoleSellerSummary } from "@/lib/sole-seller";
import type { BrandSellersResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3000;

// Per-brand seller summary for a page of subcategory brands. One brandcoverage
// call per brand (rate-limited in the client), so the browser sends only the
// visible page's brandIds — same per-page pattern as the seller map.
export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  const marketplace = parseMarketplace(b.marketplace);
  // A seller is "significant" (a real reseller / Amazon presence) at/above this %.
  const threshold = num(b.otherMaxPct) ?? 5;
  const ids: number[] = Array.isArray(b.brandIds)
    ? b.brandIds.map((x: unknown) => Number(x)).filter((x: number) => Number.isFinite(x))
    : [];
  if (ids.length === 0) return Response.json({ summaries: {} });

  try {
    const summaries: Record<string, SoleSellerSummary> = {};
    await Promise.all(
      ids.map(async (brandId) => {
        try {
          const sellers = (mapBrandSellers(await getBrandSellers(brandId, marketplace)) as BrandSellersResponse).sellers;
          summaries[brandId] = summarizeSellers(sellers, threshold);
        } catch {
          summaries[brandId] = {
            sellerCount: 0, significantCount: 0, ownerName: null, ownerCoverage: null,
            amazonPresent: false, amazonCoverage: null, soleSeller: false,
          };
        }
      }),
    );
    return Response.json({ summaries });
  } catch (err) {
    const e = toApiError(err);
    return Response.json(e, { status: e.status });
  }
}
