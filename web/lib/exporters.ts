import "server-only";
import {
  sellerMapSearch,
  mapSellerMap,
  getSellerBrands,
  mapSellerBrands,
  getBrand,
  mapBrands,
  getBrandProducts,
  mapProducts,
  getBrandSellers,
  mapBrandSellers,
  getBrandSearchTerms,
  mapBrandSearchTerms,
  getBrandMarketplaces,
  mapBrandMarketplaces,
  searchSubcategoryBrands,
  mapSubcategoryBrands,
} from "@/lib/smartscout";
import { getCategories } from "@/lib/catalog";
import { richFromBrand } from "@/lib/brand-rich";
import {
  buildSellerMapWorkbook,
  buildSubcategoryWorkbook,
  buildBrandWorkbook,
  type SellerBlock,
  type BrandReportEntry,
} from "@/lib/export";
import { parseMarketplace, num } from "@/lib/respond";
import type {
  MapSeller,
  SellerMapResponse,
  SellerBrand,
  SellerBrandsResponse,
  RichSubcategoryBrand,
  BrandsResponse,
  Product,
  ProductsResponse,
  BrandMarketplace,
  MarketplacesResponse,
  BrandSellersResponse,
  SearchTermsResponse,
  SubcategoryBrandsResponse,
  SortDir,
} from "@/lib/types";

export interface ExportResult {
  buffer: ArrayBuffer;
  filename: string;
}

function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_");
}

async function categoryNamer(marketplace: string): Promise<(id: number | null) => string> {
  const cats = await getCategories(marketplace);
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  return (id: number | null) => (id != null ? byId.get(id) ?? String(id) : "");
}

// ---------------------------------------------------------------------------
// Seller Map export
// ---------------------------------------------------------------------------
const SM_MAX_SELLERS = 50;
const SM_MAX_BRANDS_PER_SELLER = 10;
const SM_MAX_TOTAL_BRANDS = 150;
const SM_PRODUCTS_PER_BRAND = 1000;

export async function runSellerMapExport(b: Record<string, unknown>): Promise<ExportResult> {
  const marketplace = parseMarketplace(b.marketplace as string) ?? "US";
  const catName = await categoryNamer(marketplace);

  const smRes = mapSellerMap(
    await sellerMapSearch({
      categoryId: b.categoryId === "" ? undefined : (b.categoryId as string | number | undefined),
      sellerTypeId: (b.sellerTypeId as string) || undefined,
      minRevenue: num(b.minRevenue as string),
      maxRevenue: num(b.maxRevenue as string),
      sellerName: (b.sellerName as string) || undefined,
      maxCount: num(b.maxCount as string),
      marketplace,
    }),
  ) as SellerMapResponse;
  const sellers: MapSeller[] = smRes.sellers.slice(0, SM_MAX_SELLERS);

  const blocks: SellerBlock[] = [];
  let brandBudget = SM_MAX_TOTAL_BRANDS;
  for (const seller of sellers) {
    let brandRows: SellerBrand[] = [];
    try {
      const sb = mapSellerBrands(await getSellerBrands(seller.sellerId, marketplace)) as SellerBrandsResponse;
      brandRows = sb.brands.slice(0, SM_MAX_BRANDS_PER_SELLER);
    } catch {
      brandRows = [];
    }

    const brands: SellerBlock["brands"] = [];
    for (const coverage of brandRows) {
      if (brandBudget <= 0) {
        brands.push({ coverage, brand: null, products: [], marketplaces: [] });
        continue;
      }
      brandBudget -= 1;

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
          await getBrandProducts({ brandId: coverage.brandId, sortBy: "monthlyRevenueEstimate", sortDir: "desc", page: 1, pageSize: SM_PRODUCTS_PER_BRAND, marketplace }),
        ) as ProductsResponse).products;
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
    smRes.sellers.length > SM_MAX_SELLERS || brandBudget <= 0
      ? `Detail is capped: up to ${SM_MAX_SELLERS} sellers, ${SM_MAX_BRANDS_PER_SELLER} brands/seller, and ${SM_MAX_TOTAL_BRANDS} brands with product/marketplace detail. Refine filters for a fuller export.`
      : undefined;

  const buffer = await buildSellerMapWorkbook({
    marketplace,
    filterSummary: parts.join(" · "),
    sellers: blocks,
    catName,
    detailNote,
  });
  const tag = (b.categoryName || "all").toString();
  return { buffer, filename: safeName(`${marketplace}_sellers_${tag}`) + ".xlsx" };
}

