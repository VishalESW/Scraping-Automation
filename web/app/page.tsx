"use client";

import { useState } from "react";
import { AppProvider } from "@/components/app-context";
import { MarketplaceSelect } from "@/components/marketplace-select";
import { TokenBanner } from "@/components/token-banner";
import { SubcategoryView } from "@/components/subcategory-view";
import { SellerMapView } from "@/components/seller-map-view";

type View = "subcategory" | "seller-map";

export default function Home() {
  const [view, setView] = useState<View>("subcategory");

  return (
    <AppProvider>
      <TokenBanner />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">SmartScout Research</h1>
            <p className="text-sm text-muted">Brands, products &amp; marketplace data from subcategories and the seller map.</p>
          </div>
          <MarketplaceSelect />
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-6">
          <TabButton active={view === "subcategory"} onClick={() => setView("subcategory")}>
            Subcategory
          </TabButton>
          <TabButton active={view === "seller-map"} onClick={() => setView("seller-map")}>
            Seller Map
          </TabButton>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {view === "subcategory" ? <SubcategoryView /> : <SellerMapView />}
      </main>
    </AppProvider>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
