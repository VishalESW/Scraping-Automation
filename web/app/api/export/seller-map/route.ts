import {
  sellerMapSearch,
  mapSellerMap,
  getSellerBrands,
  mapSellerBrands,
  getBrand,
  mapBrands,
  getBrandProducts,
  mapProducts,
  getBrandMarketplaces,
  mapBrandMarketplaces,
  toApiError,
} from "@/lib/smartscout";
import { getCategories } from "@/lib/catalog";
import { richFromBrand } from "@/lib/brand-rich";
import { buildSellerMapWorkbook, type SellerBlock } from "@/lib/export";
import { parseMarketplace, num } from "@/lib/respond";
import type {
  MapSeller,
  SellerMapResponse,
  SellerBrand,
  SellerBrandsResponse,
  RichSubcategoryBrand,
  BrandsResponse,
  Product,
  BrandMarketplace,
  MarketplacesResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fans out per seller (brand list) and per brand (products + marketplaces),
// all paced by the shared rate limiter — allow a long run.
export const maxDuration = 3000;

// Caps to keep the export bounded (resellers can carry thousands of brands).
const MAX_SELLERS = 50;
const MAX_BRANDS_PER_SELLER = 10;
const MAX_TOTAL_BRANDS = 150; // hard stop for products+marketplaces detail
const PRODUCTS_PER_BRAND = 1000;

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  const marketplace = parseMarketplace(b.marketplace) ?? "US";

  try {
    // category id -> name for product "Main Category" column
    const cats = await getCategories(marketplace);
    const catById = new Map(cats.map((c) => [c.id, c.name]));
    const catName = (id: number | null) => (id != null ? catById.get(id) ?? String(id) : "");

    // 1) sellers matching the filters (revenue-sorted)
    const smRes = mapSellerMap(
      await sellerMapSearch({
        categoryId: b.categoryId === "" ? undefined : b.categoryId,
        sellerTypeId: b.sellerTypeId || undefined,
        minRevenue: num(b.minRevenue),
        maxRevenue: num(b.maxRevenue),
        sellerName: b.sellerName || undefined,
        maxCount: num(b.maxCount),
        marketplace,
      }),
    ) as SellerMapResponse;
    const sellers: MapSeller[] = smRes.sellers.slice(0, MAX_SELLERS);

    // 2) per seller: brands (capped); per brand (up to a global cap): products + marketplaces
    const blocks: SellerBlock[] = [];
    let brandBudget = MAX_TOTAL_BRANDS;
    for (const seller of sellers) {
      let brandRows: SellerBrand[] = [];
      try {
        const sb = mapSellerBrands(await getSellerBrands(seller.sellerId, marketplace)) as SellerBrandsResponse;
        brandRows = sb.brands.slice(0, MAX_BRANDS_PER_SELLER);
      } catch {
        brandRows = [];
      }

      const brands: SellerBlock["brands"] = [];
      for (const coverage of brandRows) {
        if (brandBudget <= 0) {
          // keep the coverage row (cheap) but skip expensive detail beyond the budget
          brands.push({ coverage, brand: null, products: [], marketplaces: [] });
          continue;
        }
        brandBudget -= 1;

        // whole-catalog brand record (Brand sheet detail columns)
        let brand: RichSubcategoryBrand | null = null;
        try {
          const br = mapBrands(await getBrand(coverage.brandName ?? "", marketplace)) as BrandsResponse;
          const match = br.brands.find((x) => x.brandId === coverage.brandId) ?? br.brands[0];
          brand = richFromBrand(match, coverage.brandId, coverage.brandName ?? "");
        } catch {
          brand = null;
        }

        let products: Product[] = [];
        let marketplaces: BrandMarketplace[] = [];
        try {
          products = (mapProducts(
            await getBrandProducts({
              brandId: coverage.brandId,
              sortBy: "monthlyRevenueEstimate",
              sortDir: "desc",
              page: 1,
              pageSize: PRODUCTS_PER_BRAND,
              marketplace,
            }),
          ) as { products: Product[] }).products;
        } catch {
          products = [];
        }
        try {
          marketplaces = (mapBrandMarketplaces(
            await getBrandMarketplaces({ brandId: coverage.brandId, marketplace }),
          ) as MarketplacesResponse).marketplaces;
        } catch {
          marketplaces = [];
        }
        brands.push({ coverage, brand, products, marketplaces });
      }
      blocks.push({ seller, brands });
    }

    const parts: string[] = [];
    if (b.categoryName) parts.push(`Category: ${b.categoryName}`);
    if (b.sellerTypeId) parts.push(`Type: ${b.sellerTypeId}`);
    if (b.minRevenue || b.maxRevenue) parts.push(`Revenue: ${b.minRevenue ?? "0"}-${b.maxRevenue ?? "max"}`);
    if (b.sellerName) parts.push(`Name: ${b.sellerName}`);

    const detailNote =
      smRes.sellers.length > MAX_SELLERS || brandBudget <= 0
        ? `Detail is capped: up to ${MAX_SELLERS} sellers, ${MAX_BRANDS_PER_SELLER} brands/seller, and ` +
          `${MAX_TOTAL_BRANDS} brands with product/marketplace detail. Refine filters for a fuller export.`
        : undefined;

    const buf = await buildSellerMapWorkbook({
      marketplace,
      filterSummary: parts.join(" · "),
      sellers: blocks,
      catName,
      detailNote,
    });

    const tag = (b.categoryName || "all").toString();
    const fname = `${marketplace}_sellers_${tag}`.replace(/[^A-Za-z0-9._-]+/g, "_") + ".xlsx";

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
