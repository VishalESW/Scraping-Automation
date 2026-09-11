"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchBrandsSearch } from "@/lib/api";
import type { Brand, Marketplace } from "@/lib/types";
import { money } from "@/lib/format";
import { useApp } from "./app-context";

export interface BrandSelection {
  brandId: number;
  name: string;
}

export function BrandCombobox({
  value,
  onChange,
  onAdd,
}: {
  value?: BrandSelection | null;
  onChange?: (v: BrandSelection | null) => void;
  /** When provided, the combobox acts as an "add to list" input: it calls onAdd
   *  and clears itself after each pick instead of holding a single value. */
  onAdd?: (v: BrandSelection) => void;
}) {
  const { marketplace, reportError } = useApp();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    setText("");
    onChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = useQuery({
    queryKey: ["brand-search", marketplace as Marketplace, debounced],
    enabled: open && debounced.trim().length > 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchBrandsSearch({ query: debounced.trim(), sortBy: "monthlyRevenue", sortDir: "desc", pageSize: 25, marketplace }),
  });

  useEffect(() => {
    if (q.error) reportError(q.error);
  }, [q.error, reportError]);

  const results: Brand[] = q.data?.brands ?? [];

  function select(brand: Brand) {
    if (onAdd) {
      onAdd({ brandId: brand.brandId, name: brand.name });
      setText("");
      setOpen(false);
      return;
    }
    onChange?.({ brandId: brand.brandId, name: brand.name });
    setText(brand.name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Type a brand name, e.g. Gaiam, Zesty Paws…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange?.(null);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button type="button" className="btn-ghost shrink-0" onClick={() => { onChange?.(null); setText(""); }} title="Clear">
            ✕
          </button>
        )}
      </div>

      {value && (
        <div className="mt-1 text-xs text-muted">
          Selected: <span className="font-medium text-ink">{value.name}</span> · brand id {value.brandId}
        </div>
      )}

      {open && debounced.trim().length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface shadow-pop">
          {q.isFetching && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">No brands match.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.brandId}
                type="button"
                onClick={() => select(r)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accentweak"
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted">{r.subcategory ?? "—"}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted">
                  {money(r.monthlyRevenue)}/mo
                  <span className="block">id {r.brandId}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
