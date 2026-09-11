// Response mappers shared by the MCP tools and the web app.
// Each takes a raw SmartScout API response and returns compact, UI-friendly fields.
// Single source of truth for field shaping — do not duplicate these in consumers.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapBrands(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    totalRowCount: res?.pageInfo?.totalRowCount ?? null,
    returned: payload.length,
    brands: payload.map((b: any) => ({
      brandId: b.id,
      name: b.name,
      brandScore: b.brandScore,
      primaryCategoryId: b.primaryCategoryId,
      subcategory: b.primarySubcategory?.subcategoryContextName ?? null,
      monthlyRevenue: b.monthlyRevenue,
      annualRevenue: b.ttm,
      monthlyUnitsSold: b.monthlyUnitsSold,
      avgPrice: b.avgPrice,
      avgSellers: b.avgSellers,
      avgFbaSellers: b.avgFbaSellers,
      totalProducts: b.totalProducts,
      reviewRating: b.reviewRating,
      totalReviews: b.totalReviews,
      momGrowth: b.momGrowth,
      momGrowth12: b.momGrowth12,
      amazonIsr: b.amazonIsr,
      avgInStockRate90Day: b.avgInStockRate90Day,
      totalEstFbaFees30Day: b.totalEstFbaFees30Day,
      hasStorefront: b.hasStorefront,
      storefrontUrl: b.storefrontUrl,
      dominantSeller: b.dominantSeller
        ? {
            name: b.dominantSeller.name,
            country: b.dominantSeller.country,
            amazonSellerId: b.dominantSeller.amazonSellerId,
            brandCoverage: b.dominantSellerBrandCoverage,
          }
        : null,
    })),
  };
}

export function mapSubcategoryBrands(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    totalRowCount: res?.pageInfo?.totalRowCount ?? null,
    returned: payload.length,
    brands: payload.map((r: any) => ({
      brandId: r.brandId,
      brandName: r.brandName,
      revenue: r.revenue,
      marketshare: r.marketshare,
      moMMktShareChange: r.moMMktShareChange,
      numberASINs: r.numberASINs,
      avgNumberSellers: r.avgNumberSellers,
      avgPrice: r.avgPrice,
      avgVolume: r.avgVolume,
      totalNumberUnitsSold: r.totalNumberUnitsSold,
      totalReviews: r.totalReviews,
      avgReviews: r.avgReviews,
      reviewRating: r.reviewRating,
      avgPageScore: r.avgPageScore,
      dominantSellerCountry: r.brand?.dominantSeller?.country ?? null,
    })),
  };
}

// Rich subcategory-brands rows for export: pulls the brand-WIDE record from the
// nested `brand` object the endpoint returns (brandScore, dominant seller, growth,
// product count, storefront, fba fees, etc.), plus the brandId for product lookups.
export function mapSubcategoryBrandsRich(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    totalRowCount: res?.pageInfo?.totalRowCount ?? null,
    returned: payload.length,
    brands: payload.map((r: any) => {
      const b = r.brand ?? {};
      return {
        brandId: r.brandId ?? b.id,
        brandName: r.brandName ?? b.name,
        brandScore: b.brandScore ?? null,
        primaryCategoryId: b.primaryCategoryId ?? null,
        primarySubcategory: b.primarySubcategory?.subcategoryContextName ?? null,
        monthlyRevenue: b.monthlyRevenue ?? null,
        annualRevenue: b.ttm ?? null,
        avgPrice: b.avgPrice ?? null,
        avgVolume: b.avgVolume ?? null,
        avgFbaSellers: b.avgFbaSellers ?? null,
        avgSellers: b.avgSellers ?? null,
        dominantSellerName: b.dominantSeller?.name ?? null,
        dominantSellerCountry: b.dominantSeller?.country ?? null,
        dominantSellerBrandCoverage: b.dominantSellerBrandCoverage ?? null,
        monthlyUnitsSold: b.monthlyUnitsSold ?? null,
        amazonIsr: b.amazonIsr ?? null,
        reviewRating: b.reviewRating ?? null,
        totalReviews: b.totalReviews ?? null,
        momGrowth: b.momGrowth ?? null,
        momGrowth12: b.momGrowth12 ?? null,
        totalProducts: b.totalProducts ?? null,
        hasStorefront: b.hasStorefront ?? null,
        avgInStockRate90Day: b.avgInStockRate90Day ?? null,
        avgBuyBoxSuppression45Day: b.avgBuyBoxSuppression45Day ?? null,
        totalEstFbaFees30Day: b.totalEstFbaFees30Day ?? null,
        note: b.note ?? null,
        storefrontUrl: b.storefrontUrl ?? null,
      };
    }),
  };
}

export function mapBrandMarketplaces(res: any): unknown {
  const arr: any[] = Array.isArray(res) ? res : Array.isArray(res?.payload) ? res.payload : [];
  return {
    returned: arr.length,
    marketplaces: arr.map((r: any) => ({
      marketplaceId: r.marketplaceId,
      // by-brand-marketplaces returns marketplaceId as the country code ("US", "UK", …)
      // and `name` as the brand name — label the row by the marketplace.
      name: r.marketplaceId ?? r.name,
      monthlyRevenue: r.monthlyRevenue,
      monthlyUnitsSold: r.monthlyUnitsSold,
      totalProducts: r.totalProducts,
      numberOos: r.numberOos,
      avgSellers: r.avgSellers,
      avgFbaSellers: r.avgFbaSellers,
      amazonIsr: r.amazonIsr,
      brandScore: r.brandScore,
      reviewRating: r.reviewRating,
    })),
  };
}

