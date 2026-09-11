import { getConfig } from "./config.js";

export class SmartScoutError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "SmartScoutError";
    this.status = status;
    this.body = body;
  }
}

// --- rate limiter: serialize requests and enforce a minimum gap between them ---
let lastRequestAt = 0;
let tail: Promise<unknown> = Promise.resolve();

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const { minRequestIntervalMs } = getConfig();
  const run = async (): Promise<T> => {
    const wait = lastRequestAt + minRequestIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  };
  const result = tail.then(run, run);
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// --- core request -------------------------------------------------------------
interface RequestOptions {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  marketplace?: string;
  /** Skip the token requirement + Authorization header. For public catalog
   *  endpoints (categories, subcategories) that respond without a session. */
  noAuth?: boolean;
}

export async function smartscoutRequest<T = unknown>(opts: RequestOptions): Promise<T> {
  const cfg = getConfig();
  if (!opts.noAuth && !cfg.token) {
    throw new SmartScoutError(
      "SMARTSCOUT_TOKEN is not set. Capture a fresh session token from your logged-in SmartScout tab and put it in .env (see README -> 'Getting your token').",
    );
  }

  const url = new URL(cfg.baseUrl + opts.path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "User-Agent": cfg.userAgent,
    Accept: "application/json",
    Origin: cfg.origin,
    Referer: cfg.referer,
    "X-SmartScout-Marketplace": opts.marketplace ?? cfg.defaultMarketplace,
    ...cfg.extraHeaders,
  };
  if (cfg.token) headers[cfg.authHeader] = cfg.authPrefix + cfg.token;

  let bodyStr: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = cfg.contentType;
    bodyStr = JSON.stringify(opts.body);
  }

  const res = await schedule(() => fetch(url, { method: opts.method, headers, body: bodyStr }));

  if (res.status === 401 || res.status === 403) {
    throw new SmartScoutError(
      `SmartScout returned ${res.status}. Your session token is likely expired or invalid — capture a fresh one and update SMARTSCOUT_TOKEN (see README).`,
      res.status,
    );
  }

  const text = await res.text();
  if (!res.ok) {
    throw new SmartScoutError(
      `SmartScout request failed: ${res.status} ${res.statusText}`,
      res.status,
      text.slice(0, 2000),
    );
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SmartScoutError(
      "SmartScout returned a non-JSON response (often an auth/HTML redirect). Check your token, base URL, and headers.",
      res.status,
      text.slice(0, 2000),
    );
  }
}

// -----------------------------------------------------------------------------
// Grid search — SmartScout's list endpoints use an ag-Grid-style request body:
//   { loadDefaultData, requiresFilter, filter:{searchTexts:[{filter,type}], ...},
//     pageFilter:{startRow,endRow,includeTotalRowCount,sortModel,fields}, filterExclusions }
// Confirmed against a real /api/products/search capture. brands/sellers/searchterms
// reuse the same shape (paths marked TODO(capture) until confirmed).
// -----------------------------------------------------------------------------
export interface GridSearchArgs {
  query?: string;
  /** exact match ("equals") vs substring ("contains"). Default: contains. */
  exact?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  marketplace?: string;
  /** Extra filter keys merged into `filter` (for confirmed numeric filters). */
  rawFilter?: Record<string, unknown>;
  /** Columns to return; omit to let the server default. */
  fields?: string[];
}

function buildGridBody(a: GridSearchArgs): Record<string, unknown> {
  const page = a.page ?? 1;
  const pageSize = a.pageSize ?? 25;
  const startRow = (page - 1) * pageSize;
  const endRow = startRow + pageSize;
  const searchTexts = a.query
    ? [{ filter: a.query, type: a.exact ? "equals" : "contains" }]
    : [];
  const sortModel = a.sortBy ? [{ colId: a.sortBy, sort: a.sortDir ?? "desc" }] : [];

  const pageFilter: Record<string, unknown> = {
    startRow,
    endRow,
    includeTotalRowCount: true,
    sortModel,
  };
  if (a.fields) pageFilter.fields = a.fields;

  return {
    loadDefaultData: false,
    requiresFilter: false,
    filter: { searchTexts, ...(a.rawFilter ?? {}) },
    pageFilter,
    filterExclusions: false,
  };
}

