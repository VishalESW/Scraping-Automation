"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchBrandProducts,
  fetchBrandMarketplaces,
  fetchBrandSellers,
  fetchBrandSearchTerms,
} from "@/lib/api";
import type {
  SortDir,
  Product,
  BrandMarketplace,
  BrandSeller,
  BrandSearchTerm,
} from "@/lib/types";
import { money, count, num1, pct, text } from "@/lib/format";
import { useApp } from "./app-context";
import { DataTable, type Column } from "./data-table";

type Tab = "products" | "marketplaces" | "sellers" | "search-terms";
const TABS: { id: Tab; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "marketplaces", label: "Marketplaces" },
  { id: "sellers", label: "Sellers" },
  { id: "search-terms", label: "Search terms" },
];
const PAGE_SIZE = 50;

export function BrandDetailDrawer({
  brandId,
  brandName,
  onClose,
}: {
  brandId: number;
  brandName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <div className="drawer-panel relative z-50 flex h-full w-full max-w-4xl flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-xs text-muted">Brand #{brandId}</div>
            <h2 className="text-lg font-semibold">{brandName}</h2>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex gap-1 border-b border-line px-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium ${
                tab === t.id ? "border-b-2 border-brand text-brand" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-2">
          {tab === "products" && <ProductsTab brandId={brandId} />}
          {tab === "marketplaces" && <MarketplacesTab brandId={brandId} />}
          {tab === "sellers" && <SellersTab brandId={brandId} />}
          {tab === "search-terms" && <SearchTermsTab brandId={brandId} />}
        </div>
      </div>
    </div>
  );
}

function useReportedError(error: unknown) {
  const { reportError } = useApp();
  useEffect(() => {
    if (error) reportError(error);
  }, [error, reportError]);
}

function ProductsTab({ brandId }: { brandId: number }) {
  const { marketplace } = useApp();
  const [sort, setSort] = useState<{ by: string; dir: SortDir }>({ by: "monthlyRevenueEstimate", dir: "desc" });
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["brand-products", brandId, marketplace, sort, page],
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchBrandProducts(brandId, { sortBy: sort.by, sortDir: sort.dir, page, pageSize: PAGE_SIZE, marketplace }),
  });
  useReportedError(q.error);

  const rows = q.data?.products ?? [];
  const total = q.data?.totalRowCount ?? null;
  const hasMore = total !== null ? page * PAGE_SIZE < total : rows.length === PAGE_SIZE;

  const columns: Column<Product>[] = [
    {
      key: "title",
      header: "Product",
      sortKey: "title",
      render: (p) => (
        <div className="flex items-center gap-2">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-contain" />
          ) : null}
          <div className="max-w-md truncate" title={p.title ?? ""}>
            <div className="truncate font-medium">{text(p.title)}</div>
            <div className="text-xs text-muted">{p.asin}</div>
          </div>
        </div>
      ),
    },
    { key: "monthlyRevenueEstimate", header: "Monthly rev.", sortKey: "monthlyRevenueEstimate", align: "right", render: (p) => money(p.monthlyRevenueEstimate) },
    { key: "monthlyUnitsSold", header: "Units/mo", sortKey: "monthlyUnitsSold", align: "right", render: (p) => count(p.monthlyUnitsSold) },
    { key: "buyBoxPrice", header: "Price", sortKey: "buyBoxPrice", align: "right", render: (p) => money(p.buyBoxPrice, true) },
    { key: "rank", header: "Rank", sortKey: "rank", align: "right", render: (p) => count(p.rank) },
    { key: "numberOfSellers", header: "Sellers", sortKey: "numberOfSellers", align: "right", render: (p) => count(p.numberOfSellers) },
    { key: "reviewCount", header: "Reviews", sortKey: "reviewCount", align: "right", render: (p) => count(p.reviewCount) },
    { key: "reviewRating", header: "Rating", sortKey: "reviewRating", align: "right", render: (p) => num1(p.reviewRating) },
    { key: "opportunityScore", header: "Opp.", sortKey: "opportunityScore", align: "right", render: (p) => num1(p.opportunityScore) },
  ];

  return (
    <Section
      title={total !== null ? `${count(total)} products` : `${rows.length} products`}
      loading={q.isFetching}
      pager={{ page, hasMore, onPrev: () => setPage((p) => p - 1), onNext: () => setPage((p) => p + 1), disabled: q.isFetching }}
    >
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(p) => p.asin}
        sort={sort}
        onSortChange={(by, dir) => { setSort({ by, dir }); setPage(1); }}
        emptyText={q.isFetching ? "Loading…" : "No products."}
      />
    </Section>
  );
}

