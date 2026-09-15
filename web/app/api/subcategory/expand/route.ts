import { NextResponse } from "next/server";
import { getSubcategoryDescendants, fullPathOf } from "@/lib/catalog";
import { toApiError } from "@/lib/smartscout";
import { parseMarketplace, num } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How many selectable subcategories live under a branch/category node, plus the
// list itself (sorted by revenue). Drives the bulk-export preview + the job.
const MAX_ITEMS = 600; // payload cap; the export applies its own subcategory cap.

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const marketplace = parseMarketplace(q.get("marketplace")) ?? "US";
  const nodeId = num(q.get("nodeId"));
  if (nodeId === undefined) {
    return NextResponse.json({ error: "nodeId is required", status: 400 }, { status: 400 });
  }
  try {
    const { node, leaves } = await getSubcategoryDescendants(marketplace, nodeId);
    if (!node) {
      return NextResponse.json({ error: "Unknown subcategory node", status: 404 }, { status: 404 });
    }
    return NextResponse.json({
      nodeId,
      name: node.name,
      path: fullPathOf(node),
      isParent: node.isParent === true,
      count: leaves.length,
      truncated: leaves.length > MAX_ITEMS,
      subcategories: leaves.slice(0, MAX_ITEMS).map((s) => ({
        id: s.id,
        name: s.name,
        path: fullPathOf(s),
        totalMonthlyRevenue: s.totalMonthlyRevenue,
        totalBrands: s.totalBrands,
      })),
    });
  } catch (err) {
    const e = toApiError(err);
    return NextResponse.json(e, { status: e.status });
  }
}