// Fields confirmed present in the real /api/products/search response.
export const PRODUCT_FIELDS: string[] = [
  "imageUrl", "asin", "title", "monthlyRevenueEstimate", "monthlyUnitsSold", "rank",
  "subcategoryRank", "momGrowth", "opportunityScore", "buyBoxPrice", "numberFbaSellers",
  "amazonIsr", "totalRatings", "reviewRating", "parentAsin", "returnRate", "note",
  "productPageScore", "brandName", "ttm", "ttmUnits", "categoryId",
  "subcategory.subcategoryContextName", "momGrowth12", "buyBoxEquity", "numberOfItems",
  "numberOfSellers", "ttmPrev", "reviewCount", "amzMonthlySold", "isVariation",
  "competitivePriceThreshold", "isSns", "unitValue", "unitType", "eachUnitCount",
  "itemHighlights", "upc", "manufacturer", "partNumber", "model", "inStockRate90Day",
  "buyBoxSuppression45Day", "hasAPlus", "hasVideo", "listedSince", "brandId", "outOfStockNow",
];

// --- products (CONFIRMED) ---
export function searchProducts(a: GridSearchArgs): Promise<unknown> {
  return smartscoutRequest({
    method: "POST",
    path: "/api/products/search",
    marketplace: a.marketplace,
    body: buildGridBody({ ...a, fields: a.fields ?? PRODUCT_FIELDS }),
  });
}

export function getProduct(asin: string, marketplace?: string): Promise<unknown> {
  return searchProducts({ query: asin, exact: true, pageSize: 1, marketplace });
}

// All products (ASINs) for a brand. CONFIRMED: products/search with filter { brandId }.
export interface BrandProductsArgs {
  brandId: number | string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  marketplace?: string;
  fields?: string[];
}

export function getBrandProducts(a: BrandProductsArgs): Promise<unknown> {
  const page = a.page ?? 1;
  const pageSize = a.pageSize ?? 50;
  const startRow = (page - 1) * pageSize;
  const endRow = startRow + pageSize;
  const sortModel = a.sortBy ? [{ colId: a.sortBy, sort: a.sortDir ?? "desc" }] : [];
  return smartscoutRequest({
    method: "POST",
    path: "/api/products/search",
    marketplace: a.marketplace,
    body: {
      loadDefaultData: false,
      requiresFilter: false,
      filter: { brandId: Number(a.brandId) },
      pageFilter: {
        startRow,
        endRow,
        includeTotalRowCount: true,
        sortModel,
        fields: a.fields ?? PRODUCT_FIELDS,
      },
      filterExclusions: false,
    },
  });
}

// Fields confirmed present in the real /api/brands/search response.
export const BRAND_FIELDS: string[] = [
  "note", "name", "brandScore", "primaryCategoryId", "primarySubcategory.subcategoryContextName",
  "monthlyRevenue", "ttm", "avgPrice", "avgVolume", "avgFbaSellers", "avgSellers",
  "dominantSeller.name", "dominantSeller.country", "dominantSellerBrandCoverage",
  "monthlyUnitsSold", "amazonIsr", "reviewRating", "totalReviews", "momGrowth", "momGrowth12",
  "totalProducts", "hasStorefront", "avgInStockRate90Day", "avgBuyBoxSuppression45Day",
  "totalEstFbaFees30Day", "id", "storefrontUrl", "dominantSeller.amazonSellerId",
];

// --- brands (CONFIRMED) ---
export function searchBrands(a: GridSearchArgs): Promise<unknown> {
  return smartscoutRequest({
    method: "POST",
    path: "/api/brands/search",
    marketplace: a.marketplace,
    body: buildGridBody({ ...a, fields: a.fields ?? BRAND_FIELDS }),
  });
}

export function getBrand(idOrName: string, marketplace?: string): Promise<unknown> {
  return searchBrands({ query: idOrName, exact: true, pageSize: 1, marketplace });
}

// A brand's stats across every Amazon marketplace. CONFIRMED against
// /api/brands/by-brand-marketplaces. Body { brandId, pageFilter:{fields} };
// response is a bare ARRAY (one row per marketplaceId).
export const BRAND_MARKETPLACE_FIELDS: string[] = [
  "name", "marketplaceId", "monthlyRevenue", "monthlyUnitsSold", "amazonIsr", "avgSellers",
  "avgFbaSellers", "brandScore", "totalProducts", "numberOos", "reviewRating",
];

export interface BrandMarketplacesArgs {
  brandId: number | string;
  marketplace?: string;
  fields?: string[];
}

export function getBrandMarketplaces(a: BrandMarketplacesArgs): Promise<unknown> {
  return smartscoutRequest({
    method: "POST",
    path: "/api/brands/by-brand-marketplaces",
    marketplace: a.marketplace,
    body: {
      brandId: Number(a.brandId),
      pageFilter: { fields: a.fields ?? BRAND_MARKETPLACE_FIELDS },
    },
  });
}

