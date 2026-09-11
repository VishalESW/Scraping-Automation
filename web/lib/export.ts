import "server-only";
import ExcelJS from "exceljs";
import type {
  Product,
  RichSubcategoryBrand,
  MapSeller,
  SellerBrand,
  BrandMarketplace,
} from "./types";

type Cell = string | number | boolean | Date | null;

const BRAND_HEADERS = [
  "Subcategory", "Brand Name", "Brand Score", "Main Category", "Primary Subcategory",
  "Est. Monthly Revenue", "Trailing 12 Months", "Avg. Price", "Avg. Volume", "Avg. FBA Sellers",
  "Avg. Sellers", "Dominant Seller", "Country", "Sales %", "Est. Monthly Sales",
  "Amazon In-Stock Rate", "Avg. Rating", "Total Reviews", "1 Month Growth", "12 Month Growth",
  "Product Count", "Storefront", "Avg. In-Stock Rate 90", "Avg. Buy Box Suppression",
  "Total Est. FBA Fees", "Notes", "Storefront Url",
];

const PRODUCT_HEADERS = [
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

function brandRow(b: RichSubcategoryBrand, subcategoryPath: string, catName: (id: number | null) => string): Cell[] {
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

function productRow(p: Product, catName: (id: number | null) => string, refreshed: Date): Cell[] {
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
  brands: Array<{
    coverage: SellerBrand;
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
  "Seller", "Est. Monthly Sales", "Seller Type", "# Brands", "Latitude", "Longitude", "Seller Id",
  "Amazon Seller Id", "Seller Page (Amazon)",
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
  "Seller", "Brand", "Brand Id", "Monthly Revenue", "Offers", "Brand Coverage %", "MoM Coverage Δ",
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
  for (const blk of input.sellers) {
    const s = blk.seller;
    // amazonSellerId is the same across a seller's brand rows; take the first available.
    const amazonSellerId =
      blk.brands.find((x) => x.coverage.amazonSellerId)?.coverage.amazonSellerId ?? null;
    const url = amazonSellerUrl(input.marketplace, amazonSellerId);
    const row = ss.addRow([
      s.name, s.estimateSales, s.sellerTypeId, blk.brands.length, s.latitude, s.longitude,
      s.sellerId, amazonSellerId, url ? { text: url, hyperlink: url } : null,
    ]);
    if (url) {
      const cell = row.getCell(linkCol);
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }
  sizeColumns(ss, SELLER_HEADERS.length);
  ss.getColumn(SELLER_HEADERS.length - 1).width = 18; // Amazon Seller Id
  ss.getColumn(SELLER_HEADERS.length).width = 52; // Seller Page (Amazon)

  // --- Brands sheet (one row per seller → brand) ---
  const bs = wb.addWorksheet("Brands");
  styleHeaderRow(bs.addRow(SELLER_BRAND_HEADERS));
  for (const blk of input.sellers) {
    for (const b of blk.brands) {
      const c = b.coverage;
      bs.addRow([
        blk.seller.name, c.brandName, c.brandId, c.monthlyRevenue, c.numberOffers,
        c.estimateBrandPercentage, c.moMCoverageChange,
      ]);
    }
  }
  sizeColumns(bs, SELLER_BRAND_HEADERS.length);

  // --- Products sheet (all seller→brands in one sheet, 2 blank rows between blocks) ---
  const ps = wb.addWorksheet("Products");
  let first = true;
  for (const blk of input.sellers) {
    for (const b of blk.brands) {
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

  // --- Marketplaces sheet (one row per seller → brand → marketplace) ---
  const ms = wb.addWorksheet("Marketplaces");
  styleHeaderRow(ms.addRow(SELLER_MARKETPLACE_HEADERS));
  for (const blk of input.sellers) {
    for (const b of blk.brands) {
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
