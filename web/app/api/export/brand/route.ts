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
import { buildBrandWorkbook } from "@/lib/export";
import { parseMarketplace } from "@/lib/respond";
import type {
  RichSubcategoryBrand,
  BrandsResponse,
  Product,
  ProductsResponse,
  BrandSeller,
  BrandSellersResponse,
  BrandSearchTerm,
  SearchTermsResponse,
  BrandMarketplace,
  MarketplacesResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRODUCTS_LIMIT = 1000;
const SEARCH_TERMS_LIMIT = 1000;

interface Sections {
  overview?: boolean;
  products?: boolean;
  sellers?: boolean;
  searchTerms?: boolean;
  marketplaces?: boolean;
}

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  if (b.brandId === undefined || b.brandId === null || b.brandId === "") {
    return Response.json({ error: "brandId is required", status: 400 }, { status: 400 });
  }
  const sections: Sections = b.sections ?? {};
  if (!sections.overview && !sections.products && !sections.sellers && !sections.searchTerms && !sections.marketplaces) {
    return Response.json({ error: "Select at least one section to include.", status: 400 }, { status: 400 });
  }
  const marketplace = parseMarketplace(b.marketplace) ?? "US";
  const brandId = b.brandId as number | string;
  const brandName = (b.brandName as string) || String(brandId);

  try {
    const cats = await getCategories(marketplace);
    const catById = new Map(cats.map((c) => [c.id, c.name]));
    const catName = (id: number | null) => (id != null ? catById.get(id) ?? String(id) : "");

    let overview: RichSubcategoryBrand | null = null;
    if (sections.overview) {
      try {
        const br = mapBrands(await getBrand(brandName, marketplace)) as BrandsResponse;
        const match = br.brands.find((x) => x.brandId === Number(brandId)) ?? br.brands[0];
        overview = richFromBrand(match, Number(brandId), brandName);
      } catch {
        overview = richFromBrand(null, Number(brandId), brandName);
      }
    }

    let products: Product[] | null = null;
    if (sections.products) {
      products = (mapProducts(
        await getBrandProducts({
          brandId,
          sortBy: "monthlyRevenueEstimate",
          sortDir: "desc",
          page: 1,
          pageSize: PRODUCTS_LIMIT,
          marketplace,
        }),
      ) as ProductsResponse).products;
    }

    let sellers: BrandSeller[] | null = null;
    if (sections.sellers) {
      sellers = (mapBrandSellers(await getBrandSellers(brandId, marketplace)) as BrandSellersResponse).sellers;
    }

    let searchTerms: BrandSearchTerm[] | null = null;
    if (sections.searchTerms) {
      searchTerms = (mapBrandSearchTerms(
        await getBrandSearchTerms({
          brandId,
          sortBy: "searchTerm.estimateSearches",
          sortDir: "desc",
          page: 1,
          pageSize: SEARCH_TERMS_LIMIT,
          marketplace,
        }),
      ) as SearchTermsResponse).searchTerms;
    }

    let marketplaces: BrandMarketplace[] | null = null;
    if (sections.marketplaces) {
      marketplaces = (mapBrandMarketplaces(
        await getBrandMarketplaces({ brandId, marketplace }),
      ) as MarketplacesResponse).marketplaces;
    }

    const buf = await buildBrandWorkbook({
      marketplace,
      brandName,
      overview,
      products,
      sellers,
      searchTerms,
      marketplaces,
      catName,
    });

    const fname = `${marketplace}_${brandName}_report`.replace(/[^A-Za-z0-9._-]+/g, "_") + ".xlsx";
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
