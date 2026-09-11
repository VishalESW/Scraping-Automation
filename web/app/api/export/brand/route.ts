import {
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
  toApiError,
} from "@/lib/smartscout";
import { getCategories } from "@/lib/catalog";
import { richFromBrand } from "@/lib/brand-rich";
import { buildBrandWorkbook, type BrandReportEntry } from "@/lib/export";
import { parseMarketplace } from "@/lib/respond";
import type {
  BrandsResponse,
  ProductsResponse,
  BrandSellersResponse,
  SearchTermsResponse,
  MarketplacesResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bulk: up to ~5 calls per brand, paced by the shared rate limiter.
export const maxDuration = 1800;

const MAX_BRANDS = 50;
const PRODUCTS_LIMIT = 1000;
const SEARCH_TERMS_LIMIT = 1000;

interface Sections {
  overview?: boolean;
  products?: boolean;
  sellers?: boolean;
  searchTerms?: boolean;
  marketplaces?: boolean;
}

interface BrandRef {
  brandId: number | string;
  brandName?: string;
}

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  // accept either a single {brandId, brandName} or a list {brands:[...]}
  const list: BrandRef[] = Array.isArray(b.brands)
    ? b.brands
    : b.brandId !== undefined
      ? [{ brandId: b.brandId, brandName: b.brandName }]
      : [];
  if (list.length === 0) {
    return Response.json({ error: "Provide at least one brand.", status: 400 }, { status: 400 });
  }
  const sections: Sections = b.sections ?? {};
  if (!sections.overview && !sections.products && !sections.sellers && !sections.searchTerms && !sections.marketplaces) {
    return Response.json({ error: "Select at least one section to include.", status: 400 }, { status: 400 });
  }
  const marketplace = parseMarketplace(b.marketplace) ?? "US";
  const refs = list.slice(0, MAX_BRANDS);

  try {
    const cats = await getCategories(marketplace);
    const catById = new Map(cats.map((c) => [c.id, c.name]));
    const catName = (id: number | null) => (id != null ? catById.get(id) ?? String(id) : "");

    const entries: BrandReportEntry[] = [];
    for (const ref of refs) {
      const brandId = Number(ref.brandId);
      const brandName = ref.brandName || String(ref.brandId);
      const entry: BrandReportEntry = {
        brandId,
        brandName,
        brand: null,
        products: null,
        sellers: null,
        searchTerms: null,
        marketplaces: null,
      };

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
            await getBrandProducts({ brandId, sortBy: "monthlyRevenueEstimate", sortDir: "desc", page: 1, pageSize: PRODUCTS_LIMIT, marketplace }),
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
            await getBrandSearchTerms({ brandId, sortBy: "searchTerm.estimateSearches", sortDir: "desc", page: 1, pageSize: SEARCH_TERMS_LIMIT, marketplace }),
          ) as SearchTermsResponse).searchTerms;
        } catch {
          entry.searchTerms = [];
        }
      }
      if (sections.marketplaces) {
        try {
          entry.marketplaces = (mapBrandMarketplaces(
            await getBrandMarketplaces({ brandId, marketplace }),
          ) as MarketplacesResponse).marketplaces;
        } catch {
          entry.marketplaces = [];
        }
      }
      entries.push(entry);
    }

    const buf = await buildBrandWorkbook({
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

    const base =
      entries.length === 1 ? entries[0].brandName : `${entries.length}_brands`;
    const fname = `${marketplace}_${base}_report`.replace(/[^A-Za-z0-9._-]+/g, "_") + ".xlsx";
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
