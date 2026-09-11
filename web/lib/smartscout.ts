// Server-only data layer. Re-exports the SmartScout client + mappers from the
// workspace package and wraps calls with consistent error handling.
// NOTE: importing this from client components would leak the token path — keep it
// to route handlers / server code only.
import "server-only";

import {
  SmartScoutError,
  searchProducts,
  getProduct,
  getBrandProducts,
  searchBrands,
  getBrand,
  getBrandMarketplaces,
  searchSubcategoryBrands,
  getBrandSellers,
  getSellerBrands,
  sellerMapSearch,
  getBrandSearchTerms,
  listCategories,
  listSubcategories,
} from "smartscout-mcp/client";
import {
  mapProducts,
  mapBrands,
  mapBrandMarketplaces,
  mapSubcategoryBrands,
  mapSubcategoryBrandsRich,
  mapBrandSellers,
  mapSellerBrands,
  mapSellerMap,
  mapBrandSearchTerms,
  mapCategories,
  mapSubcategories,
} from "smartscout-mcp/map";

export {
  SmartScoutError,
  searchProducts,
  getProduct,
  getBrandProducts,
  searchBrands,
  getBrand,
  getBrandMarketplaces,
  searchSubcategoryBrands,
  getBrandSellers,
  getSellerBrands,
  sellerMapSearch,
  getBrandSearchTerms,
  listCategories,
  listSubcategories,
  mapProducts,
  mapBrands,
  mapBrandMarketplaces,
  mapSubcategoryBrands,
  mapSubcategoryBrandsRich,
  mapBrandSellers,
  mapSellerBrands,
  mapSellerMap,
  mapBrandSearchTerms,
  mapCategories,
  mapSubcategories,
};

export interface ApiError {
  error: string;
  status: number;
  /** true when the session token is expired/invalid and must be re-captured. */
  tokenExpired?: boolean;
}

/** Runs a SmartScout call, maps the raw response, and normalizes failures into
 *  an { ok, data } | { ok:false, error } union the route handlers turn into JSON. */
export async function run<T>(
  call: () => Promise<unknown>,
  map: (raw: unknown) => T,
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const raw = await call();
    return { ok: true, data: map(raw) };
  } catch (err) {
    return { ok: false, error: toApiError(err) };
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof SmartScoutError) {
    const status = err.status ?? 500;
    const tokenExpired = status === 401 || status === 403 || !err.status && /token/i.test(err.message);
    return {
      error: err.message + (err.body ? `\n\n${err.body}` : ""),
      status: status === 401 || status === 403 ? status : tokenExpired ? 401 : status,
      tokenExpired,
    };
  }
  if (err instanceof Error) return { error: err.message, status: 500 };
  return { error: String(err), status: 500 };
}
