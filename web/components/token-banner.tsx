"use client";

import { useApp } from "./app-context";

export function TokenBanner() {
  const { errorMessage, tokenExpired, clearError } = useApp();
  if (!errorMessage) return null;

  return (
    <div
      className={`flex items-start justify-between gap-4 border-b px-4 py-3 text-sm ${
        tokenExpired ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-300 bg-red-50 text-red-900"
      }`}
    >
      <div>
        <strong>{tokenExpired ? "SmartScout token expired or invalid." : "Request failed."}</strong>{" "}
        {tokenExpired ? (
          <span>
            Re-capture your token: in a logged-in SmartScout tab, DevTools → Network → a{" "}
            <code>*/search</code> request → copy the value after <code>Authorization: Bearer</code>{" "}
            into <code>web/.env.local</code> (<code>SMARTSCOUT_TOKEN</code>), then restart the dev
            server.
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{errorMessage}</span>
        )}
      </div>
      <button className="btn-ghost shrink-0 py-1" onClick={clearError}>
        Dismiss
      </button>
    </div>
  );
}
