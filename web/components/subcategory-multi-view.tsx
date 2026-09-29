"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { exportSubcategoryDataXlsx, type BrandExportSections } from "@/lib/api";
import { useApp } from "./app-context";
import { SubcategoryCombobox, type SubcategorySelection } from "./subcategory-combobox";

const SECTION_META: { key: keyof BrandExportSections; label: string; hint: string }[] = [
  { key: "overview", label: "Brand data", hint: "One row per brand — score, revenue, rating, growth…" },
  { key: "products", label: "Products", hint: "All ASINs per brand — revenue, rank, price, reviews…" },
  { key: "sellers", label: "Sellers", hint: "Sellers carrying each brand + Amazon seller-page links" },
  { key: "searchTerms", label: "Search terms", hint: "Ranking keywords, volume, CPC, ad spend" },
  { key: "marketplaces", label: "Marketplaces", hint: "Per-marketplace revenue, units, rating" },
];

function n(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

export function SubcategoryMultiView() {
  const { marketplace, reportError } = useApp();
  const [subs, setSubs] = useState<SubcategorySelection[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState({ minRevenue: "", maxRevenue: "", minAvgSellers: "", maxAvgSellers: "" });
  const [sections, setSections] = useState<BrandExportSections>({
    overview: true,
    products: true,
    sellers: true,
    searchTerms: true,
    marketplaces: true,
  });

  const anySection = Object.values(sections).some(Boolean);

  function add(sel: SubcategorySelection | null) {
    if (!sel) return;
    if (sel.isParent) {
      setNote("Pick leaf subcategories (a “branch” aggregates and returns no brands).");
      return;
    }
    setSubs((list) => (list.some((x) => x.id === sel.id) ? list : [...list, sel]));
    setNote(null);
    setPickerKey((k) => k + 1); // remount the picker to clear it for the next add
  }
  function remove(id: number) {
    setSubs((list) => list.filter((x) => x.id !== id));
  }

  const exportMut = useMutation({
    mutationFn: () => {
      if (subs.length === 0) throw new Error("Add at least one subcategory.");
      if (!anySection) throw new Error("Select at least one section.");
      return exportSubcategoryDataXlsx({
        subcategories: subs.map((s) => ({ id: s.id, name: s.name, path: s.path })),
        minRevenue: n(form.minRevenue),
        maxRevenue: n(form.maxRevenue),
        minAvgSellers: n(form.minAvgSellers),
        maxAvgSellers: n(form.maxAvgSellers),
        sections,
        marketplace,
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
        <label className="label">Add niche subcategories</label>
        <SubcategoryCombobox key={pickerKey} value={null} onChange={add} />
        {note && <p className="mt-1 text-xs text-neg">{note}</p>}
        <p className="mt-1 text-xs text-muted">
          Pick several leaf niches (e.g. Dog Belly Bands, Raised Cat Bowls, Reusable Dog Training Pads).
          The export gathers every brand across all of them. IDs are per-marketplace ({marketplace}).
        </p>

        {subs.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{subs.length} subcategory{subs.length > 1 ? "s" : ""} selected</span>
              <button className="btn-ghost py-1" onClick={() => setSubs([])}>
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {subs.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface2 py-1 pl-3 pr-1.5 text-sm"
                  title={s.path}
                >
                  <span className="font-medium">{s.name}</span>
                  <button
                    className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-neg hover:text-white"
                    onClick={() => remove(s.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {subs.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
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
          </div>

          <p className="mb-2 text-sm font-medium">Include these sheets:</p>
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
            <button className="btn-primary" disabled={!anySection || exportMut.isPending} onClick={() => exportMut.mutate()}>
              {exportMut.isPending ? "Exporting… (may take minutes)" : "⬇ Export data (Excel)"}
            </button>
            {!anySection && <span className="text-xs text-neg">Select at least one section.</span>}
            <span className="text-xs text-muted">Up to 150 brands across all niches · de-duplicated · background job.</span>
          </div>
        </div>
      )}
    </div>
  );
}
