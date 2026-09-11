"use client";

import { useState } from "react";
import { AppProvider } from "@/components/app-context";
import { MarketplaceSelect } from "@/components/marketplace-select";
import { TokenBanner } from "@/components/token-banner";
import { SubcategoryView } from "@/components/subcategory-view";
import { SellerMapView } from "@/components/seller-map-view";
import { BrandView } from "@/components/brand-view";

type View = "brand" | "subcategory" | "seller-map";

export default function Home() {
  const [view, setView] = useState<View>("brand");

  return (
    <AppProvider>
      <TokenBanner />
      <header className="app-header sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-[15px] font-bold text-white shadow-xs">S</span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">SmartScout Research</h1>
              <p className="text-xs text-muted">Brands, products &amp; marketplace data — subcategories &amp; seller map.</p>
            </div>
          </div>
          <MarketplaceSelect />
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-6">
          <TabButton active={view === "brand"} onClick={() => setView("brand")}>
            Brand
          </TabButton>
          <TabButton active={view === "subcategory"} onClick={() => setView("subcategory")}>
            Subcategory
          </TabButton>
          <TabButton active={view === "seller-map"} onClick={() => setView("seller-map")}>
            Seller Map
          </TabButton>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {view === "brand" ? <BrandView /> : view === "subcategory" ? <SubcategoryView /> : <SellerMapView />}
      </main>
    </AppProvider>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-brand text-brand"
          : "border-transparent text-muted hover:border-linestrong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