// Fields confirmed present in the real /api/subcategories/brands response.
export const SUBCATEGORY_BRAND_FIELDS: string[] = [
  "brandName", "revenue", "marketshare", "moMMktShareChange", "brand.dominantSeller.country",
  "avgNumberSellers", "avgVolume", "totalNumberUnitsSold", "numberASINs", "totalReviews",
  "avgReviews", "reviewRating", "avgPageScore", "avgPrice",
];

export interface SubcategoryBrandsArgs {
  subcategoryId: number | string;
  minRevenue?: number;
  maxRevenue?: number;
  minAvgSellers?: number;
  maxAvgSellers?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  marketplace?: string;
  /** Extra confirmed filter keys merged into `filter` (all numeric ones use { min, max }). */
  rawFilter?: Record<string, unknown>;
  fields?: string[];
}

// Brands within a subcategory with numeric range filters. CONFIRMED against
// /api/subcategories/brands. Numeric filters use { min, max } (null = open-ended);
// the category is required as subcategoryId: { filter: <id> }.
export function searchSubcategoryBrands(a: SubcategoryBrandsArgs): Promise<unknown> {
  const page = a.page ?? 1;
  const pageSize = a.pageSize ?? 50;
  const startRow = (page - 1) * pageSize;
  const endRow = startRow + pageSize;
  const sortModel = a.sortBy ? [{ colId: a.sortBy, sort: a.sortDir ?? "desc" }] : [];

  const filter: Record<string, unknown> = {
    subcategoryId: { filter: Number(a.subcategoryId) },
  };
  if (a.minRevenue !== undefined || a.maxRevenue !== undefined) {
    filter.revenue = { min: a.minRevenue ?? null, max: a.maxRevenue ?? null };
  }
  if (a.minAvgSellers !== undefined || a.maxAvgSellers !== undefined) {
    filter.avgNumberSellers = { min: a.minAvgSellers ?? null, max: a.maxAvgSellers ?? null };
  }
  Object.assign(filter, a.rawFilter ?? {});

  return smartscoutRequest({
    method: "POST",
    path: "/api/subcategories/brands",
    marketplace: a.marketplace,
    body: {
      loadDefaultData: false,
      filter,
      pageFilter: {
        startRow,
        endRow,
        includeTotalRowCount: true,
        sortModel,
        fields: a.fields ?? SUBCATEGORY_BRAND_FIELDS,
      },
    },
  });
}

// --- sellers (TODO(capture): confirm path + response shape) ---
export function searchSellers(a: GridSearchArgs): Promise<unknown> {
  return smartscoutRequest({
    method: "POST",
    path: "/api/sellers/search", // TODO(capture)
    marketplace: a.marketplace,
    body: buildGridBody(a),
  });
}

export function getSeller(sellerId: string, marketplace?: string): Promise<unknown> {
  return searchSellers({ query: sellerId, exact: true, pageSize: 1, marketplace });
}

// --- brand search terms ("ranking keywords" for a brand, CONFIRMED) ---
// Endpoint /api/search-terms/search-term-brands. Body filters by brandId; response is
// { payload: [{ searchTerm: {...}, topSpotWinRate, ...adSpend }], pageInfo }.
export const SEARCH_TERM_BRAND_FIELDS: string[] = [
  "searchTerm.searchTermValue", "searchTerm.estimateSearches", "searchTerm.totalKeywordSales",
  "topSpotWinRate", "topGroupWinRate", "sponsoredBrandWinRate", "sponsoredVideoWinRate",
  "topSpotSpend", "topGroupSpend", "sponsoredBrandSpend", "sponsoredVideoSpend", "totalAdSpend",
  "searchTerm.launchVelocity", "searchTerm.opportunityScore", "searchTerm.searchResultsCount",
  "sponsoredProducts", "searchTerm.estimatedCpc", "searchTerm.cpcRangeStart", "searchTerm.cpcRangeEnd",
];

export interface BrandSearchTermsArgs {
  brandId: number | string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  marketplace?: string;
  fields?: string[];
}

export function getBrandSearchTerms(a: BrandSearchTermsArgs): Promise<unknown> {
  const page = a.page ?? 1;
  const pageSize = a.pageSize ?? 50;
  const startRow = (page - 1) * pageSize;
  const endRow = startRow + pageSize;
  const sortModel = a.sortBy ? [{ colId: a.sortBy, sort: a.sortDir ?? "desc" }] : [];
  return smartscoutRequest({
    method: "POST",
    path: "/api/search-terms/search-term-brands",
    marketplace: a.marketplace,
    body: {
      filter: { brandId: Number(a.brandId) },
      pageFilter: {
        startRow,
        endRow,
        includeTotalRowCount: true,
        sortModel,
        fields: a.fields ?? SEARCH_TERM_BRAND_FIELDS,
      },
    },
  });
}