// ---------------------------------------------------------------------------
// Subcategory export
// ---------------------------------------------------------------------------
const SC_MAX_BRANDS = 150;
const SC_BRAND_PAGE = 100;
const SC_PRODUCTS_PER_BRAND = 1000;

export async function runSubcategoryExport(b: Record<string, unknown>): Promise<ExportResult> {
  if (b.subcategoryId === undefined || b.subcategoryId === null || b.subcategoryId === "") {
    throw new Error("subcategoryId is required");
  }
  const marketplace = parseMarketplace(b.marketplace as string) ?? "US";
  const subcategoryPath = (b.subcategoryPath as string) || String(b.subcategoryId);
  const catName = await categoryNamer(marketplace);

  const list: { brandId: number; brandName: string }[] = [];
  let page = 1;
  let total = Infinity;
  while (list.length < SC_MAX_BRANDS && (page - 1) * SC_BRAND_PAGE < total) {
    const res = mapSubcategoryBrands(
      await searchSubcategoryBrands({
        subcategoryId: b.subcategoryId as string | number,
        minRevenue: num(b.minRevenue as string),
        maxRevenue: num(b.maxRevenue as string),
        minAvgSellers: num(b.minAvgSellers as string),
        maxAvgSellers: num(b.maxAvgSellers as string),
        sortBy: (b.sortBy as string) || "revenue",
        sortDir: (b.sortDir as SortDir) || "desc",
        page,
        pageSize: SC_BRAND_PAGE,
        marketplace,
      }),
    ) as SubcategoryBrandsResponse;
    total = res.totalRowCount ?? res.returned;
    for (const r of res.brands) list.push({ brandId: r.brandId, brandName: r.brandName });
    if (res.returned < SC_BRAND_PAGE) break;
    page += 1;
  }
  const capped = list.slice(0, SC_MAX_BRANDS);

  const brands: RichSubcategoryBrand[] = [];
  const productsByBrand = new Map<number, Product[]>();
  for (const { brandId, brandName } of capped) {
    let rich: RichSubcategoryBrand;
    try {
      const br = mapBrands(await getBrand(brandName, marketplace)) as BrandsResponse;
      const match = br.brands.find((x) => x.brandId === brandId) ?? br.brands[0];
      rich = richFromBrand(match, brandId, brandName);
    } catch {
      rich = richFromBrand(null, brandId, brandName);
    }
    brands.push(rich);

    const pr = mapProducts(
      await getBrandProducts({ brandId, sortBy: "monthlyRevenueEstimate", sortDir: "desc", page: 1, pageSize: SC_PRODUCTS_PER_BRAND, marketplace }),
    ) as ProductsResponse;
    productsByBrand.set(brandId, pr.products);
  }

  const buffer = await buildSubcategoryWorkbook({ subcategoryPath, marketplace, brands, productsByBrand, catName });
  const leaf = subcategoryPath.split(">").pop()?.trim() || "subcategory";
  return { buffer, filename: safeName(`${marketplace}_${leaf}_brands`) + ".xlsx" };
}

// ---------------------------------------------------------------------------
// Brand export (single or bulk)
// ---------------------------------------------------------------------------
const BR_MAX_BRANDS = 50;
const BR_PRODUCTS_LIMIT = 1000;
const BR_SEARCH_TERMS_LIMIT = 1000;

