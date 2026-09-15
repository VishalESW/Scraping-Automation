import { getBrandSellers, mapBrandSellers, toApiError } from "@/lib/smartscout";
import { parseMarketplace, num } from "@/lib/respond";
import type { BrandSellersResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3000;

// Amazon's own retail seller ids per marketplace (plus a name fallback). Used to
// tell "Amazon is reselling this brand" apart from the brand's own seller.
const AMAZON_IDS = new Set([
  "ATVPDKIKX0DER", "A3P5ROKL5A1OLE", "A3JWKAKR8XB7XF", "A3DWYIK6Y9EEQB", "A1X6FK5RDHNB96",
  "A11IL2PNWYJU7H", "A1AT7YVPFBWXBL", "A1F83G8C2ARO7P", "A2EUQ1WTGCTBG2", "A1VC38T7YXB528",
  "A21TJRUUN4KGV", "A19VAU5U5O7RUS",
]);
function isAmazon(name: string | null, id: string | null): boolean {
  if (id && AMAZON_IDS.has(id)) return true;
  return /(^|[^a-z])amazon([^a-z]|$)/i.test(name ?? "");
}

export interface BrandSellerSummary {
  sellerCount: number;
  significantCount: number; // sellers at/above the threshold
  ownerName: string | null; // top seller by coverage
  ownerCoverage: number | null;
  amazonPresent: boolean; // Amazon selling at/above the threshold
  amazonCoverage: number | null;
  soleSeller: boolean; // exactly one significant seller and it isn't Amazon
}

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
    const summaries: Record<string, BrandSellerSummary> = {};
    await Promise.all(
      ids.map(async (brandId) => {
        try {
          const sellers = (mapBrandSellers(await getBrandSellers(brandId, marketplace)) as BrandSellersResponse).sellers;
          const sorted = [...sellers].sort(
            (a, z) => (z.estimateBrandPercentage ?? 0) - (a.estimateBrandPercentage ?? 0),
          );
          const significant = sorted.filter((s) => (s.estimateBrandPercentage ?? 0) >= threshold);
          const amazonRows = sorted.filter((s) => isAmazon(s.sellerName, s.amazonSellerId));
          const amazonCoverage = amazonRows.reduce((n, s) => n + (s.estimateBrandPercentage ?? 0), 0);
          const owner = sorted[0] ?? null;
          summaries[brandId] = {
            sellerCount: sorted.length,
            significantCount: significant.length,
            ownerName: owner?.sellerName ?? null,
            ownerCoverage: owner?.estimateBrandPercentage ?? null,
            amazonPresent: amazonCoverage >= threshold,
            amazonCoverage: amazonRows.length ? amazonCoverage : null,
            soleSeller:
              significant.length === 1 &&
              !isAmazon(significant[0].sellerName, significant[0].amazonSellerId),
          };
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