// --- brand -> sellers ("brand coverage", CONFIRMED) ---
// Lists the sellers carrying a brand and each one's share. Body is just { brandId }.
// Response is { payload: [...] } with no pageInfo.
export function getBrandSellers(brandId: string | number, marketplace?: string): Promise<unknown> {
  const id = typeof brandId === "string" ? Number(brandId) : brandId;
  return smartscoutRequest({
    method: "POST",
    path: "/api/brandcoverage/search",
    marketplace,
    body: { brandId: id },
  });
}

// --- seller -> brands ("brand coverage" by seller, CONFIRMED) ---
// Same /api/brandcoverage/search endpoint as getBrandSellers, but keyed by sellerId:
// returns the brands a seller carries (brandId, brandName, revenue, offers, coverage %),
// sorted by revenue desc. Response is { payload: [...] } with no pageInfo.
export function getSellerBrands(sellerId: string | number, marketplace?: string): Promise<unknown> {
  const id = typeof sellerId === "string" ? Number(sellerId) : sellerId;
  return smartscoutRequest({
    method: "POST",
    path: "/api/brandcoverage/search",
    marketplace,
    body: { sellerId: id },
  });
}

// --- seller map ("brand/seller universe" by category + type + revenue, CONFIRMED) ---
// Flat filter body (NOT the ag-Grid wrapper); monthlyRevenue min/max are STRINGS.
// Response is a bare ARRAY of { id, name, estimateSales, geoLocation, sellerTypeId },
// sorted by estimateSales desc and capped at maxCount.
export interface SellerMapArgs {
  categoryId?: number | string;
  sellerTypeId?: string;
  minRevenue?: number;
  maxRevenue?: number;
  sellerName?: string;
  maxCount?: number;
  marketplace?: string;
}

export function sellerMapSearch(a: SellerMapArgs): Promise<unknown> {
  const body: Record<string, unknown> = {
    loadDefaultData: false,
    maxCount: a.maxCount ?? 100,
    sellerName: a.sellerName ?? null,
  };
  if (a.categoryId !== undefined) body.categoryId = Number(a.categoryId);
  if (a.sellerTypeId !== undefined) body.sellerTypeId = a.sellerTypeId;
  if (a.minRevenue !== undefined || a.maxRevenue !== undefined) {
    body.monthlyRevenue = {
      min: a.minRevenue !== undefined ? String(a.minRevenue) : null,
      max: a.maxRevenue !== undefined ? String(a.maxRevenue) : null,
    };
  }
  return smartscoutRequest({
    method: "POST",
    path: "/api/sellermaps/search",
    marketplace: a.marketplace,
    body,
  });
}

// --- catalogs (CONFIRMED; PUBLIC — respond without a session token) ---
// Categories: GET /api/categories -> { categories: [{ id, name, nodeId }] }.
// `id` is SmartScout's categoryId (matches primaryCategoryId and seller_map's categoryId).
export function listCategories(marketplace?: string): Promise<unknown> {
  return smartscoutRequest({
    method: "GET",
    path: "/api/categories",
    marketplace,
    noAuth: true,
  });
}

// Subcategories: POST /api/subcategories/search (ag-Grid body) -> { payload: [...], pageInfo }.
// Returns the full flat tree (~31k rows). `id` is the Amazon browse-node id used as
// subcategoryId by searchSubcategoryBrands; server-side name filtering is not supported,
// so callers fetch the whole catalog once and filter locally.
export const SUBCATEGORY_FIELDS: string[] = [
  "id", "subcategoryName", "subcategoryContextName", "parentId", "level", "isLeafNode",
  "isParent", "totalMonthlyRevenue", "totalBrands",
];

export function listSubcategories(marketplace?: string): Promise<unknown> {
  return smartscoutRequest({
    method: "POST",
    path: "/api/subcategories/search",
    marketplace,
    noAuth: true,
    body: {
      loadDefaultData: false,
      requiresFilter: false,
      filter: { searchTexts: [] },
      pageFilter: {
        startRow: 0,
        endRow: 40000,
        includeTotalRowCount: true,
        sortModel: [],
        fields: SUBCATEGORY_FIELDS,
      },
      filterExclusions: false,
    },
  });
}
