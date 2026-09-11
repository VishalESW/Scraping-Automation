import "server-only";
import { NextResponse } from "next/server";
import { run } from "./smartscout";
import type { Marketplace } from "./types";
import { MARKETPLACES } from "./types";

/** Runs a mapped SmartScout call and returns it as a JSON Response,
 *  forwarding SmartScout error status (401/403 => token-expired) to the client. */
export async function respond<T>(
  call: () => Promise<unknown>,
  map: (raw: unknown) => T,
): Promise<Response> {
  const result = await run(call, map);
  if (result.ok) return NextResponse.json(result.data);
  return NextResponse.json(result.error, { status: result.error.status });
}

export function parseMarketplace(v: string | null | undefined): Marketplace | undefined {
  if (v && (MARKETPLACES as readonly string[]).includes(v)) return v as Marketplace;
  return undefined;
}

export function num(v: string | null | undefined): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
