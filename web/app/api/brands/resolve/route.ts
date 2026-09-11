import { searchBrands, mapBrands, toApiError } from "@/lib/smartscout";
import { parseMarketplace } from "@/lib/respond";
import type { BrandsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_NAMES = 50;

interface Resolved {
  query: string;
  found: boolean;
  brandId?: number;
  brandName?: string;
}

// Resolve a list of brand names to brandIds (exact name match preferred, else the
// highest-revenue match). Paced by the shared rate limiter, so kept modest.
export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  const names: string[] = Array.isArray(b.names)
    ? b.names.map((n: unknown) => String(n).trim()).filter((n: string) => n.length > 0)
    : [];
  if (names.length === 0) {
    return Response.json({ error: "Provide brand names.", status: 400 }, { status: 400 });
  }
  const marketplace = parseMarketplace(b.marketplace);
  const unique = Array.from(new Set(names)).slice(0, MAX_NAMES);

  try {
    const results: Resolved[] = [];
    for (const name of unique) {
      try {
        const res = mapBrands(
          await searchBrands({ query: name, sortBy: "monthlyRevenue", sortDir: "desc", pageSize: 10, marketplace }),
        ) as BrandsResponse;
        const lc = name.toLowerCase();
        const exact = res.brands.find((x) => (x.name ?? "").toLowerCase() === lc);
        const pick = exact ?? res.brands[0];
        if (pick) {
          results.push({ query: name, found: true, brandId: pick.brandId, brandName: pick.name });
        } else {
          results.push({ query: name, found: false });
        }
      } catch {
        results.push({ query: name, found: false });
      }
    }
    return Response.json({ resolved: results });
  } catch (err) {
    const e = toApiError(err);
    return Response.json(e, { status: e.status });
  }
}
