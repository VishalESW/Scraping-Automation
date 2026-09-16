import "server-only";
import type { BrandSeller } from "./types";

// Amazon's own retail seller ids per marketplace (plus a name fallback). Used to
// tell "Amazon is reselling this brand" apart from the brand's own seller.
const AMAZON_IDS = new Set([
  "ATVPDKIKX0DER", "A3P5ROKL5A1OLE", "A3JWKAKR8XB7XF", "A3DWYIK6Y9EEQB", "A1X6FK5RDHNB96",
  "A11IL2PNWYJU7H", "A1AT7YVPFBWXBL", "A1F83G8C2ARO7P", "A2EUQ1WTGCTBG2", "A1VC38T7YXB528",
  "A21TJRUUN4KGV", "A19VAU5U5O7RUS",
]);

export function isAmazonSeller(name: string | null, id: string | null): boolean {
  if (id && AMAZON_IDS.has(id)) return true;
  return /(^|[^a-z])amazon([^a-z]|$)/i.test(name ?? "");
}

export interface SoleSellerSummary {
  sellerCount: number;
  significantCount: number;
  ownerName: string | null;
  ownerCoverage: number | null;
  amazonPresent: boolean;
  amazonCoverage: number | null;
  soleSeller: boolean;
}

// A brand is "sole-seller" when exactly one seller sits at/above the coverage
// threshold and that seller is not Amazon (i.e. the brand owner sells it, no
// significant reseller or Amazon presence).
export function summarizeSellers(sellers: BrandSeller[], thresholdPct: number): SoleSellerSummary {
  const sorted = [...sellers].sort(
    (a, z) => (z.estimateBrandPercentage ?? 0) - (a.estimateBrandPercentage ?? 0),
  );
  const significant = sorted.filter((s) => (s.estimateBrandPercentage ?? 0) >= thresholdPct);
  const amazonRows = sorted.filter((s) => isAmazonSeller(s.sellerName, s.amazonSellerId));
  const amazonCoverage = amazonRows.reduce((n, s) => n + (s.estimateBrandPercentage ?? 0), 0);
  const owner = sorted[0] ?? null;
  return {
    sellerCount: sorted.length,
    significantCount: significant.length,
    ownerName: owner?.sellerName ?? null,
    ownerCoverage: owner?.estimateBrandPercentage ?? null,
    amazonPresent: amazonCoverage >= thresholdPct,
    amazonCoverage: amazonRows.length ? amazonCoverage : null,
    soleSeller:
      significant.length === 1 && !isAmazonSeller(significant[0].sellerName, significant[0].amazonSellerId),
  };
}
