import {
  searchSubcategoryBrands,
  mapSubcategoryBrands,
  getBrand,
  mapBrands,
  getBrandProducts,
  mapProducts,
  toApiError,
} from "@/lib/smartscout";
import { getCategories } from "@/lib/catalog";
import { buildSubcategoryWorkbook } from "@/lib/export";
import { parseMarketplace, num } from "@/lib/respond";
import type {
  Product,
  RichSubcategoryBrand,
  SubcategoryBrandsResponse,
  BrandsResponse,
  SortDir,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Export fans out ~2 requests per brand (paced by the shared rate limiter), so give it room.
export const maxDuration = 800;

const MAX_BRANDS = 150; // safety cap; refine filters for larger sets
const BRAND_PAGE = 100;
const PRODUCTS_PER_BRAND = 1000;

// mapBrands (whole-catalog brand record) -> the rich row the Brands sheet needs.
/* eslint-disable @typescript-eslint/no-explicit-any */
function toRich(m: any, fallbackId: number, fallbackName: string): RichSubcategoryBrand {
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

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  if (b.subcategoryId === undefined || b.subcategoryId === null || b.subcategoryId === "") {
    return Response.json({ error: "subcategoryId is required", status: 400 }, { status: 400 });
  }
  const marketplace = parseMarketplace(b.marketplace) ?? "US";
  const subcategoryPath: string = b.subcategoryPath || String(b.subcategoryId);

  try {
    // 1) category id -> name map for "Main Category" columns
    const cats = await getCategories(marketplace);
    const catById = new Map(cats.map((c) => [c.id, c.name]));
    const catName = (id: number | null) => (id != null ? catById.get(id) ?? String(id) : "");

    // 2) ordered brand list (id + name) for this subcategory, up to the cap
    const list: { brandId: number; brandName: string }[] = [];
    let page = 1;
    let total = Infinity;
    while (list.length < MAX_BRANDS && (page - 1) * BRAND_PAGE < total) {
      const res = mapSubcategoryBrands(
        await searchSubcategoryBrands({
          subcategoryId: b.subcategoryId,
          minRevenue: num(b.minRevenue),
          maxRevenue: num(b.maxRevenue),
          minAvgSellers: num(b.minAvgSellers),
          maxAvgSellers: num(b.maxAvgSellers),
          sortBy: (b.sortBy as string) || "revenue",
          sortDir: (b.sortDir as SortDir) || "desc",
          page,
          pageSize: BRAND_PAGE,
          marketplace,
        }),
      ) as SubcategoryBrandsResponse;
      total = res.totalRowCount ?? res.returned;
      for (const r of res.brands) list.push({ brandId: r.brandId, brandName: r.brandName });
      if (res.returned < BRAND_PAGE) break;
      page += 1;
    }
    const capped = list.slice(0, MAX_BRANDS);

    // 3) per brand: whole-catalog record (get_brand) + all products
    const brands: RichSubcategoryBrand[] = [];
    const productsByBrand = new Map<number, Product[]>();
    for (const { brandId, brandName } of capped) {
      // brand-wide fields
      let rich: RichSubcategoryBrand;
      try {
        const br = mapBrands(await getBrand(brandName, marketplace)) as BrandsResponse;
        const match = br.brands.find((x) => x.brandId === brandId) ?? br.brands[0];
        rich = toRich(match, brandId, brandName);
      } catch {
        rich = toRich(null, brandId, brandName);
      }
      brands.push(rich);

      // products
      const pr = mapProducts(
        await getBrandProducts({
          brandId,
          sortBy: "monthlyRevenueEstimate",
          sortDir: "desc",
          page: 1,
          pageSize: PRODUCTS_PER_BRAND,
          marketplace,
        }),
      ) as { products: Product[] };
      productsByBrand.set(brandId, pr.products);
    }

    const buf = await buildSubcategoryWorkbook({
      subcategoryPath,
      marketplace,
      brands,
      productsByBrand,
      catName,
    });

    const leaf = subcategoryPath.split(">").pop()?.trim() || "subcategory";
    const fname = `${marketplace}_${leaf}_brands`.replace(/[^A-Za-z0-9._-]+/g, "_") + ".xlsx";

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const e = toApiError(err);
    return Response.json(e, { status: e.status });
  }
}
