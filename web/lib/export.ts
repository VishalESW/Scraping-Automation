import "server-only";
import ExcelJS from "exceljs";
import type {
  Product,
  RichSubcategoryBrand,
  SubcategoryBrand,
  MapSeller,
  SellerBrand,
  BrandSeller,
  BrandSearchTerm,
  BrandMarketplace,
} from "./types";

export type Cell = string | number | boolean | Date | null;

export const BRAND_HEADERS = [
  "Subcategory", "Brand Name", "Brand Score", "Main Category", "Primary Subcategory",
  "Est. Monthly Revenue", "Trailing 12 Months", "Avg. Price", "Avg. Volume", "Avg. FBA Sellers",
  "Avg. Sellers", "Dominant Seller", "Country", "Sales %", "Est. Monthly Sales",
  "Amazon In-Stock Rate", "Avg. Rating", "Total Reviews", "1 Month Growth", "12 Month Growth",
  "Product Count", "Storefront", "Avg. In-Stock Rate 90", "Avg. Buy Box Suppression",
  "Total Est. FBA Fees", "Notes", "Storefront Url",
];

export const PRODUCT_HEADERS = [
  "Product Image", "ASIN", "Page Score", "Title", "Brand", "Est. Monthly Revenue",
  "Est. 12 Month Revenue", "Est. Monthly Units Sold", "Est. 12 Month Units Sold",
  "Main Category Rank", "Main Category Name", "Primary Subcategory Rank", "Primary Subcategory Name",
  "12 Month Growth", "Opportunity Score", "Est. New Seller Share", "Buy Box Price", "Item Count",
  "FBA Sellers", "All Sellers", "Amazon In-Stock Rate", "12-24 Month Revenue", "Child Review Count",
  "Listing Review Count", "Rating", "Bought in Past Month", "Parent ASIN", "Is Variation",
  "Return Rate", "Last Refreshed", "TTM Start Date", "TTM End Date", "TTM Revenue Change",
];

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEDEBFB" },
};

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
  });
}

export function brandRow(b: RichSubcategoryBrand, subcategoryPath: string, catName: (id: number | null) => string): Cell[] {
  return [
    subcategoryPath,
    b.brandName,
    b.brandScore,
    catName(b.primaryCategoryId),
    b.primarySubcategory,
    b.monthlyRevenue,
    b.annualRevenue,
    b.avgPrice,
    b.avgVolume,
    b.avgFbaSellers,
    b.avgSellers,
    b.dominantSellerName,
    b.dominantSellerCountry,
    b.dominantSellerBrandCoverage,
    b.monthlyUnitsSold,
    b.amazonIsr,
    b.reviewRating,
    b.totalReviews,
    b.momGrowth,
    b.momGrowth12,
    b.totalProducts,
    b.hasStorefront,
    b.avgInStockRate90Day,
    b.avgBuyBoxSuppression45Day,
    b.totalEstFbaFees30Day,
    b.note,
    b.storefrontUrl,
  ];
}

export function productRow(p: Product, catName: (id: number | null) => string, refreshed: Date): Cell[] {
  return [
    "", // Product Image (not embedded)
    p.asin,
    p.productPageScore,
    p.title,
    p.brandName,
    p.monthlyRevenueEstimate,
    p.annualRevenueEstimate,
    p.monthlyUnitsSold,
    p.annualUnits,
    p.rank,
    catName(p.categoryId),
    p.subcategoryRank,
    p.subcategory,
    p.momGrowth12,
    p.opportunityScore,
    p.buyBoxEquity,
    p.buyBoxPrice,
    p.numberOfItems,
    p.numberFbaSellers,
    p.numberOfSellers,
    p.amazonIsr,
    p.annualRevenuePrev,
    p.totalRatings,
    p.reviewCount,
    p.reviewRating,
    p.amzMonthlySold,
    p.parentAsin,
    p.isVariation,
    p.returnRate,
    refreshed,
    null, // TTM Start Date (not exposed)
    null, // TTM End Date (not exposed)
    null, // TTM Revenue Change (not exposed)
  ];
}

export interface SubcategoryExportInput {
  subcategoryPath: string;
  marketplace: string;
  brands: RichSubcategoryBrand[];
  productsByBrand: Map<number, Product[]>;
  catName: (id: number | null) => string;
}

