"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { exportBrandXlsx, resolveBrands, type BrandExportSections } from "@/lib/api";
import { useApp } from "./app-context";
import { BrandCombobox, type BrandSelection } from "./brand-combobox";
import { BrandDetailDrawer } from "./brand-detail-drawer";

const MAX_SELECTED = 250; // matches the export cap (BR_MAX_BRANDS)

const SECTION_META: { key: keyof BrandExportSections; label: string; hint: string }[] = [
  { key: "overview", label: "Brand data", hint: "One row per brand — score, revenue, rating, growth, product count…" },
  { key: "products", label: "Products", hint: "All ASINs with revenue, rank, price, reviews…" },
  { key: "sellers", label: "Sellers", hint: "Sellers carrying the brand + Amazon seller-page links" },
  { key: "searchTerms", label: "Search terms", hint: "Ranking keywords, search volume, CPC, ad spend" },
  { key: "marketplaces", label: "Marketplaces", hint: "Per-marketplace revenue, units, in-stock, rating" },
];

export function BrandView() {
  const { marketplace, reportError } = useApp();
  const [brands, setBrands] = useState<BrandSelection[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [notFound, setNotFound] = useState<string[]>([]);
  const [resolveProgress, setResolveProgress] = useState<{ done: number; total: number } | null>(null);
  const [capNote, setCapNote] = useState<string | null>(null);
  const [details, setDetails] = useState<BrandSelection | null>(null);
  const [sections, setSections] = useState<BrandExportSections>({
    overview: true,
    products: true,
    sellers: true,
    searchTerms: true,
    marketplaces: true,
  });

  const anySelected = Object.values(sections).some(Boolean);

  function addBrand(b: BrandSelection) {
    setBrands((list) => {
      if (list.some((x) => x.brandId === b.brandId)) return list;
      if (list.length >= MAX_SELECTED) {
        setCapNote(`You can select up to ${MAX_SELECTED} brands.`);
        return list;
      }
      return [...list, b];
    });
  }
  function removeBrand(id: number) {
    setBrands((list) => list.filter((x) => x.brandId !== id));
  }

  const resolveMut = useMutation({
    mutationFn: async () => {
      const names = bulkText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) throw new Error("Enter one or more brand names.");
      setResolveProgress({ done: 0, total: new Set(names).size });
      return resolveBrands(names, marketplace, (done, total) => setResolveProgress({ done, total }));
    },
    onSuccess: (res) => {
      const miss: string[] = [];
      const found: BrandSelection[] = [];
      for (const r of res.resolved) {
        if (r.found && r.brandId != null) found.push({ brandId: r.brandId, name: r.brandName ?? r.query });
        else miss.push(r.query);
      }
      // Merge into the current selection, de-duped, capped at MAX_SELECTED.
      let overflow = 0;
      setBrands((list) => {
        const seen = new Set(list.map((x) => x.brandId));
        const next = [...list];
        for (const b of found) {
          if (seen.has(b.brandId)) continue;
          if (next.length >= MAX_SELECTED) {
            overflow += 1;
            continue;
          }
          seen.add(b.brandId);
          next.push(b);
        }
        return next;
      });
      setNotFound(miss);
      setCapNote(
        overflow > 0
          ? `Reached the ${MAX_SELECTED}-brand cap; ${overflow} resolved brand${overflow === 1 ? "" : "s"} not added.`
          : null,
      );
      setBulkText("");
    },
    onError: (e) => reportError(e),
    onSettled: () => setResolveProgress(null),
  });

  const exportMut = useMutation({
    mutationFn: () => {
      if (brands.length === 0) throw new Error("Add at least one brand.");
      return exportBrandXlsx({
        brands: brands.map((b) => ({ brandId: b.brandId, brandName: b.name })),
        marketplace,
        sections,
      });
    },
    onError: (e) => reportError(e),
  });

  function toggle(key: keyof BrandExportSections) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label">Add a brand</label>
        <BrandCombobox onAdd={addBrand} />

        <div className="mt-4">
          <label className="label">Or paste multiple brand names (one per line, or comma-separated)</label>
          <textarea
            className="field font-sans"
            rows={4}
            placeholder={"Gaiam\nZesty Paws\nPet Honesty"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="btn-ghost"
              disabled={resolveMut.isPending || bulkText.trim() === ""}
              onClick={() => resolveMut.mutate()}
            >
              {resolveMut.isPending
                ? resolveProgress
                  ? `Resolving… (${resolveProgress.done}/${resolveProgress.total})`
                  : "Resolving…"
                : "Resolve & add"}
            </button>
            <span className="text-xs text-muted">
              Matches each name to a brand (best match). Any number of names — resolved in batches
              (up to {MAX_SELECTED} selected). Per-marketplace IDs ({marketplace}).
            </span>
          </div>
          {capNote && <p className="mt-2 text-xs text-neg">{capNote}</p>}
          {notFound.length > 0 && (
            <p className="mt-2 text-xs text-neg">Not found ({notFound.length}): {notFound.join(", ")}</p>
          )}
        </div>
      </div>

      {brands.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{brands.length} brand{brands.length > 1 ? "s" : ""} selected</h2>
            <button className="btn-ghost py-1" onClick={() => setBrands([])}>
              Clear all
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <span key={b.brandId} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface2 py-1 pl-3 pr-1.5 text-sm">
                <button className="font-medium hover:text-brand" onClick={() => setDetails(b)} title="Open details">
                  {b.name}
                </button>
                <button
                  className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-neg hover:text-white"
                  onClick={() => removeBrand(b.brandId)}
                  title="Remove"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {brands.length > 0 && (
        <div className="card p-4">
          <p className="mb-3 text-sm font-medium">Include these sheets in the Excel report:</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SECTION_META.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors ${
                  sections[s.key] ? "border-brand bg-accentweak" : "border-line hover:border-linestrong"
                }`}
              >
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={sections[s.key]} onChange={() => toggle(s.key)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" disabled={!anySelected || exportMut.isPending} onClick={() => exportMut.mutate()}>
              {exportMut.isPending ? "Exporting…" : `⬇ Export Excel (${brands.length})`}
            </button>
            {!anySelected && <span className="text-xs text-neg">Select at least one section.</span>}
            {brands.length > 8 && <span className="text-xs text-muted">Large sets take a few minutes (rate-limited).</span>}
          </div>
        </div>
      )}

      {details && (
        <BrandDetailDrawer brandId={details.brandId} brandName={details.name} onClose={() => setDetails(null)} />
      )}
    </div>
  );
}
