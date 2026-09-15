"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchSubcategories } from "@/lib/api";
import type { Marketplace, SubcategoryNode } from "@/lib/types";
import { useApp } from "./app-context";

export interface SubcategorySelection {
  id: number;
  name: string;
  /** Full breadcrumb incl. leaf, joined with " > " (for the export's Subcategory column). */
  path: string;
  /** true = aggregation branch / whole category (drives bulk export); false = leaf. */
  isParent: boolean;
}

export function SubcategoryCombobox({
  value,
  onChange,
}: {
  value: SubcategorySelection | null;
  onChange: (v: SubcategorySelection | null) => void;
}) {
  const { marketplace, reportError } = useApp();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 200);
    return () => clearTimeout(t);
  }, [text]);

  // Reset the typed text when marketplace changes (ids are marketplace-specific).
  useEffect(() => {
    setText("");
    onChange(null);
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
    queryKey: ["subcategories", marketplace as Marketplace, debounced],
    enabled: open,
    placeholderData: keepPreviousData,
    // includeBranches: also offer whole categories / branches so the user can
    // pick one for a bulk export across all its subcategories.
    queryFn: () => fetchSubcategories(debounced, marketplace, 50, true),
  });

  useEffect(() => {
    if (q.error) reportError(q.error);
  }, [q.error, reportError]);

  const results: SubcategoryNode[] = q.data?.subcategories ?? [];

  function select(node: SubcategoryNode) {
    // Full path incl. leaf, using ">" to match the reference export format.
    const ancestors = node.path ? node.path.replace(/\s*›\s*/g, " > ") : "";
    const fullPath = ancestors ? `${ancestors} > ${node.name}` : node.name;
    onChange({ id: node.id, name: node.name, path: fullPath, isParent: node.isParent === true });
    setText(node.name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Type a subcategory name, e.g. Yoga, Dog Food…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button
            type="button"
            className="btn-ghost shrink-0"
            onClick={() => {
              onChange(null);
              setText("");
            }}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {value && (
        <div className="mt-1 text-xs text-muted">
          Selected: <span className="font-medium text-ink">{value.name}</span>
          {value.isParent && (
            <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
              branch — bulk
            </span>
          )}{" "}
          · id {value.id}
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-white shadow-lg">
          {q.isFetching && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">No matches.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.name}</span>
                  {r.isParent && (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
                      branch
                    </span>
                  )}
                  {r.path ? <span className="block truncate text-xs text-muted">{r.path}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted">{r.id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
