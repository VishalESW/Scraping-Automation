import "server-only";
import type { RichSubcategoryBrand } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Convert a mapBrands() brand object (whole-catalog record) into the rich row
// shape both exports use for their Brands sheet.
export function richFromBrand(
  m: any,
  fallbackId: number,
  fallbackName: string,
): RichSubcategoryBrand {
  const dom = m?.dominantSeller ?? null;
  return {
    brandId: m?.brandId ?? fallbackId,
    brandName: m?.name ?? fallbackName,
    brandScore: m?.brandScore ?? null,
    primaryCategoryId: m?.primaryCategoryId ?? null,
    primarySubcategory: m?.subcategory ?? null,
    monthlyRevenue: m?.monthlyRevenue ?? null,
    annualRevenue: m?.annualRevenue ?? null,
    avgPrice: m?.avgPrice ?? null,
    avgVolume: null, // not exposed by mapBrands
    avgFbaSellers: m?.avgFbaSellers ?? null,
    avgSellers: m?.avgSellers ?? null,
    dominantSellerName: dom?.name ?? null,
    dominantSellerCountry: dom?.country ?? null,
    dominantSellerBrandCoverage: dom?.brandCoverage ?? null,
    monthlyUnitsSold: m?.monthlyUnitsSold ?? null,
    amazonIsr: m?.amazonIsr ?? null,
    reviewRating: m?.reviewRating ?? null,
    totalReviews: m?.totalReviews ?? null,
    momGrowth: m?.momGrowth ?? null,
    momGrowth12: m?.momGrowth12 ?? null,
    totalProducts: m?.totalProducts ?? null,
    hasStorefront: m?.hasStorefront ?? null,
    avgInStockRate90Day: m?.avgInStockRate90Day ?? null,
    avgBuyBoxSuppression45Day: null, // not exposed by mapBrands
    totalEstFbaFees30Day: m?.totalEstFbaFees30Day ?? null,
    note: null,
    storefrontUrl: m?.storefrontUrl ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
