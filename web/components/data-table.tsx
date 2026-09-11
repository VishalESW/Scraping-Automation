"use client";

import { useMemo, useState } from "react";
import type { SortDir } from "@/lib/types";

export interface Column<T> {
  key: string;
  header: string;
  /** Server column id — presence makes the column sortable. */
  sortKey?: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Value used for client-side sorting when the table is uncontrolled. */
  sortValue?: (row: T) => number | string | null | undefined;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T, i: number) => string | number;
  onRowClick?: (row: T) => void;
  /** Controlled (server) sort. When set, header clicks call onSortChange. */
  sort?: { by: string; dir: SortDir };
  onSortChange?: (by: string, dir: SortDir) => void;
  emptyText?: string;
}

function Arrow({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-brand">{dir === "asc" ? "↑" : "↓"}</span>;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  sort,
  onSortChange,
  emptyText = "No rows.",
}: Props<T>) {
  const controlled = Boolean(sort && onSortChange);
  const [localSort, setLocalSort] = useState<{ by: string; dir: SortDir } | null>(null);

  const sortedRows = useMemo(() => {
    if (controlled || !localSort) return rows;
    const col = columns.find((c) => c.sortKey === localSort.by);
    if (!col) return rows;
    const val = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as number | string);
    const dir = localSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, columns, localSort, controlled]);

  function headerClick(col: Column<T>) {
    if (!col.sortKey) return;
    if (controlled && sort && onSortChange) {
      const dir: SortDir = sort.by === col.sortKey && sort.dir === "desc" ? "asc" : "desc";
      onSortChange(col.sortKey, dir);
    } else {
      const sortKey = col.sortKey;
      setLocalSort((prev) =>
        prev && prev.by === sortKey
          ? { by: sortKey, dir: prev.dir === "desc" ? "asc" : "desc" }
          : { by: sortKey, dir: "desc" },
      );
    }
  }

  function dirFor(col: Column<T>): SortDir | null {
    if (!col.sortKey) return null;
    const active = controlled ? sort : localSort;
    return active && active.by === col.sortKey ? active.dir : null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`th ${c.align === "right" ? "text-right" : ""} ${c.sortKey ? "cursor-pointer hover:text-ink" : ""}`}
                onClick={() => headerClick(c)}
              >
                {c.header}
                {c.sortKey ? <Arrow dir={dirFor(c)} /> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td className="td text-muted" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                className={`border-b border-line ${onRowClick ? "cursor-pointer hover:bg-indigo-50" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`td ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