export function mapProducts(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    totalRowCount: res?.pageInfo?.totalRowCount ?? null,
    returned: payload.length,
    products: payload.map((p: any) => ({
      asin: p.asin,
      parentAsin: p.parentAsin,
      title: p.title,
      brandName: p.brandName,
      brandId: p.brandId,
      categoryId: p.categoryId,
      subcategory: p.subcategory?.subcategoryContextName ?? null,
      rank: p.rank,
      subcategoryRank: p.subcategoryRank,
      monthlyRevenueEstimate: p.monthlyRevenueEstimate,
      monthlyUnitsSold: p.monthlyUnitsSold,
      annualRevenueEstimate: p.ttm,
      annualUnits: p.ttmUnits,
      momGrowth: p.momGrowth,
      momGrowth12: p.momGrowth12,
      opportunityScore: p.opportunityScore,
      buyBoxPrice: p.buyBoxPrice,
      buyBoxEquity: p.buyBoxEquity,
      numberOfSellers: p.numberOfSellers,
      numberFbaSellers: p.numberFbaSellers,
      numberOfItems: p.numberOfItems,
      reviewCount: p.reviewCount,
      reviewRating: p.reviewRating,
      totalRatings: p.totalRatings,
      amazonIsr: p.amazonIsr,
      amzMonthlySold: p.amzMonthlySold,
      annualRevenuePrev: p.ttmPrev,
      productPageScore: p.productPageScore,
      hasVideo: p.hasVideo,
      hasAPlus: p.hasAPlus,
      inStockRate90Day: p.inStockRate90Day,
      returnRate: p.returnRate,
      isVariation: p.isVariation,
      listedSince: p.listedSince,
      manufacturer: p.manufacturer,
      model: p.model,
      imageUrl: p.imageUrl ? `https://m.media-amazon.com/images/I/${p.imageUrl}` : null,
    })),
  };
}

export function mapBrandSellers(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    returned: payload.length,
    sellers: payload.map((s: any) => ({
      sellerId: s.sellerId,
      amazonSellerId: s.amazonSellerId,
      sellerName: s.sellerName,
      brandId: s.brandId,
      brandName: s.brandName,
      numberOffers: s.numberOffers,
      monthlyRevenue: s.monthlyRevenue,
      estimateBrandPercentage: s.estimateBrandPercentage,
      moMCoverageChange: s.moMCoverageChange,
    })),
  };
}

// Brands a seller carries (from brandcoverage/search keyed by sellerId).
export function mapSellerBrands(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    returned: payload.length,
    brands: payload.map((r: any) => ({
      brandId: r.brandId,
      brandName: r.brandName,
      monthlyRevenue: r.monthlyRevenue,
      numberOffers: r.numberOffers,
      estimateBrandPercentage: r.estimateBrandPercentage,
      moMCoverageChange: r.moMCoverageChange,
      amazonSellerId: r.amazonSellerId,
      sellerName: r.sellerName,
    })),
  };
}

export function mapSellerMap(res: any): unknown {
  const arr: any[] = Array.isArray(res) ? res : Array.isArray(res?.payload) ? res.payload : [];
  return {
    returned: arr.length,
    sellers: arr.map((s: any) => ({
      sellerId: s.id,
      name: s.name,
      estimateSales: s.estimateSales,
      sellerTypeId: s.sellerTypeId,
      longitude: s.geoLocation?.longitude ?? null,
      latitude: s.geoLocation?.latitude ?? null,
    })),
  };
}

export function mapCategories(res: any): unknown {
  const arr: any[] = Array.isArray(res?.categories)
    ? res.categories
    : Array.isArray(res)
      ? res
      : [];
  return {
    returned: arr.length,
    categories: arr.map((c: any) => ({
      id: c.id,
      name: c.name,
      nodeId: c.nodeId,
    })),
  };
}

export function mapSubcategories(res: any): unknown {
  const arr: any[] = Array.isArray(res?.payload) ? res.payload : Array.isArray(res) ? res : [];
  return {
    totalRowCount: res?.pageInfo?.totalRowCount ?? arr.length,
    returned: arr.length,
    subcategories: arr.map((s: any) => ({
      id: s.id,
      name: s.subcategoryContextName || s.subcategoryName || String(s.id),
      shortName: s.subcategoryName ?? null,
      parentId: s.parentId ?? null,
      level: s.level ?? null,
      isLeafNode: s.isLeafNode ?? null,
      isParent: s.isParent ?? null,
      totalMonthlyRevenue: s.totalMonthlyRevenue ?? null,
      totalBrands: s.totalBrands ?? null,
    })),
  };
}

export function mapBrandSearchTerms(res: any): unknown {
  const payload: any[] = Array.isArray(res?.payload) ? res.payload : [];
  return {
    totalRowCount: res?.pageInfo?.totalRowCount ?? null,
    returned: payload.length,
    searchTerms: payload.map((r: any) => {
      const t = r.searchTerm ?? {};
      return {
        searchTerm: t.searchTermValue,
        estimateSearches: t.estimateSearches,
        totalKeywordSales: t.totalKeywordSales,
        opportunityScore: t.opportunityScore,
        launchVelocity: t.launchVelocity,
        searchResultsCount: t.searchResultsCount,
        estimatedCpc: t.estimatedCpc,
        cpcRangeStart: t.cpcRangeStart,
        cpcRangeEnd: t.cpcRangeEnd,
        topSpotWinRate: r.topSpotWinRate,
        topGroupWinRate: r.topGroupWinRate,
        sponsoredBrandWinRate: r.sponsoredBrandWinRate,
        sponsoredVideoWinRate: r.sponsoredVideoWinRate,
        totalAdSpend: r.totalAdSpend,
        sponsoredProducts: r.sponsoredProducts,
      };
    }),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
