"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Marketplace } from "@/lib/types";
import { ApiFetchError } from "@/lib/api";

interface AppState {
  marketplace: Marketplace;
  setMarketplace: (m: Marketplace) => void;
  /** Latest surfaced error message (null = none). */
  errorMessage: string | null;
  /** True when the SmartScout token is expired/invalid. */
  tokenExpired: boolean;
  reportError: (err: unknown) => void;
  clearError: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [marketplace, setMarketplace] = useState<Marketplace>("US");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  const reportError = useCallback((err: unknown) => {
    if (err instanceof ApiFetchError) {
      setErrorMessage(err.message);
      if (err.tokenExpired) setTokenExpired(true);
    } else if (err instanceof Error) {
      setErrorMessage(err.message);
    } else {
      setErrorMessage(String(err));
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setTokenExpired(false);
  }, []);

  const value = useMemo(
    () => ({ marketplace, setMarketplace, errorMessage, tokenExpired, reportError, clearError }),
    [marketplace, errorMessage, tokenExpired, reportError, clearError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
