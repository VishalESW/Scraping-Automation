import "server-only";
import {
  searchSubcategoryBrands,
  mapSubcategoryBrands,
  getBrandSellers,
  mapBrandSellers,
  getBrand,
  mapBrands,
  getBrandProducts,
  mapProducts,
} from "@/lib/smartscout";
import { getSubcategoryDescendants, fullPathOf, getCategories } from "@/lib/catalog";
import { richFromBrand } from "@/lib/brand-rich";
import { summarizeSellers } from "@/lib/sole-seller";
import { BRAND_HEADERS, brandRow, productRow, type Cell } from "@/lib/export";
import { getLastRow, updateRows } from "@/lib/google-sheets";
import type {
  SubcategoryBrandsResponse,
  BrandsResponse,
  ProductsResponse,
  BrandSellersResponse,
  RichSubcategoryBrand,
  Product,
} from "@/lib/types";

// Fixed rules for the automated sheet fill (per the user's spec).
const MARKETPLACE = "US";
const MIN_REVENUE = 20000;
const MAX_REVENUE = 100000;
// Sole-seller is strict: the brand must be the ONLY seller (no Amazon, no
// resellers at all). This threshold only feeds the summary's display fields.
const SOLE_THRESHOLD = 5;

const SF_MAX_SUBCATS = 500; // ceiling on subcategories per run
const SF_BRANDS_PER_SUBCAT = 150; // brands examined per subcategory
const SF_PRODUCTS_PER_BRAND = 1000;

const BRANDS_TAB = "Brands";
const PRODUCTS_TAB = "Products";

export interface SheetFillProgress {
  totalSubcats: number;
  subcatsDone: number;
  brandsWritten: number;
  productsWritten: number;
  current: string | null;
}

async function categoryNamer(): Promise<(id: number | null) => string> {
  const cats = await getCategories(MARKETPLACE);
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  return (id: number | null) => (id != null ? byId.get(id) ?? String(id) : "");
}

export async function runSheetFill(
  payload: Record<string, unknown>,
  onProgress: (p: SheetFillProgress) => void,
): Promise<SheetFillProgress> {
  const nodeId = Number(payload.nodeId);
  if (!Number.isFinite(nodeId)) throw new Error("nodeId is required");

  const { node, leaves } = await getSubcategoryDescendants(MARKETPLACE, nodeId);
  if (!node) throw new Error("Unknown subcategory node");
  if (leaves.length === 0) throw new Error("No selectable subcategories under this node.");

  const selected = leaves.slice(0, SF_MAX_SUBCATS);
  const catName = await categoryNamer();
  const refreshed = new Date();

  // Track the true bottom of each tab so every block lands after existing data
  // (append stops at the first blank row between blocks, so we write explicitly).
  let brandsNextRow = (await getLastRow(BRANDS_TAB)) + 1;
  let productsNextRow = (await getLastRow(PRODUCTS_TAB)) + 1;

  const progress: SheetFillProgress = {
    totalSubcats: selected.length,
    subcatsDone: 0,
    brandsWritten: 0,
    productsWritten: 0,
    current: null,
  };

  for (const leaf of selected) {
    const subPath = fullPathOf(leaf);
    progress.current = subPath;
    onProgress({ ...progress });

    // 1) Brands in this subcategory within the revenue band.
    let brands: SubcategoryBrandsResponse["brands"] = [];
    try {
      brands = (mapSubcategoryBrands(
        await searchSubcategoryBrands({
          subcategoryId: leaf.id,
          minRevenue: MIN_REVENUE,
          maxRevenue: MAX_REVENUE,
          sortBy: "revenue",
          sortDir: "desc",
          page: 1,
          pageSize: SF_BRANDS_PER_SUBCAT,
          marketplace: MARKETPLACE,
        }),
      ) as SubcategoryBrandsResponse).brands;
    } catch {
      brands = [];
    }

    // 2) Keep only sole-seller brands (owner sells; no Amazon / resellers).
    const brandRowsForSheet: Cell[][] = [];
    const productRowsForSheet: Cell[][] = []; // includes 2 blank rows before each brand block
    let productCount = 0; // actual product rows (excludes the blank separators)
    for (const brand of brands) {
      let soleSeller = false;
      try {
        const sellers = (mapBrandSellers(await getBrandSellers(brand.brandId, MARKETPLACE)) as BrandSellersResponse).sellers;
        soleSeller = summarizeSellers(sellers, SOLE_THRESHOLD).soleSeller;
      } catch {
        soleSeller = false;
      }
      if (!soleSeller) continue;

      // 3) Brand detail + its products.
      let rich: RichSubcategoryBrand;
      try {
        const br = mapBrands(await getBrand(brand.brandName, MARKETPLACE)) as BrandsResponse;
        const match = br.brands.find((x) => x.brandId === brand.brandId) ?? br.brands[0];
        rich = richFromBrand(match, brand.brandId, brand.brandName);
      } catch {
        rich = richFromBrand(null, brand.brandId, brand.brandName);
      }
      brandRowsForSheet.push(brandRow(rich, subPath, catName));

      let products: Product[] = [];
      try {
        products = (mapProducts(
          await getBrandProducts({
            brandId: brand.brandId,
            sortBy: "monthlyRevenueEstimate",
            sortDir: "desc",
            page: 1,
            pageSize: SF_PRODUCTS_PER_BRAND,
            marketplace: MARKETPLACE,
          }),
        ) as ProductsResponse).products;
      } catch {
        products = [];
      }
      if (products.length > 0) {
        // Two blank rows between one brand's products and the next.
        productRowsForSheet.push([], []);
        for (const p of products) {
          productRowsForSheet.push(productRow(p, catName, refreshed));
          productCount += 1;
        }
      }
    }

    // 4) Write this subcategory's block at the true bottom (only if it has brands).
    if (brandRowsForSheet.length > 0) {
      // A blank separator row, a per-block header (Brand Name… from col B), then rows.
      const block: Cell[][] = [[""], ["", ...BRAND_HEADERS.slice(1)], ...brandRowsForSheet];
      await updateRows(BRANDS_TAB, brandsNextRow, block);
      brandsNextRow += block.length;
      if (productRowsForSheet.length > 0) {
        await updateRows(PRODUCTS_TAB, productsNextRow, productRowsForSheet);
        productsNextRow += productRowsForSheet.length;
      }
      progress.brandsWritten += brandRowsForSheet.length;
      progress.productsWritten += productCount;
    }

    progress.subcatsDone += 1;
    onProgress({ ...progress });
  }

  progress.current = null;
  onProgress({ ...progress });
  return progress;
}
