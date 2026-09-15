import { NextResponse } from "next/server";
import { searchSubcategories } from "@/lib/catalog";
import { toApiError } from "@/lib/smartscout";
import { parseMarketplace, num } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const marketplace = parseMarketplace(q.get("marketplace")) ?? "US";
  const query = q.get("q") ?? "";
  const limit = num(q.get("limit")) ?? 50;
  const includeBranches = q.get("branches") === "1";
  try {
    const subcategories = await searchSubcategories(marketplace, query, limit, includeBranches);
    return NextResponse.json({ returned: subcategories.length, subcategories });
  } catch (err) {
    const e = toApiError(err);
    return NextResponse.json(e, { status: e.status });
  }
}
