import { NextResponse } from "next/server";
import { getCategories } from "@/lib/catalog";
import { toApiError } from "@/lib/smartscout";
import { parseMarketplace } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const marketplace = parseMarketplace(q.get("marketplace")) ?? "US";
  try {
    const categories = await getCategories(marketplace);
    return NextResponse.json({ returned: categories.length, categories });
  } catch (err) {
    const e = toApiError(err);
    return NextResponse.json(e, { status: e.status });
  }
}
