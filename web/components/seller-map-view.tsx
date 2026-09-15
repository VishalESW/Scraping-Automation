"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import {
  fetchSellerMap,
  fetchCategories,
  fetchSellerMapPageBrands,
  exportSellerMapXlsx,
  type SellerMapInput,
} from "@/lib/api";
import { SELLER_TYPES, type MapSeller } from "@/lib/types";
import { money, count, text } from "@/lib/format";
import { useApp } from "./app-context";
import { DataTable, type Column } from "./data-table";
import { SellerDetailDrawer } from "./seller-detail-drawer";

const PAGE_SIZE = 50;

function n(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

export function SellerMapView() {
  const { marketplace, reportError } = useApp();
  const [form, setForm] = useState({
    categoryId: "",
    sellerTypeId: "",
    minRevenue: "",
    maxRevenue: "",
    sellerName: "",
    maxCount: "1000",
  });
  const [query, setQuery] = useState<SellerMapInput | null>(null);
  const [page, setPage] = useState(1);
  const [selectedSeller, setSelectedSeller] = useState<{ sellerId: number; name: string } | null>(null);

  const cats = useQuery({
    queryKey: ["categories", marketplace],
    queryFn: () => fetchCategories(marketplace),
  });
  useEffect(() => {
    if (cats.error) reportError(cats.error);
  }, [cats.error, reportError]);

  const q = useQuery({
    queryKey: ["seller-map", marketplace, query],
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => fetchSellerMap({ ...query!, marketplace }),
  });

  useEffect(() => {
    if (q.error) reportError(q.error);
  }, [q.error, reportError]);

  const allRows = useMemo(() => q.data?.sellers ?? [], [q.data]);
  const pageCount = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));

  // Keep the page in range when a new result set arrives.
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const start = (page - 1) * PAGE_SIZE;
  const pageRows = useMemo(() => allRows.slice(start, start + PAGE_SIZE), [allRows, start]);
  const pageSellerIds = useMemo(() => pageRows.map((r) => r.sellerId), [pageRows]);
  const pageKey = pageSellerIds.join(",");

  // Brand names for the CURRENT PAGE's sellers only (one brandcoverage call per
  // seller, server-side rate-limited) — so we never fetch brands for the whole set.
  const brandsQ = useQuery({
    queryKey: ["seller-map-brands", marketplace, pageKey],
    enabled: pageSellerIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchSellerMapPageBrands(pageSellerIds, marketplace),
  });
  useEffect(() => {
    if (brandsQ.error) reportError(brandsQ.error);
  }, [brandsQ.error, reportError]);

  const categoryName = (cats.data?.categories ?? []).find((c) => String(c.id) === form.categoryId)?.name;

  const exportMut = useMutation({
    mutationFn: () => {
      if (!query) throw new Error("Find sellers first.");
      // Export exactly the sellers shown on this page.
      return exportSellerMapXlsx({ ...query, categoryName, marketplace, sellers: pageRows, page });
    },
    onError: (e) => reportError(e),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery({
      categoryId: form.categoryId.trim() || undefined,
      sellerTypeId: form.sellerTypeId || undefined,
      minRevenue: n(form.minRevenue),
      maxRevenue: n(form.maxRevenue),
      sellerName: form.sellerName.trim() || undefined,
      maxCount: n(form.maxCount) ?? 1000,
    });
  }

  const columns: Column<MapSeller>[] = [
    { key: "name", header: "Seller", sortKey: "name", sortValue: (r) => r.name, render: (r) => <span className="font-medium">{text(r.name)}</span> },
    { key: "estimateSales", header: "Est. monthly sales", sortKey: "estimateSales", align: "right", sortValue: (r) => r.estimateSales, render: (r) => money(r.estimateSales) },
    { key: "sellerTypeId", header: "Type", sortKey: "sellerTypeId", sortValue: (r) => r.sellerTypeId, render: (r) => text(r.sellerTypeId) },
    {
      key: "brands",
      header: "Brands",
      render: (r) => {
        const list = brandsQ.data?.brandsBySeller?.[r.sellerId];
        if (!list) {
          return <span className="text-muted">{brandsQ.isFetching ? "Loading…" : "—"}</span>;
        }
        if (list.length === 0) return <span className="text-muted">—</span>;
        const names = list.map((b) => b.brandName).filter(Boolean).join(", ");
        return (
          <div
            className="max-h-24 max-w-[22rem] overflow-auto whitespace-normal text-xs leading-relaxed"
            onClick={(e) => e.stopPropagation()}
            title={names}
          >
            <span className="mr-1 rounded bg-accentweak px-1 text-[10px] font-medium text-muted">{list.length}</span>
            {names}
          </div>
        );
      },
    },
    {
      key: "geo",
      header: "Location",
      render: (r) =>
        r.latitude !== null && r.longitude !== null ? (
          <a
            className="text-brand hover:underline"
            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
          </a>
        ) : (
          "—"
        ),
    },
  ];

  const from = allRows.length === 0 ? 0 : start + 1;
  const to = Math.min(start + PAGE_SIZE, allRows.length);

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div>
            <label className="label">Category</label>
            <select className="field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">{cats.isFetching ? "Loading…" : "All categories"}</option>
              {(cats.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Seller type</label>
            <select className="field" value={form.sellerTypeId} onChange={(e) => setForm({ ...form, sellerTypeId: e.target.value })}>
              <option value="">Any</option>
              {SELLER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Min revenue</label>
            <input className="field" inputMode="numeric" value={form.minRevenue} onChange={(e) => setForm({ ...form, minRevenue: e.target.value })} />
          </div>
          <div>
            <label className="label">Max revenue</label>
            <input className="field" inputMode="numeric" value={form.maxRevenue} onChange={(e) => setForm({ ...form, maxRevenue: e.target.value })} />
          </div>
          <div>
            <label className="label">Seller name</label>
            <input className="field" value={form.sellerName} onChange={(e) => setForm({ ...form, sellerName: e.target.value })} />
          </div>
          <div>
            <label className="label">Max results</label>
            <input className="field" inputMode="numeric" value={form.maxCount} onChange={(e) => setForm({ ...form, maxCount: e.target.value })} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="btn-primary">
            {q.isFetching ? "Searching…" : "Find sellers"}
          </button>
          <span className="text-xs text-muted">
            Find sellers by category/type/revenue. Results paginate {PAGE_SIZE}/page; each page shows every
            seller&apos;s brands and exports on its own.
          </span>
        </div>
      </form>

      {query && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-sm text-muted">
            <span>
              {allRows.length === 0
                ? "No sellers"
                : `Showing ${from}–${to} of ${allRows.length} sellers`}{" "}
              · click a seller for its brands
            </span>
            <button
              className="btn-ghost py-1"
              disabled={exportMut.isPending || pageRows.length === 0}
              onClick={() => exportMut.mutate()}
              title="Export this page's sellers + their brands, products & marketplaces"
            >
              {exportMut.isPending ? "Exporting… (may take minutes)" : `⬇ Export page ${page}`}
            </button>
          </div>
          <DataTable
            rows={pageRows}
            columns={columns}
            getRowKey={(r) => r.sellerId}
            onRowClick={(r) => setSelectedSeller({ sellerId: r.sellerId, name: r.name ?? String(r.sellerId) })}
            emptyText={q.isFetching ? "Loading…" : "No sellers for these filters."}
          />
          {allRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-sm">
              <button
                className="btn-ghost py-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span className="text-muted">
                Page {page} of {pageCount}
              </span>
              <button
                className="btn-ghost py-1"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {selectedSeller && (
        <SellerDetailDrawer
          sellerId={selectedSeller.sellerId}
          sellerName={selectedSeller.name}
          onClose={() => setSelectedSeller(null)}
        />
      )}
    </div>
  );
}
