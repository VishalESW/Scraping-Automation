"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { fetchSellerMap, fetchCategories, exportSellerMapXlsx, type SellerMapInput } from "@/lib/api";
import { SELLER_TYPES, type MapSeller } from "@/lib/types";
import { money, count, text } from "@/lib/format";
import { useApp } from "./app-context";
import { DataTable, type Column } from "./data-table";
import { SellerDetailDrawer } from "./seller-detail-drawer";

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
    maxCount: "100",
  });
  const [query, setQuery] = useState<SellerMapInput | null>(null);
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

  const categoryName = (cats.data?.categories ?? []).find((c) => String(c.id) === form.categoryId)?.name;

  const exportMut = useMutation({
    mutationFn: () => {
      if (!query) throw new Error("Find sellers first.");
      return exportSellerMapXlsx({ ...query, categoryName, marketplace });
    },
    onError: (e) => reportError(e),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setQuery({
      categoryId: form.categoryId.trim() || undefined,
      sellerTypeId: form.sellerTypeId || undefined,
      minRevenue: n(form.minRevenue),
      maxRevenue: n(form.maxRevenue),
      sellerName: form.sellerName.trim() || undefined,
      maxCount: n(form.maxCount) ?? 100,
    });
  }

  const columns: Column<MapSeller>[] = [
    { key: "name", header: "Seller", sortKey: "name", sortValue: (r) => r.name, render: (r) => <span className="font-medium">{text(r.name)}</span> },
    { key: "estimateSales", header: "Est. monthly sales", sortKey: "estimateSales", align: "right", sortValue: (r) => r.estimateSales, render: (r) => money(r.estimateSales) },
    { key: "sellerTypeId", header: "Type", sortKey: "sellerTypeId", sortValue: (r) => r.sellerTypeId, render: (r) => text(r.sellerTypeId) },
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
          >
            {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
          </a>
        ) : (
          "—"
        ),
    },
  ];

  const rows = q.data?.sellers ?? [];

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
            Find sellers by category/type/revenue, then click a seller to see its brands → products &amp; marketplaces.
          </span>
        </div>
      </form>

      {query && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-sm text-muted">
            <span>{rows.length} sellers (top by estimated sales) · click a seller for its brands</span>
            <button
              className="btn-ghost py-1"
              disabled={exportMut.isPending || rows.length === 0}
              onClick={() => exportMut.mutate()}
              title="Export sellers + their brands, products & marketplaces (capped; can take a few minutes)"
            >
              {exportMut.isPending ? "Exporting… (may take minutes)" : "⬇ Export Excel"}
            </button>
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(r) => r.sellerId}
            onRowClick={(r) => setSelectedSeller({ sellerId: r.sellerId, name: r.name ?? String(r.sellerId) })}
            emptyText={q.isFetching ? "Loading…" : "No sellers for these filters."}
          />
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