function MarketplacesTab({ brandId }: { brandId: number }) {
  const { marketplace } = useApp();
  const q = useQuery({
    queryKey: ["brand-marketplaces", brandId, marketplace],
    queryFn: () => fetchBrandMarketplaces(brandId, marketplace),
  });
  useReportedError(q.error);

  const columns: Column<BrandMarketplace>[] = [
    { key: "name", header: "Marketplace", sortKey: "name", sortValue: (r) => r.name, render: (r) => <span className="font-medium">{text(r.name)}</span> },
    { key: "monthlyRevenue", header: "Monthly rev.", sortKey: "monthlyRevenue", align: "right", sortValue: (r) => r.monthlyRevenue, render: (r) => money(r.monthlyRevenue) },
    { key: "monthlyUnitsSold", header: "Units/mo", sortKey: "monthlyUnitsSold", align: "right", sortValue: (r) => r.monthlyUnitsSold, render: (r) => count(r.monthlyUnitsSold) },
    { key: "totalProducts", header: "Products", sortKey: "totalProducts", align: "right", sortValue: (r) => r.totalProducts, render: (r) => count(r.totalProducts) },
    { key: "numberOos", header: "OOS", sortKey: "numberOos", align: "right", sortValue: (r) => r.numberOos, render: (r) => count(r.numberOos) },
    { key: "avgSellers", header: "Avg sellers", sortKey: "avgSellers", align: "right", sortValue: (r) => r.avgSellers, render: (r) => num1(r.avgSellers) },
    { key: "brandScore", header: "Brand score", sortKey: "brandScore", align: "right", sortValue: (r) => r.brandScore, render: (r) => num1(r.brandScore) },
    { key: "reviewRating", header: "Rating", sortKey: "reviewRating", align: "right", sortValue: (r) => r.reviewRating, render: (r) => num1(r.reviewRating) },
  ];

  return (
    <Section title={`${q.data?.returned ?? 0} marketplaces`} loading={q.isFetching}>
      <DataTable rows={q.data?.marketplaces ?? []} columns={columns} getRowKey={(r) => r.marketplaceId} emptyText={q.isFetching ? "Loading…" : "No marketplace data."} />
    </Section>
  );
}

function SellersTab({ brandId }: { brandId: number }) {
  const { marketplace } = useApp();
  const q = useQuery({
    queryKey: ["brand-sellers", brandId, marketplace],
    queryFn: () => fetchBrandSellers(brandId, marketplace),
  });
  useReportedError(q.error);

  const columns: Column<BrandSeller>[] = [
    { key: "sellerName", header: "Seller", sortKey: "sellerName", sortValue: (r) => r.sellerName, render: (r) => <span className="font-medium">{text(r.sellerName)}</span> },
    { key: "amazonSellerId", header: "Amazon ID", render: (r) => <span className="text-xs text-muted">{text(r.amazonSellerId)}</span> },
    { key: "estimateBrandPercentage", header: "Brand coverage", sortKey: "estimateBrandPercentage", align: "right", sortValue: (r) => r.estimateBrandPercentage, render: (r) => pct(r.estimateBrandPercentage) },
    { key: "monthlyRevenue", header: "Monthly rev.", sortKey: "monthlyRevenue", align: "right", sortValue: (r) => r.monthlyRevenue, render: (r) => money(r.monthlyRevenue) },
    { key: "numberOffers", header: "Offers", sortKey: "numberOffers", align: "right", sortValue: (r) => r.numberOffers, render: (r) => count(r.numberOffers) },
    { key: "moMCoverageChange", header: "MoM Δ", sortKey: "moMCoverageChange", align: "right", sortValue: (r) => r.moMCoverageChange, render: (r) => pct(r.moMCoverageChange) },
  ];

  return (
    <Section title={`${q.data?.returned ?? 0} sellers`} loading={q.isFetching}>
      <DataTable rows={q.data?.sellers ?? []} columns={columns} getRowKey={(r, i) => r.sellerId ?? r.amazonSellerId ?? i} emptyText={q.isFetching ? "Loading…" : "No sellers."} />
    </Section>
  );
}