interface BrandRef {
  brandId: number | string;
  brandName?: string;
}
interface Sections {
  overview?: boolean;
  products?: boolean;
  sellers?: boolean;
  searchTerms?: boolean;
  marketplaces?: boolean;
}

export async function runBrandExport(b: Record<string, unknown>): Promise<ExportResult> {
  const list: BrandRef[] = Array.isArray(b.brands)
    ? (b.brands as BrandRef[])
    : b.brandId !== undefined
      ? [{ brandId: b.brandId as number | string, brandName: b.brandName as string }]
      : [];
  if (list.length === 0) throw new Error("Provide at least one brand.");
  const sections: Sections = (b.sections as Sections) ?? {};
  if (!sections.overview && !sections.products && !sections.sellers && !sections.searchTerms && !sections.marketplaces) {
    throw new Error("Select at least one section to include.");
  }
  const marketplace = parseMarketplace(b.marketplace as string) ?? "US";
  const catName = await categoryNamer(marketplace);
  const refs = list.slice(0, BR_MAX_BRANDS);

  const entries: BrandReportEntry[] = [];
  for (const ref of refs) {
    const brandId = Number(ref.brandId);
    const brandName = ref.brandName || String(ref.brandId);
    const entry: BrandReportEntry = { brandId, brandName, brand: null, products: null, sellers: null, searchTerms: null, marketplaces: null };

    if (sections.overview) {
      try {
        const br = mapBrands(await getBrand(brandName, marketplace)) as BrandsResponse;
        const match = br.brands.find((x) => x.brandId === brandId) ?? br.brands[0];
        entry.brand = richFromBrand(match, brandId, brandName);
      } catch {
        entry.brand = richFromBrand(null, brandId, brandName);
      }
    }
    if (sections.products) {
      try {
        entry.products = (mapProducts(
          await getBrandProducts({ brandId, sortBy: "monthlyRevenueEstimate", sortDir: "desc", page: 1, pageSize: BR_PRODUCTS_LIMIT, marketplace }),
        ) as ProductsResponse).products;
      } catch {
        entry.products = [];
      }
    }
    if (sections.sellers) {
      try {
        entry.sellers = (mapBrandSellers(await getBrandSellers(brandId, marketplace)) as BrandSellersResponse).sellers;
      } catch {
        entry.sellers = [];
      }
    }
    if (sections.searchTerms) {
      try {
        entry.searchTerms = (mapBrandSearchTerms(
          await getBrandSearchTerms({ brandId, sortBy: "searchTerm.estimateSearches", sortDir: "desc", page: 1, pageSize: BR_SEARCH_TERMS_LIMIT, marketplace }),
        ) as SearchTermsResponse).searchTerms;
      } catch {
        entry.searchTerms = [];
      }
    }
    if (sections.marketplaces) {
      try {
        entry.marketplaces = (mapBrandMarketplaces(await getBrandMarketplaces({ brandId, marketplace })) as MarketplacesResponse).marketplaces;
      } catch {
        entry.marketplaces = [];
      }
    }
    entries.push(entry);
  }

  const buffer = await buildBrandWorkbook({
    marketplace,
    entries,
    sections: {
      overview: !!sections.overview,
      products: !!sections.products,
      sellers: !!sections.sellers,
      searchTerms: !!sections.searchTerms,
      marketplaces: !!sections.marketplaces,
    },
    catName,
  });
  const base = entries.length === 1 ? entries[0].brandName : `${entries.length}_brands`;
  return { buffer, filename: safeName(`${marketplace}_${base}_report`) + ".xlsx" };
}

export type ExportType = "seller-map" | "subcategory" | "brand";

export function runExport(type: ExportType, payload: Record<string, unknown>): Promise<ExportResult> {
  if (type === "seller-map") return runSellerMapExport(payload);
  if (type === "subcategory") return runSubcategoryExport(payload);
  if (type === "brand") return runBrandExport(payload);
  throw new Error(`Unknown export type: ${type}`);
}
