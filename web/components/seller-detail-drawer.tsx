"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSellerBrands } from "@/lib/api";
import type { SellerBrand } from "@/lib/types";
import { money, count, num1, pct, text } from "@/lib/format";
import { useApp } from "./app-context";
import { DataTable, type Column } from "./data-table";
import { BrandDetailDrawer } from "./brand-detail-drawer";

export function SellerDetailDrawer({
  sellerId,
  sellerName,
  onClose,
}: {
  sellerId: number;
  sellerName: string;
  onClose: () => void;
}) {
  const { marketplace, reportError } = useApp();
  const [selectedBrand, setSelectedBrand] = useState<{ brandId: number; name: string } | null>(null);

  const q = useQuery({
    queryKey: ["seller-brands", sellerId, marketplace],
    queryFn: () => fetchSellerBrands(sellerId, marketplace, 200),
  });
  useEffect(() => {
    if (q.error) reportError(q.error);
  }, [q.error, reportError]);

  const columns: Column<SellerBrand>[] = [
    { key: "brandName", header: "Brand", sortKey: "brandName", sortValue: (r) => r.brandName, render: (r) => <span className="font-medium">{text(r.brandName)}</span> },
    { key: "monthlyRevenue", header: "Monthly rev.", sortKey: "monthlyRevenue", align: "right", sortValue: (r) => r.monthlyRevenue, render: (r) => money(r.monthlyRevenue) },
    { key: "numberOffers", header: "Offers", sortKey: "numberOffers", align: "right", sortValue: (r) => r.numberOffers, render: (r) => count(r.numberOffers) },
    { key: "estimateBrandPercentage", header: "Brand coverage", sortKey: "estimateBrandPercentage", align: "right", sortValue: (r) => r.estimateBrandPercentage, render: (r) => pct(r.estimateBrandPercentage, false) },
    { key: "moMCoverageChange", header: "MoM Δ", sortKey: "moMCoverageChange", align: "right", sortValue: (r) => r.moMCoverageChange, render: (r) => num1(r.moMCoverageChange) },
  ];

  const rows = q.data?.brands ?? [];

  return (
    <>
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <div className="drawer-panel relative z-50 flex h-full w-full max-w-4xl flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-xs text-muted">Seller #{sellerId}</div>
            <h2 className="text-lg font-semibold">{sellerName}</h2>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <div className="card">
            <div className="border-b border-line px-3 py-2 text-sm text-muted">
              {q.isFetching ? "Loading brands…" : `${count(rows.length)} brands · click a brand for its products, marketplaces & keywords`}
            </div>
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(r) => r.brandId}
              onRowClick={(r) => setSelectedBrand({ brandId: r.brandId, name: r.brandName ?? String(r.brandId) })}
              emptyText={q.isFetching ? "Loading…" : "No brands for this seller."}
            />
          </div>
        </div>
      </div>
    </div>

    {selectedBrand && (
      <BrandDetailDrawer
        brandId={selectedBrand.brandId}
        brandName={selectedBrand.name}
        onClose={() => setSelectedBrand(null)}
      />
    )}
    </>
  );
}
