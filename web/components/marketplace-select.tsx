"use client";

import { MARKETPLACES, type Marketplace } from "@/lib/types";
import { useApp } from "./app-context";

export function MarketplaceSelect() {
  const { marketplace, setMarketplace } = useApp();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Marketplace</span>
      <select
        className="field w-auto py-1.5"
        value={marketplace}
        onChange={(e) => setMarketplace(e.target.value as Marketplace)}
        title="IDs are marketplace-specific; drill-downs stay on this marketplace."
      >
        {MARKETPLACES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}