function SearchTermsTab({ brandId }: { brandId: number }) {
  const { marketplace } = useApp();
  const [sort, setSort] = useState<{ by: string; dir: SortDir }>({ by: "searchTerm.estimateSearches", dir: "desc" });
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["brand-search-terms", brandId, marketplace, sort, page],
    placeholderData: keepPreviousData,
    queryFn: () => fetchBrandSearchTerms(brandId, { sortBy: sort.by, sortDir: sort.dir, page, pageSize: PAGE_SIZE, marketplace }),
  });
  useReportedError(q.error);

  const rows = q.data?.searchTerms ?? [];
  const total = q.data?.totalRowCount ?? null;
  const hasMore = total !== null ? page * PAGE_SIZE < total : rows.length === PAGE_SIZE;

  const columns: Column<BrandSearchTerm>[] = [
    { key: "searchTerm", header: "Search term", sortKey: "searchTerm.searchTermValue", render: (r) => <span className="font-medium">{text(r.searchTerm)}</span> },
    { key: "estimateSearches", header: "Searches/mo", sortKey: "searchTerm.estimateSearches", align: "right", render: (r) => count(r.estimateSearches) },
    { key: "totalKeywordSales", header: "Keyword sales", sortKey: "searchTerm.totalKeywordSales", align: "right", render: (r) => money(r.totalKeywordSales) },
    { key: "opportunityScore", header: "Opp.", sortKey: "searchTerm.opportunityScore", align: "right", render: (r) => num1(r.opportunityScore) },
    { key: "estimatedCpc", header: "Est. CPC", sortKey: "searchTerm.estimatedCpc", align: "right", render: (r) => money(r.estimatedCpc, true) },
    { key: "topSpotWinRate", header: "Top-spot win", sortKey: "topSpotWinRate", align: "right", render: (r) => pct(r.topSpotWinRate) },
    { key: "totalAdSpend", header: "Ad spend", sortKey: "totalAdSpend", align: "right", render: (r) => money(r.totalAdSpend) },
  ];

  return (
    <Section
      title={total !== null ? `${count(total)} search terms` : `${rows.length} search terms`}
      loading={q.isFetching}
      pager={{ page, hasMore, onPrev: () => setPage((p) => p - 1), onNext: () => setPage((p) => p + 1), disabled: q.isFetching }}
    >
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r, i) => r.searchTerm ?? i}
        sort={sort}
        onSortChange={(by, dir) => { setSort({ by, dir }); setPage(1); }}
        emptyText={q.isFetching ? "Loading…" : "No search terms."}
      />
    </Section>
  );
}

function Section({
  title,
  loading,
  pager,
  children,
}: {
  title: string;
  loading?: boolean;
  pager?: { page: number; hasMore: boolean; onPrev: () => void; onNext: () => void; disabled?: boolean };
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm text-muted">
        <span>
          {title}
          {loading ? " · loading…" : ""}
        </span>
        {pager && (
          <span className="flex items-center gap-2">
            <button className="btn-ghost py-1" disabled={pager.page <= 1 || pager.disabled} onClick={pager.onPrev}>
              Prev
            </button>
            <span>Page {pager.page}</span>
            <button className="btn-ghost py-1" disabled={!pager.hasMore || pager.disabled} onClick={pager.onNext}>
              Next
            </button>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