export async function buildSubcategoryWorkbook(input: SubcategoryExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartScout Research";
  wb.created = new Date();
  const refreshed = new Date();

  // --- Brands sheet ---
  const bs = wb.addWorksheet("Brands");
  styleHeaderRow(bs.addRow(BRAND_HEADERS));
  for (const b of input.brands) bs.addRow(brandRow(b, input.subcategoryPath, input.catName));
  bs.addRow([]);
  bs.addRow([
    "Note: Brand-wide columns (Est. Monthly Revenue / Sales / Reviews / Rating / Sellers / Brand " +
      "Score / Dominant Seller / Product Count / growth) cover the brand's WHOLE Amazon " +
      `${input.marketplace} catalog, not just this subcategory.`,
  ]);
  sizeColumns(bs, BRAND_HEADERS.length);

  // --- Products sheet (all brands in one sheet, 2 blank rows between blocks) ---
  const ps = wb.addWorksheet("Products");
  let first = true;
  for (const b of input.brands) {
    const products = input.productsByBrand.get(b.brandId) ?? [];
    if (!first) {
      ps.addRow([]);
      ps.addRow([]); // two-row gap between brands
    }
    first = false;

    const title = ps.addRow([`${b.brandName} - All Products (SmartScout, ${input.marketplace})`]);
    title.font = { bold: true, size: 12 };
    ps.addRow([`${products.length} ASINs.`]);
    ps.addRow([]);
    styleHeaderRow(ps.addRow(PRODUCT_HEADERS));
    for (const p of products) ps.addRow(productRow(p, input.catName, refreshed));
  }
  sizeColumns(ps, PRODUCT_HEADERS.length);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export interface SellerBlock {
  seller: MapSeller;
  /** Every brand the seller carries (names + coverage). Always complete. */
  allBrands: SellerBrand[];
  /** Budgeted subset that also carries deep product/marketplace detail. */
  detail: Array<{
    coverage: SellerBrand;
    brand: RichSubcategoryBrand | null;
    products: Product[];
    marketplaces: BrandMarketplace[];
  }>;
}

export interface SellerMapExportInput {
  marketplace: string;
  filterSummary: string;
  sellers: SellerBlock[];
  catName: (id: number | null) => string;
  detailNote?: string;
}

const SELLER_HEADERS = [
  "Seller", "Est. Monthly Sales", "Seller Type", "# Brands", "Brands", "Latitude", "Longitude",
  "Seller Id", "Amazon Seller Id", "Seller Page (Amazon)",
];

// Amazon storefront domain per marketplace (for the /sp?seller= contact page).
const AMAZON_TLD: Record<string, string> = {
  US: "com", UK: "co.uk", DE: "de", CA: "ca", MX: "com.mx", FR: "fr",
  IT: "it", ES: "es", AU: "com.au", JP: "co.jp", IN: "in",
};

function amazonSellerUrl(marketplace: string, amazonSellerId: string | null): string | null {
  if (!amazonSellerId) return null;
  const tld = AMAZON_TLD[marketplace] ?? "com";
  return `https://www.amazon.${tld}/sp?seller=${amazonSellerId}`;
}
const SELLER_BRAND_HEADERS = [
  "Seller", "Brand", "Brand Id", "Brand Score", "Main Category", "Primary Subcategory",
  "Est. Monthly Revenue", "Trailing 12 Months", "Avg. Price", "Avg. Volume", "Avg. FBA Sellers",
  "Avg. Sellers", "Dominant Seller", "Country", "Sales %", "Est. Monthly Sales",
  "Amazon In-Stock Rate", "Avg. Rating", "Total Reviews", "1 Month Growth", "12 Month Growth",
  "Product Count", "Storefront", "Avg. In-Stock Rate 90", "Total Est. FBA Fees", "Storefront Url",
  "Offers (this seller)", "Brand Coverage % (this seller)", "MoM Coverage Δ (this seller)",
];
const SELLER_MARKETPLACE_HEADERS = [
  "Seller", "Brand", "Marketplace", "Monthly Revenue", "Units/mo", "Products", "Out of Stock",
  "Avg. Sellers", "Avg. FBA Sellers", "Amazon In-Stock Rate", "Brand Score", "Rating",
];

export async function buildSellerMapWorkbook(input: SellerMapExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartScout Research";
  wb.created = new Date();
  const refreshed = new Date();

  // --- Sellers sheet ---
  const ss = wb.addWorksheet("Sellers");
  const title = ss.addRow([`Seller Map (SmartScout, ${input.marketplace})`]);
  title.font = { bold: true, size: 12 };
  ss.addRow([`${input.sellers.length} sellers. ${input.filterSummary}`]);
  if (input.detailNote) ss.addRow([input.detailNote]);
  ss.addRow([]);
  styleHeaderRow(ss.addRow(SELLER_HEADERS));
  const linkCol = SELLER_HEADERS.length; // last column = "Seller Page (Amazon)"
  const brandsCol = 5; // "Brands" column (comma-joined names)
  for (const blk of input.sellers) {
    const s = blk.seller;
    // amazonSellerId is the same across a seller's brand rows; take the first available.
    const amazonSellerId = blk.allBrands.find((x) => x.amazonSellerId)?.amazonSellerId ?? null;
    const brandNames = blk.allBrands.map((x) => x.brandName).filter(Boolean).join(", ");
    const url = amazonSellerUrl(input.marketplace, amazonSellerId);
    const row = ss.addRow([
      s.name, s.estimateSales, s.sellerTypeId, blk.allBrands.length, brandNames, s.latitude,
      s.longitude, s.sellerId, amazonSellerId, url ? { text: url, hyperlink: url } : null,
    ]);
    row.getCell(brandsCol).alignment = { wrapText: true, vertical: "top" };
    if (url) {
      const cell = row.getCell(linkCol);
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }
  sizeColumns(ss, SELLER_HEADERS.length);
  ss.getColumn(brandsCol).width = 60; // Brands (wrapped list of names)
  ss.getColumn(SELLER_HEADERS.length - 1).width = 18; // Amazon Seller Id
  ss.getColumn(SELLER_HEADERS.length).width = 52; // Seller Page (Amazon)

  // --- Brands sheet (one row per seller → brand, with whole-catalog brand detail) ---
  // Lists EVERY brand of every seller. Whole-catalog enrichment (brand score,
  // category, price, …) is present only for the budgeted detail subset; the rest
  // still carry brand name + this seller's coverage.
  const bs = wb.addWorksheet("Brands");
  styleHeaderRow(bs.addRow(SELLER_BRAND_HEADERS));
  for (const blk of input.sellers) {
    const enrich = new Map(blk.detail.map((d) => [d.coverage.brandId, d.brand]));
    for (const c of blk.allBrands) {
      const b = enrich.get(c.brandId) ?? null;
      bs.addRow([
        blk.seller.name, c.brandName, c.brandId,
        b?.brandScore ?? null, input.catName(b?.primaryCategoryId ?? null), b?.primarySubcategory ?? null,
        b?.monthlyRevenue ?? null, b?.annualRevenue ?? null, b?.avgPrice ?? null, b?.avgVolume ?? null,
        b?.avgFbaSellers ?? null, b?.avgSellers ?? null, b?.dominantSellerName ?? null,
        b?.dominantSellerCountry ?? null, b?.dominantSellerBrandCoverage ?? null,
        b?.monthlyUnitsSold ?? null, b?.amazonIsr ?? null, b?.reviewRating ?? null, b?.totalReviews ?? null,
        b?.momGrowth ?? null, b?.momGrowth12 ?? null, b?.totalProducts ?? null, b?.hasStorefront ?? null,
        b?.avgInStockRate90Day ?? null, b?.totalEstFbaFees30Day ?? null, b?.storefrontUrl ?? null,
        c.numberOffers, c.estimateBrandPercentage, c.moMCoverageChange,
      ]);
    }
  }
  sizeColumns(bs, SELLER_BRAND_HEADERS.length);

  // --- Products sheet (all seller→brands in one sheet, 2 blank rows between blocks) ---
  const ps = wb.addWorksheet("Products");
  let first = true;
  for (const blk of input.sellers) {
    for (const b of blk.detail) {
      if (!first) {
        ps.addRow([]);
        ps.addRow([]);
      }
      first = false;
      const t = ps.addRow([
        `${blk.seller.name} › ${b.coverage.brandName} - All Products (SmartScout, ${input.marketplace})`,
      ]);
      t.font = { bold: true, size: 12 };
      ps.addRow([`${b.products.length} ASINs.`]);
      ps.addRow([]);
      styleHeaderRow(ps.addRow(PRODUCT_HEADERS));
      for (const p of b.products) ps.addRow(productRow(p, input.catName, refreshed));
    }
  }
  sizeColumns(ps, PRODUCT_HEADERS.length);

  // --- Marketplaces sheet (per seller → brand, 2 blank rows between brand blocks) ---
  const ms = wb.addWorksheet("Marketplaces");
  styleHeaderRow(ms.addRow(SELLER_MARKETPLACE_HEADERS));
  let firstMkt = true;
  for (const blk of input.sellers) {
    for (const b of blk.detail) {
      if (b.marketplaces.length === 0) continue;
      if (!firstMkt) {
        ms.addRow([]);
        ms.addRow([]); // two-row gap between brands
      }
      firstMkt = false;
      for (const m of b.marketplaces) {
        ms.addRow([
          blk.seller.name, b.coverage.brandName, m.name, m.monthlyRevenue, m.monthlyUnitsSold,
          m.totalProducts, m.numberOos, m.avgSellers, m.avgFbaSellers, m.amazonIsr, m.brandScore,
          m.reviewRating,
        ]);
      }
    }
  }
  sizeColumns(ms, SELLER_MARKETPLACE_HEADERS.length);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Bulk subcategory export — every subcategory under a branch / whole category.
// Brands-level only (one paged call per subcategory); products are omitted for
// scale (a whole category can be hundreds of subcategories).
// ---------------------------------------------------------------------------
const BULK_BRAND_HEADERS = [
  "Subcategory", "Brand", "Brand Id", "Monthly Revenue", "Market Share %", "MoM Share Δ",
  "ASINs", "Avg Sellers", "Avg Price", "Avg Volume", "Units Sold", "Total Reviews",
  "Avg Reviews", "Rating", "Avg Page Score", "Dominant Seller Country",
];
const BULK_SUMMARY_HEADERS = [
  "Subcategory", "Subcategory Id", "Brands in Export", "Matching Brands (total)",
  "Revenue in Export", "Subcategory Revenue (catalog)", "Brands (catalog)",
];

export interface BulkSubcategoryEntry {
  subcategoryId: number;
  subcategoryPath: string;
  totalMonthlyRevenue: number | null;
  totalBrands: number | null;
  totalRowCount: number | null;
  brands: SubcategoryBrand[];
}

export interface SubcategoryBulkExportInput {
  branchPath: string;
  marketplace: string;
  filterSummary: string;
  entries: BulkSubcategoryEntry[];
  totalSubcats: number;
  truncatedSubcats: boolean;
  brandsPerSubcategory: number;
}

function bulkBrandRow(sub: string, b: SubcategoryBrand): Cell[] {
  return [
    sub, b.brandName, b.brandId, b.revenue, b.marketshare, b.moMMktShareChange, b.numberASINs,
    b.avgNumberSellers, b.avgPrice, b.avgVolume, b.totalNumberUnitsSold, b.totalReviews,
    b.avgReviews, b.reviewRating, b.avgPageScore, b.dominantSellerCountry,
  ];
}

export async function buildSubcategoryBulkWorkbook(input: SubcategoryBulkExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartScout Research";
  wb.created = new Date();

  const totalBrands = input.entries.reduce((n, e) => n + e.brands.length, 0);

  // --- Overview sheet ---
  const ov = wb.addWorksheet("Overview");
  const t = ov.addRow([`Bulk Subcategory Export — ${input.branchPath} (SmartScout, ${input.marketplace})`]);
  t.font = { bold: true, size: 12 };
  ov.addRow([
    `${input.entries.length} of ${input.totalSubcats} subcategories · ${totalBrands} brand rows · ` +
      `up to ${input.brandsPerSubcategory} brands/subcategory.`,
  ]);
  if (input.filterSummary) ov.addRow([input.filterSummary]);
  if (input.truncatedSubcats) {
    ov.addRow([
      `Note: this branch has ${input.totalSubcats} subcategories; the export is capped at the ` +
        `${input.entries.length} highest-revenue ones. Pick a narrower branch for the rest.`,
    ]);
  }
  ov.addRow([
    "Note: brands-level data only (revenue, market share, ASIN count, sellers, reviews). " +
      "Open a single subcategory to export per-brand products.",
  ]);
  sizeColumns(ov, 1);

  // --- Subcategories summary sheet ---
  const su = wb.addWorksheet("Subcategories");
  styleHeaderRow(su.addRow(BULK_SUMMARY_HEADERS));
  for (const e of input.entries) {
    const revInExport = e.brands.reduce((n, b) => n + (b.revenue ?? 0), 0);
    su.addRow([
      e.subcategoryPath, e.subcategoryId, e.brands.length, e.totalRowCount, revInExport,
      e.totalMonthlyRevenue, e.totalBrands,
    ]);
  }
  sizeColumns(su, BULK_SUMMARY_HEADERS.length);

  // --- Brands sheet (one row per brand across every subcategory) ---
  const bs = wb.addWorksheet("Brands");
  styleHeaderRow(bs.addRow(BULK_BRAND_HEADERS));
  for (const e of input.entries) {
    for (const b of e.brands) bs.addRow(bulkBrandRow(e.subcategoryPath, b));
  }
  sizeColumns(bs, BULK_BRAND_HEADERS.length);
  bs.getColumn(1).width = 48; // Subcategory path

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Single-brand report (Brand tab) — user selects which sheets to include.
// ---------------------------------------------------------------------------
const BRAND_SELLER_HEADERS = [
  "Seller", "Amazon Seller Id", "Seller Page (Amazon)", "Offers", "Monthly Revenue",
  "Brand Coverage %", "MoM Coverage Δ",
];
const SEARCH_TERM_HEADERS = [
  "Search Term", "Est. Searches/mo", "Keyword Sales", "Opportunity Score", "Search Results",
  "Est. CPC", "Top-Spot Win %", "Total Ad Spend", "Sponsored Products",
];
const BRAND_MARKETPLACE_HEADERS = [
  "Marketplace", "Monthly Revenue", "Units/mo", "Products", "Out of Stock", "Avg. Sellers",
  "Avg. FBA Sellers", "Amazon In-Stock Rate", "Brand Score", "Rating",
];

const BRAND_DATA_HEADERS = [
  "Brand", "Brand Id", "Brand Score", "Main Category", "Primary Subcategory",
  "Est. Monthly Revenue", "Trailing 12 Months", "Avg. Price", "Avg. Volume", "Avg. FBA Sellers",
  "Avg. Sellers", "Dominant Seller", "Country", "Sales %", "Est. Monthly Sales",
  "Amazon In-Stock Rate", "Avg. Rating", "Total Reviews", "1 Month Growth", "12 Month Growth",
  "Product Count", "Storefront", "Avg. In-Stock Rate 90", "Total Est. FBA Fees", "Storefront Url",
];

export interface BrandReportEntry {
  brandId: number;
  brandName: string;
  brand: RichSubcategoryBrand | null;
  products: Product[] | null;
  sellers: BrandSeller[] | null;
  searchTerms: BrandSearchTerm[] | null;
  marketplaces: BrandMarketplace[] | null;
}

export interface BrandExportSectionsFlags {
  overview: boolean;
  products: boolean;
  sellers: boolean;
  searchTerms: boolean;
  marketplaces: boolean;
}

export interface BrandExportInput {
  marketplace: string;
  entries: BrandReportEntry[];
  sections: BrandExportSectionsFlags;
  catName: (id: number | null) => string;
}

function brandDataRow(e: BrandReportEntry, catName: (id: number | null) => string): Cell[] {
  const b = e.brand;
  return [
    b?.brandName ?? e.brandName, b?.brandId ?? e.brandId, b?.brandScore ?? null,
    catName(b?.primaryCategoryId ?? null), b?.primarySubcategory ?? null, b?.monthlyRevenue ?? null,
    b?.annualRevenue ?? null, b?.avgPrice ?? null, b?.avgVolume ?? null, b?.avgFbaSellers ?? null,
    b?.avgSellers ?? null, b?.dominantSellerName ?? null, b?.dominantSellerCountry ?? null,
    b?.dominantSellerBrandCoverage ?? null, b?.monthlyUnitsSold ?? null, b?.amazonIsr ?? null,
    b?.reviewRating ?? null, b?.totalReviews ?? null, b?.momGrowth ?? null, b?.momGrowth12 ?? null,
    b?.totalProducts ?? null, b?.hasStorefront ?? null, b?.avgInStockRate90Day ?? null,
    b?.totalEstFbaFees30Day ?? null, b?.storefrontUrl ?? null,
  ];
}

export async function buildBrandWorkbook(input: BrandExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SmartScout Research";
  wb.created = new Date();
  const refreshed = new Date();
  const { entries, sections, catName, marketplace } = input;

  // --- Brands sheet: horizontal, one row per brand ---
  if (sections.overview) {
    const bs = wb.addWorksheet("Brands");
    styleHeaderRow(bs.addRow(BRAND_DATA_HEADERS));
    for (const e of entries) bs.addRow(brandDataRow(e, catName));
    sizeColumns(bs, BRAND_DATA_HEADERS.length);
  }

  // gap-separated per-brand blocks helper
  const gap = (ws: ExcelJS.Worksheet, first: boolean) => {
    if (!first) {
      ws.addRow([]);
      ws.addRow([]);
    }
  };

  // --- Products (one sheet, block per brand, 2 blank rows between) ---
  if (sections.products) {
    const ps = wb.addWorksheet("Products");
    let first = true;
    for (const e of entries) {
      if (!e.products) continue;
      gap(ps, first);
      first = false;
      const t = ps.addRow([`${e.brandName} - All Products (SmartScout, ${marketplace})`]);
      t.font = { bold: true, size: 12 };
      ps.addRow([`${e.products.length} ASINs.`]);
      ps.addRow([]);
      styleHeaderRow(ps.addRow(PRODUCT_HEADERS));
      for (const p of e.products) ps.addRow(productRow(p, catName, refreshed));
    }
    sizeColumns(ps, PRODUCT_HEADERS.length);
  }

  // --- Sellers (block per brand; Amazon seller-id + clickable seller page link) ---
  if (sections.sellers) {
    const ss = wb.addWorksheet("Sellers");
    let first = true;
    for (const e of entries) {
      if (!e.sellers) continue;
      gap(ss, first);
      first = false;
      const t = ss.addRow([`${e.brandName} - Sellers (SmartScout, ${marketplace})`]);
      t.font = { bold: true, size: 12 };
      ss.addRow([`${e.sellers.length} sellers.`]);
      ss.addRow([]);
      styleHeaderRow(ss.addRow(BRAND_SELLER_HEADERS));
      for (const s of e.sellers) {
        const url = amazonSellerUrl(marketplace, s.amazonSellerId);
        const row = ss.addRow([
          s.sellerName, s.amazonSellerId, url ? { text: url, hyperlink: url } : null,
          s.numberOffers, s.monthlyRevenue, s.estimateBrandPercentage, s.moMCoverageChange,
        ]);
        if (url) row.getCell(3).font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }
    sizeColumns(ss, BRAND_SELLER_HEADERS.length);
    ss.getColumn(2).width = 18;
    ss.getColumn(3).width = 52;
  }

  // --- Search terms (block per brand) ---
  if (sections.searchTerms) {
    const ts = wb.addWorksheet("Search Terms");
    let first = true;
    for (const e of entries) {
      if (!e.searchTerms) continue;
      gap(ts, first);
      first = false;
      const t = ts.addRow([`${e.brandName} - Search Terms (SmartScout, ${marketplace})`]);
      t.font = { bold: true, size: 12 };
      ts.addRow([`${e.searchTerms.length} search terms.`]);
      ts.addRow([]);
      styleHeaderRow(ts.addRow(SEARCH_TERM_HEADERS));
      for (const st of e.searchTerms) {
        ts.addRow([
          st.searchTerm, st.estimateSearches, st.totalKeywordSales, st.opportunityScore,
          st.searchResultsCount, st.estimatedCpc, st.topSpotWinRate, st.totalAdSpend, st.sponsoredProducts,
        ]);
      }
    }
    sizeColumns(ts, SEARCH_TERM_HEADERS.length);
  }

  // --- Marketplaces (block per brand) ---
  if (sections.marketplaces) {
    const ms = wb.addWorksheet("Marketplaces");
    let first = true;
    for (const e of entries) {
      if (!e.marketplaces) continue;
      gap(ms, first);
      first = false;
      const t = ms.addRow([`${e.brandName} - Marketplaces (SmartScout, ${marketplace})`]);
      t.font = { bold: true, size: 12 };
      ms.addRow([]);
      styleHeaderRow(ms.addRow(BRAND_MARKETPLACE_HEADERS));
      for (const m of e.marketplaces) {
        ms.addRow([
          m.name, m.monthlyRevenue, m.monthlyUnitsSold, m.totalProducts, m.numberOos, m.avgSellers,
          m.avgFbaSellers, m.amazonIsr, m.brandScore, m.reviewRating,
        ]);
      }
    }
    sizeColumns(ms, BRAND_MARKETPLACE_HEADERS.length);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

function sizeColumns(ws: ExcelJS.Worksheet, count: number): void {
  for (let i = 1; i <= count; i++) {
    const col = ws.getColumn(i);
    let max = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value === null || cell.value === undefined ? 0 : String(cell.value).length;
      if (len > max) max = len;
    });
    col.width = Math.min(Math.max(max + 2, 10), 60);
  }
}
