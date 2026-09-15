// Shared response/param types. Types only — safe to import from client components.

export const MARKETPLACES = [
  "US", "UK", "DE", "CA", "MX", "FR", "IT", "ES", "AU", "JP", "IN",
] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

export type SortDir = "asc" | "desc";

export interface Brand {
  brandId: number;
  name: string;
  brandScore: number | null;
  primaryCategoryId: number | null;
  subcategory: string | null;
  monthlyRevenue: number | null;
  annualRevenue: number | null;
  monthlyUnitsSold: number | null;
  avgPrice: number | null;
  avgSellers: number | null;
  avgFbaSellers: number | null;
  totalProducts: number | null;
  reviewRating: number | null;
  totalReviews: number | null;
  momGrowth: number | null;
  momGrowth12: number | null;
  dominantSeller: {
    name: string | null;
    country: string | null;
    amazonSellerId: string | null;
    brandCoverage: number | null;
  } | null;
}

export interface SubcategoryBrand {
  brandId: number;
  brandName: string;
  revenue: number | null;
  marketshare: number | null;
  moMMktShareChange: number | null;
  numberASINs: number | null;
  avgNumberSellers: number | null;
  avgPrice: number | null;
  avgVolume: number | null;
  totalNumberUnitsSold: number | null;
  totalReviews: number | null;
  avgReviews: number | null;
  reviewRating: number | null;
  avgPageScore: number | null;
  dominantSellerCountry: string | null;
}

export interface Product {
  asin: string;
  parentAsin: string | null;
  title: string | null;
  brandName: string | null;
  brandId: number | null;
  subcategory: string | null;
  rank: number | null;
  monthlyRevenueEstimate: number | null;
  monthlyUnitsSold: number | null;
  annualRevenueEstimate: number | null;
  momGrowth: number | null;
  opportunityScore: number | null;
  buyBoxPrice: number | null;
  numberOfSellers: number | null;
  numberFbaSellers: number | null;
  numberOfItems: number | null;
  reviewCount: number | null;
  reviewRating: number | null;
  totalRatings: number | null;
  amazonIsr: number | null;
  amzMonthlySold: number | null;
  annualRevenuePrev: number | null;
  annualUnits: number | null;
  subcategoryRank: number | null;
  categoryId: number | null;
  momGrowth12: number | null;
  buyBoxEquity: number | null;
  isVariation: boolean | null;
  returnRate: number | string | null;
  productPageScore: number | null;
  inStockRate90Day: number | null;
  listedSince: string | null;
  imageUrl: string | null;
}

export interface BrandMarketplace {
  marketplaceId: string | number;
  name: string | null;
  monthlyRevenue: number | null;
  monthlyUnitsSold: number | null;
  totalProducts: number | null;
  numberOos: number | null;
  avgSellers: number | null;
  avgFbaSellers: number | null;
  amazonIsr: number | null;
  brandScore: number | null;
  reviewRating: number | null;
}

export interface BrandSeller {
  sellerId: number | null;
  amazonSellerId: string | null;
  sellerName: string | null;
  brandId: number | null;
  brandName: string | null;
  numberOffers: number | null;
  monthlyRevenue: number | null;
  estimateBrandPercentage: number | null;
  moMCoverageChange: number | null;
}

export interface SellerBrand {
  brandId: number;
  brandName: string | null;
  monthlyRevenue: number | null;
  numberOffers: number | null;
  estimateBrandPercentage: number | null;
  moMCoverageChange: number | null;
  amazonSellerId: string | null;
  sellerName: string | null;
}
export interface SellerBrandsResponse {
  returned: number;
  brands: SellerBrand[];
}

export interface MapSeller {
  sellerId: number;
  name: string | null;
  estimateSales: number | null;
  sellerTypeId: string | null;
  longitude: number | null;
  latitude: number | null;
}

export interface BrandSearchTerm {
  searchTerm: string | null;
  estimateSearches: number | null;
  totalKeywordSales: number | null;
  opportunityScore: number | null;
  searchResultsCount: number | null;
  estimatedCpc: number | null;
  topSpotWinRate: number | null;
  totalAdSpend: number | null;
  sponsoredProducts: number | null;
}

export interface Paged<T> {
  totalRowCount: number | null;
  returned: number;
  [key: string]: unknown | T[];
}

export interface SubcategoryBrandsResponse {
  totalRowCount: number | null;
  returned: number;
  brands: SubcategoryBrand[];
}
export interface BrandsResponse {
  totalRowCount: number | null;
  returned: number;
  brands: Brand[];
}
export interface ProductsResponse {
  totalRowCount: number | null;
  returned: number;
  products: Product[];
}
export interface MarketplacesResponse {
  returned: number;
  marketplaces: BrandMarketplace[];
}
export interface BrandSellersResponse {
  returned: number;
  sellers: BrandSeller[];
}
export interface SellerMapResponse {
  returned: number;
  sellers: MapSeller[];
}
export interface SellerBrandName {
  brandId: number;
  brandName: string | null;
}
export interface SellerMapPageBrandsResponse {
  brandsBySeller: Record<string, SellerBrandName[]>;
}
export interface SearchTermsResponse {
  totalRowCount: number | null;
  returned: number;
  searchTerms: BrandSearchTerm[];
}

export interface RichSubcategoryBrand {
  brandId: number;
  brandName: string;
  brandScore: number | null;
  primaryCategoryId: number | null;
  primarySubcategory: string | null;
  monthlyRevenue: number | null;
  annualRevenue: number | null;
  avgPrice: number | null;
  avgVolume: number | null;
  avgFbaSellers: number | null;
  avgSellers: number | null;
  dominantSellerName: string | null;
  dominantSellerCountry: string | null;
  dominantSellerBrandCoverage: number | null;
  monthlyUnitsSold: number | null;
  amazonIsr: number | null;
  reviewRating: number | null;
  totalReviews: number | null;
  momGrowth: number | null;
  momGrowth12: number | null;
  totalProducts: number | null;
  hasStorefront: boolean | null;
  avgInStockRate90Day: number | null;
  avgBuyBoxSuppression45Day: number | null;
  totalEstFbaFees30Day: number | null;
  note: string | null;
  storefrontUrl: string | null;
}
export interface RichSubcategoryBrandsResponse {
  totalRowCount: number | null;
  returned: number;
  brands: RichSubcategoryBrand[];
}

export interface Category {
  id: number;
  name: string;
  nodeId: number;
}
export interface CategoriesResponse {
  returned: number;
  categories: Category[];
}

export interface SubcategoryNode {
  id: number;
  name: string;
  shortName: string | null;
  parentId: number | null;
  level: number | null;
  isLeafNode: boolean | null;
  /** true = aggregation parent; the brands endpoint returns rows only for isParent=false nodes. */
  isParent: boolean | null;
  totalMonthlyRevenue: number | null;
  totalBrands: number | null;
  /** Breadcrumb of ancestor names, e.g. "Sports & Outdoors › Exercise & Fitness". */
  path?: string | null;
}
export interface SubcategoriesResponse {
  totalRowCount: number | null;
  returned: number;
  subcategories: SubcategoryNode[];
}

export const SELLER_TYPES = [
  "PrivateLabel", "Reseller", "Wholesaler", "Retailer", "Manufacturer", "Unknown",
] as const;
