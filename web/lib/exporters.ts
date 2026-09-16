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
import { getCategories, getSubcategoryDescendants, fullPathOf } from "@/lib/catalog";
import { richFromBrand } from "@/lib/brand-rich";
import {
  buildSellerMapWorkbook,
  buildSubcategoryWorkbook,
  buildSubcategoryBulkWorkbook,
  buildBrandWorkbook,
  type SellerBlock,
  type BrandReportEntry,
  type BulkSubcategoryEntry,
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
// The seller-map UI now paginates and exports ONE page at a time (≤ SM_PAGE_SELLERS
// sellers), so a page export stays small and can't be blocked for heavy load.
// Every brand NAME of every seller is always listed (one brandcoverage call per
// seller — cheap). Only the deep product/marketplace enrichment is budget-capped.
const SM_PAGE_SELLERS = 60; // hard ceiling on sellers per export (one page)
const SM_DETAIL_BRANDS = 200; // brands (across the page) that get product/marketplace detail
const SM_PRODUCTS_PER_BRAND = 1000;

export async function runSellerMapExport(b: Record<string, unknown>): Promise<ExportResult> {
  const marketplace = parseMarketplace(b.marketplace as string) ?? "US";
  const catName = await categoryNamer(marketplace);

  // Page mode: the client sends the exact sellers shown on the current page.
  // Fallback mode (direct API use, no `sellers`): re-run the search ourselves.
  const provided = Array.isArray(b.sellers) ? (b.sellers as MapSeller[]) : null;
  let sellers: MapSeller[];
  if (provided && provided.length > 0) {
    sellers = provided.slice(0, SM_PAGE_SELLERS);
  } else {
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
    sellers = smRes.sellers.slice(0, SM_PAGE_SELLERS);
  }

  const blocks: SellerBlock[] = [];
  let detailBudget = SM_DETAIL_BRANDS;
  for (const seller of sellers) {
    // One call per seller → EVERY brand it carries (names + coverage). Cheap.
    let allBrands: SellerBrand[] = [];
    try {
      const sb = mapSellerBrands(await getSellerBrands(seller.sellerId, marketplace)) as SellerBrandsResponse;
      allBrands = sb.brands;
    } catch {
      allBrands = [];
    }

    const detail: SellerBlock["detail"] = [];
    for (const coverage of allBrands) {
      if (detailBudget <= 0) break;
      detailBudget -= 1;

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
      detail.push({ coverage, brand, products, marketplaces });
    }
    blocks.push({ seller, allBrands, detail });
  }

  const parts: string[] = [];
  if (b.categoryName) parts.push(`Category: ${b.categoryName}`);
  if (b.sellerTypeId) parts.push(`Type: ${b.sellerTypeId}`);
  if (b.minRevenue || b.maxRevenue) parts.push(`Revenue: ${b.minRevenue ?? "0"}-${b.maxRevenue ?? "max"}`);
  if (b.sellerName) parts.push(`Name: ${b.sellerName}`);
  const pageNum = num(b.page as string);
  if (pageNum) parts.push(`Page ${pageNum}`);

  const detailNote =
    detailBudget <= 0
      ? `Every brand name is listed. Product & marketplace detail is capped at the first ${SM_DETAIL_BRANDS} brands on this page.`
      : undefined;

  const buffer = await buildSellerMapWorkbook({
    marketplace,
    filterSummary: parts.join(" · "),
    sellers: blocks,
    catName,
    detailNote,
  });
  const tag = (b.categoryName || "all").toString();
  const pageTag = pageNum ? `_p${pageNum}` : "";
  return { buffer, filename: safeName(`${marketplace}_sellers_${tag}${pageTag}`) + ".xlsx" };
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
// Bulk subcategory export — all subcategories under a branch / whole category.
// Brands-level only: one paged call per subcategory (cheap). A whole category can
// be hundreds of subcategories, so this runs as a background job and is capped.
// ---------------------------------------------------------------------------
const SCB_MAX_SUBCATS = 500; // hard ceiling on subcategories per bulk export
const SCB_DEFAULT_BRANDS_PER_SUBCAT = 100;
const SCB_MAX_BRANDS_PER_SUBCAT = 500;

export async function runSubcategoryBulkExport(b: Record<string, unknown>): Promise<ExportResult> {
  const nodeId = num(b.nodeId as string);
  if (nodeId === undefined) throw new Error("nodeId is required");
  const marketplace = parseMarketplace(b.marketplace as string) ?? "US";

  const { node, leaves } = await getSubcategoryDescendants(marketplace, nodeId);
  if (!node) throw new Error("Unknown subcategory node");
  if (leaves.length === 0) throw new Error("No selectable subcategories under this branch.");

  const branchPath = fullPathOf(node);
  const brandsPerSub = Math.min(
    num(b.brandsPerSubcategory as string) ?? SCB_DEFAULT_BRANDS_PER_SUBCAT,
    SCB_MAX_BRANDS_PER_SUBCAT,
  );
  const totalSubcats = leaves.length;
  const selected = leaves.slice(0, SCB_MAX_SUBCATS); // already revenue-sorted desc

  const minRevenue = num(b.minRevenue as string);
  const maxRevenue = num(b.maxRevenue as string);
  const minAvgSellers = num(b.minAvgSellers as string);
  const maxAvgSellers = num(b.maxAvgSellers as string);
  const sortBy = (b.sortBy as string) || "revenue";
  const sortDir = (b.sortDir as SortDir) || "desc";

  const entries: BulkSubcategoryEntry[] = [];
  for (const leaf of selected) {
    let res: SubcategoryBrandsResponse | null = null;
    try {
      res = mapSubcategoryBrands(
        await searchSubcategoryBrands({
          subcategoryId: leaf.id,
          minRevenue,
          maxRevenue,
          minAvgSellers,
          maxAvgSellers,
          sortBy,
          sortDir,
          page: 1,
          pageSize: brandsPerSub,
          marketplace,
        }),
      ) as SubcategoryBrandsResponse;
    } catch {
      res = null;
    }
    entries.push({
      subcategoryId: leaf.id,
      subcategoryPath: fullPathOf(leaf),
      totalMonthlyRevenue: leaf.totalMonthlyRevenue,
      totalBrands: leaf.totalBrands,
      totalRowCount: res?.totalRowCount ?? null,
      brands: res?.brands ?? [],
    });
  }

  const parts: string[] = [];
  if (minRevenue || maxRevenue) parts.push(`Revenue: ${minRevenue ?? "0"}-${maxRevenue ?? "max"}`);
  if (minAvgSellers || maxAvgSellers) parts.push(`Avg sellers: ${minAvgSellers ?? "0"}-${maxAvgSellers ?? "max"}`);

  const buffer = await buildSubcategoryBulkWorkbook({
    branchPath,
    marketplace,
    filterSummary: parts.join(" · "),
    entries,
    totalSubcats,
    truncatedSubcats: totalSubcats > SCB_MAX_SUBCATS,
    brandsPerSubcategory: brandsPerSub,
  });
  const leafName = node.name || `node_${nodeId}`;
  return { buffer, filename: safeName(`${marketplace}_${leafName}_bulk_brands`) + ".xlsx" };
}

// ---------------------------------------------------------------------------
// Brand export (single or bulk)
// ---------------------------------------------------------------------------
const BR_MAX_BRANDS = 250;
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

export type ExportType = "seller-map" | "subcategory" | "subcategory-bulk" | "brand";

export function runExport(type: ExportType, payload: Record<string, unknown>): Promise<ExportResult> {
  if (type === "seller-map") return runSellerMapExport(payload);
  if (type === "subcategory") return runSubcategoryExport(payload);
  if (type === "subcategory-bulk") return runSubcategoryBulkExport(payload);
  if (type === "brand") return runBrandExport(payload);
  throw new Error(`Unknown export type: ${type}`);
}
