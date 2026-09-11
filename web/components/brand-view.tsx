"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { exportBrandXlsx, type BrandExportSections } from "@/lib/api";
import { useApp } from "./app-context";
import { BrandCombobox, type BrandSelection } from "./brand-combobox";
import { BrandDetailDrawer } from "./brand-detail-drawer";

const SECTION_META: { key: keyof BrandExportSections; label: string; hint: string }[] = [
  { key: "overview", label: "Overview", hint: "Brand-wide stats (score, revenue, rating, growth…)" },
  { key: "products", label: "Products", hint: "All ASINs with revenue, rank, price, reviews…" },
  { key: "sellers", label: "Sellers", hint: "Sellers carrying the brand + Amazon seller-page links" },
  { key: "searchTerms", label: "Search terms", hint: "Ranking keywords, search volume, CPC, ad spend" },
  { key: "marketplaces", label: "Marketplaces", hint: "Per-marketplace revenue, units, in-stock, rating" },
];

export function BrandView() {
  const { marketplace, reportError } = useApp();
  const [brand, setBrand] = useState<BrandSelection | null>(null);
  const [openDetails, setOpenDetails] = useState(false);
  const [sections, setSections] = useState<BrandExportSections>({
    overview: true,
    products: true,
    sellers: true,
    searchTerms: true,
    marketplaces: true,
  });

  const anySelected = Object.values(sections).some(Boolean);

  const exportMut = useMutation({
    mutationFn: () => {
      if (!brand) throw new Error("Select a brand first.");
      return exportBrandXlsx({ brandId: brand.brandId, brandName: brand.name, marketplace, sections });
    },
    onError: (e) => reportError(e),
  });

  function toggle(key: keyof BrandExportSections) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label">Brand *</label>
        <BrandCombobox value={brand} onChange={setBrand} />
        <p className="mt-2 text-xs text-muted">
          Search a brand by name, choose what to include, then export — products, sellers (with
          Amazon seller-page links), search terms &amp; marketplaces. Per-marketplace IDs ({marketplace}).
        </p>
      </div>

      {brand && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{brand.name}</h2>
              <p className="text-xs text-muted">Include these sheets in the Excel report:</p>
            </div>
            <button className="btn-ghost" onClick={() => setOpenDetails(true)}>
              Open details
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SECTION_META.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors ${
                  sections[s.key] ? "border-brand bg-accentweak" : "border-line hover:border-linestrong"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand"
                  checked={sections[s.key]}
                  onChange={() => toggle(s.key)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="btn-primary"
              disabled={!anySelected || exportMut.isPending}
              onClick={() => exportMut.mutate()}
            >
              {exportMut.isPending ? "Exporting…" : "⬇ Export Excel"}
            </button>
            {!anySelected && <span className="text-xs text-neg">Select at least one section.</span>}
          </div>
        </div>
      )}

      {brand && openDetails && (
        <BrandDetailDrawer
          brandId={brand.brandId}
          brandName={brand.name}
          onClose={() => setOpenDetails(false)}
        />
      )}
    </div>
  );
}
