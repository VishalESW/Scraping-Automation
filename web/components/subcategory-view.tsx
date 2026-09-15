"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import {
  fetchSubcategoryBrands,
  fetchSubcategoryExpand,
  exportSubcategoryXlsx,
  exportSubcategoryBulkXlsx,
  type SubcategoryBrandsInput,
} from "@/lib/api";
import type { SortDir, SubcategoryBrand } from "@/lib/types";
import { money, count, num1 } from "@/lib/format";
import { useApp } from "./app-context";
import { DataTable, type Column } from "./data-table";
import { BrandDetailDrawer } from "./brand-detail-drawer";
import { SubcategoryCombobox, type SubcategorySelection } from "./subcategory-combobox";

const PAGE_SIZE = 50;

interface Query {
  subcategoryId: string;
  minRevenue?: number;
  maxRevenue?: number;
  minAvgSellers?: number;
  maxAvgSellers?: number;
  sortBy: string;
  sortDir: SortDir;
  page: number;
}

function n(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

export function SubcategoryView() {
  const { marketplace, reportError } = useApp();
  const [sub, setSub] = useState<SubcategorySelection | null>(null);
  const [form, setForm] = useState({
    minRevenue: "",
    maxRevenue: "",
    minAvgSellers: "",
    maxAvgSellers: "",
    brandsPerSub: "100",
  });
  const [query, setQuery] = useState<Query | null>(null);
  const [selected, setSelected] = useState<{ brandId: number; name: string } | null>(null);

  const isBulk = sub?.isParent === true;

  // Selecting a branch clears any single-subcategory result table.
  useEffect(() => {
    if (isBulk) setQuery(null);
  }, [isBulk, sub?.id]);

  const q = useQuery({
    queryKey: ["subcategory-brands", marketplace, query],
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const input: SubcategoryBrandsInput = {
        subcategoryId: query!.subcategoryId,
        minRevenue: query!.minRevenue,
        maxRevenue: query!.maxRevenue,
        minAvgSellers: query!.minAvgSellers,
        maxAvgSellers: query!.maxAvgSellers,
        sortBy: query!.sortBy,
        sortDir: query!.sortDir,
        page: query!.page,
        pageSize: PAGE_SIZE,
        marketplace,
      };
      return fetchSubcategoryBrands(input);
    },
  });

  useEffect(() => {
    if (q.error) reportError(q.error);
  }, [q.error, reportError]);

  // Branch expansion (how many subcategories a whole category/branch covers).
  const expandQ = useQuery({
    queryKey: ["subcategory-expand", marketplace, sub?.id],
    enabled: isBulk && !!sub,
    queryFn: () => fetchSubcategoryExpand(sub!.id, marketplace),
  });
  useEffect(() => {
    if (expandQ.error) reportError(expandQ.error);
  }, [expandQ.error, reportError]);

  const exportMut = useMutation({
    mutationFn: () => {
      if (!query || !sub) throw new Error("Run a search first.");
      return exportSubcategoryXlsx({
        subcategoryId: query.subcategoryId,
        subcategoryPath: sub.path,
        minRevenue: query.minRevenue,
        maxRevenue: query.maxRevenue,
        minAvgSellers: query.minAvgSellers,
        maxAvgSellers: query.maxAvgSellers,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        marketplace,
      });
    },
    onError: (e) => reportError(e),
  });

  const bulkExportMut = useMutation({
    mutationFn: () => {
      if (!sub) throw new Error("Pick a branch first.");
      return exportSubcategoryBulkXlsx({
        nodeId: sub.id,
        brandsPerSubcategory: n(form.brandsPerSub),
        minRevenue: n(form.minRevenue),
        maxRevenue: n(form.maxRevenue),
        minAvgSellers: n(form.minAvgSellers),
        maxAvgSellers: n(form.maxAvgSellers),
        marketplace,
      });
    },
    onError: (e) => reportError(e),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sub) return;
    if (isBulk) {
      bulkExportMut.mutate();
      return;
    }
    setQuery({
      subcategoryId: String(sub.id),
      minRevenue: n(form.minRevenue),
      maxRevenue: n(form.maxRevenue),
      minAvgSellers: n(form.minAvgSellers),
      maxAvgSellers: n(form.maxAvgSellers),
      sortBy: "revenue",
      sortDir: "desc",
      page: 1,
    });
  }

  const columns: Column<SubcategoryBrand>[] = [
    { key: "brandName", header: "Brand", sortKey: "brandName", render: (r) => <span className="font-medium">{r.brandName}</span> },
    { key: "revenue", header: "Monthly rev.", sortKey: "revenue", align: "right", render: (r) => money(r.revenue) },
    { key: "marketshare", header: "Mkt share", sortKey: "marketshare", align: "right", render: (r) => num1(r.marketshare) },
    { key: "moMMktShareChange", header: "MoM Δ", sortKey: "moMMktShareChange", align: "right", render: (r) => num1(r.moMMktShareChange) },
    { key: "numberASINs", header: "ASINs", sortKey: "numberASINs", align: "right", render: (r) => count(r.numberASINs) },
    { key: "avgNumberSellers", header: "Avg sellers", sortKey: "avgNumberSellers", align: "right", render: (r) => num1(r.avgNumberSellers) },
    { key: "avgPrice", header: "Avg price", sortKey: "avgPrice", align: "right", render: (r) => money(r.avgPrice, true) },
    { key: "totalReviews", header: "Reviews", sortKey: "totalReviews", align: "right", render: (r) => count(r.totalReviews) },
    { key: "reviewRating", header: "Rating", sortKey: "reviewRating", align: "right", render: (r) => num1(r.reviewRating) },
  ];

  const rows = q.data?.brands ?? [];
  const total = q.data?.totalRowCount ?? null;
  const page = query?.page ?? 1;
  const hasMore = total !== null ? page * PAGE_SIZE < total : rows.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="col-span-2 md:col-span-3">
            <label className="label">Subcategory or branch *</label>
            <SubcategoryCombobox value={sub} onChange={setSub} />
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
            <label className="label">Min avg sellers</label>
            <input className="field" inputMode="numeric" value={form.minAvgSellers} onChange={(e) => setForm({ ...form, minAvgSellers: e.target.value })} />
          </div>
          <div>
            <label className="label">Max avg sellers</label>
            <input className="field" inputMode="numeric" value={form.maxAvgSellers} onChange={(e) => setForm({ ...form, maxAvgSellers: e.target.value })} />
          </div>
          {isBulk && (
            <div>
              <label className="label">Brands / subcategory</label>
              <input className="field" inputMode="numeric" value={form.brandsPerSub} onChange={(e) => setForm({ ...form, brandsPerSub: e.target.value })} />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          {isBulk ? (
            <button type="submit" className="btn-primary" disabled={!sub || bulkExportMut.isPending}>
              {bulkExportMut.isPending ? "Exporting… (may take minutes)" : "⬇ Bulk export brands"}
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={!sub}>
              {q.isFetching ? "Searching…" : "Search brands"}
            </button>
          )}
          <span className="text-xs text-muted">
            {isBulk
              ? `Bulk mode: exports brands from every subcategory under this branch (${marketplace}).`
              : `Pick a subcategory (leaf) to browse brands, or a branch to bulk-export. IDs are per-marketplace (${marketplace}).`}
          </span>
        </div>
      </form>

      {isBulk && sub && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-medium text-ink">{sub.path}</span>
              <div className="text-xs text-muted">
                {expandQ.isFetching
                  ? "Counting subcategories…"
                  : expandQ.data
                    ? `${count(expandQ.data.count)} subcategories under this branch. Bulk export pulls up to ` +
                      `${n(form.brandsPerSub) ?? 100} brands from each (brands only — products omitted for scale).`
                    : "—"}
              </div>
            </div>
            <button
              className="btn-ghost py-1"
              disabled={bulkExportMut.isPending || !expandQ.data || expandQ.data.count === 0}
              onClick={() => bulkExportMut.mutate()}
            >
              {bulkExportMut.isPending ? "Exporting… (may take minutes)" : "⬇ Bulk export brands"}
            </button>
          </div>
          {expandQ.data && expandQ.data.count > 500 && (
            <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This branch has {count(expandQ.data.count)} subcategories; the export is capped at the 500
              highest-revenue ones. Pick a narrower branch to cover the rest.
            </div>
          )}
          {expandQ.data && expandQ.data.subcategories.length > 0 && (
            <div className="mt-3 max-h-56 overflow-auto rounded border border-line">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="th">Subcategory</th>
                    <th className="th text-right">Monthly revenue</th>
                    <th className="th text-right">Brands</th>
                  </tr>
                </thead>
                <tbody>
                  {expandQ.data.subcategories.map((s) => (
                    <tr key={s.id} className="border-b border-line">
                      <td className="td">{s.path}</td>
                      <td className="td text-right tabular-nums">{money(s.totalMonthlyRevenue)}</td>
                      <td className="td text-right tabular-nums">{count(s.totalBrands)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isBulk && query && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-sm text-muted">
            <span>
              {total !== null ? `${count(total)} brands` : `${rows.length} brands`} · click a row for products, marketplaces, sellers &amp; keywords
            </span>
            <span className="flex items-center gap-2">
              <button
                className="btn-ghost py-1"
                disabled={exportMut.isPending || rows.length === 0}
                onClick={() => exportMut.mutate()}
                title="Export brands + all their products to Excel"
              >
                {exportMut.isPending ? "Exporting…" : "⬇ Export Excel"}
              </button>
              <button
                className="btn-ghost py-1"
                disabled={page <= 1 || q.isFetching}
                onClick={() => setQuery({ ...query, page: page - 1 })}
              >
                Prev
              </button>
              <span>Page {page}</span>
              <button
                className="btn-ghost py-1"
                disabled={!hasMore || q.isFetching}
                onClick={() => setQuery({ ...query, page: page + 1 })}
              >
                Next
              </button>
            </span>
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(r) => r.brandId}
            onRowClick={(r) => setSelected({ brandId: r.brandId, name: r.brandName })}
            sort={{ by: query.sortBy, dir: query.sortDir }}
            onSortChange={(by, dir) => setQuery({ ...query, sortBy: by, sortDir: dir, page: 1 })}
            emptyText={q.isFetching ? "Loading…" : "No brands for these filters."}
          />
        </div>
      )}

      {selected && (
        <BrandDetailDrawer
          brandId={selected.brandId}
          brandName={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
