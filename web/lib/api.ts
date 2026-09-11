// Client-side fetch helpers. All calls go to /api/* (same origin) — the token
// lives only on the server, never here.
import type {
  Marketplace,
  SortDir,
  SubcategoryBrandsResponse,
  ProductsResponse,
  MarketplacesResponse,
  BrandSellersResponse,
  SellerMapResponse,
  SearchTermsResponse,
  BrandsResponse,
  CategoriesResponse,
  SubcategoriesResponse,
  SellerBrandsResponse,
} from "./types";

export class ApiFetchError extends Error {
  status: number;
  tokenExpired: boolean;
  constructor(message: string, status: number, tokenExpired: boolean) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
    this.tokenExpired = tokenExpired;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiFetchError(
      body?.error || `Request failed (${res.status})`,
      res.status,
      Boolean(body?.tokenExpired) || res.status === 401 || res.status === 403,
    );
  }
  return body as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export interface SubcategoryBrandsInput {
  subcategoryId: string | number;
  minRevenue?: number;
  maxRevenue?: number;
  minAvgSellers?: number;
  maxAvgSellers?: number;
  sortBy?: string;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
  marketplace?: Marketplace;
}

export function fetchSubcategoryBrands(
  input: SubcategoryBrandsInput,
): Promise<SubcategoryBrandsResponse> {
  return fetch("/api/subcategory/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<SubcategoryBrandsResponse>(r));
}

export interface SellerMapInput {
  categoryId?: string | number;
  sellerTypeId?: string;
  minRevenue?: number;
  maxRevenue?: number;
  sellerName?: string;
  maxCount?: number;
  marketplace?: Marketplace;
}

export function fetchSellerMap(input: SellerMapInput): Promise<SellerMapResponse> {
  return fetch("/api/seller-map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<SellerMapResponse>(r));
}

export function fetchBrandProducts(
  brandId: number | string,
  opts: { sortBy?: string; sortDir?: SortDir; page?: number; pageSize?: number; marketplace?: Marketplace } = {},
): Promise<ProductsResponse> {
  return fetch(`/api/brands/${brandId}/products${qs(opts)}`).then((r) => handle<ProductsResponse>(r));
}

export function fetchBrandMarketplaces(
  brandId: number | string,
  marketplace?: Marketplace,
): Promise<MarketplacesResponse> {
  return fetch(`/api/brands/${brandId}/marketplaces${qs({ marketplace })}`).then((r) =>
    handle<MarketplacesResponse>(r),
  );
}

export function fetchBrandSellers(
  brandId: number | string,
  marketplace?: Marketplace,
): Promise<BrandSellersResponse> {
  return fetch(`/api/brands/${brandId}/sellers${qs({ marketplace })}`).then((r) =>
    handle<BrandSellersResponse>(r),
  );
}

export function fetchBrandSearchTerms(
  brandId: number | string,
  opts: { sortBy?: string; sortDir?: SortDir; page?: number; pageSize?: number; marketplace?: Marketplace } = {},
): Promise<SearchTermsResponse> {
  return fetch(`/api/brands/${brandId}/search-terms${qs(opts)}`).then((r) =>
    handle<SearchTermsResponse>(r),
  );
}

async function downloadXlsx(url: string, body: unknown, fallbackName: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiFetchError(
      err?.error || `Export failed (${res.status})`,
      res.status,
      Boolean(err?.tokenExpired) || res.status === 401 || res.status === 403,
    );
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const name = m?.[1] || fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export interface ExportSubcategoryInput extends SubcategoryBrandsInput {
  subcategoryPath?: string;
}

export function exportSubcategoryXlsx(input: ExportSubcategoryInput): Promise<void> {
  return downloadXlsx("/api/export/subcategory", input, "subcategory_brands.xlsx");
}

export interface ExportSellerMapInput extends SellerMapInput {
  categoryName?: string;
}

export function exportSellerMapXlsx(input: ExportSellerMapInput): Promise<void> {
  return downloadXlsx("/api/export/seller-map", input, "sellers.xlsx");
}

export interface BrandExportSections {
  overview: boolean;
  products: boolean;
  sellers: boolean;
  searchTerms: boolean;
  marketplaces: boolean;
}

export interface ExportBrandInput {
  brandId: number | string;
  brandName: string;
  marketplace?: Marketplace;
  sections: BrandExportSections;
}

export function exportBrandXlsx(input: ExportBrandInput): Promise<void> {
  return downloadXlsx("/api/export/brand", input, "brand_report.xlsx");
}

export function fetchSellerBrands(
  sellerId: number | string,
  marketplace?: Marketplace,
  limit?: number,
): Promise<SellerBrandsResponse> {
  return fetch(`/api/sellers/${sellerId}/brands${qs({ marketplace, limit })}`).then((r) =>
    handle<SellerBrandsResponse>(r),
  );
}

export function fetchCategories(marketplace?: Marketplace): Promise<CategoriesResponse> {
  return fetch(`/api/categories${qs({ marketplace })}`).then((r) => handle<CategoriesResponse>(r));
}

export function fetchSubcategories(
  q: string,
  marketplace?: Marketplace,
  limit?: number,
): Promise<SubcategoriesResponse> {
  return fetch(`/api/subcategories${qs({ q, marketplace, limit })}`).then((r) =>
    handle<SubcategoriesResponse>(r),
  );
}

export function fetchBrandsSearch(
  opts: { query?: string; sortBy?: string; sortDir?: SortDir; page?: number; pageSize?: number; marketplace?: Marketplace } = {},
): Promise<BrandsResponse> {
  return fetch(`/api/brands/search${qs(opts)}`).then((r) => handle<BrandsResponse>(r));
}
