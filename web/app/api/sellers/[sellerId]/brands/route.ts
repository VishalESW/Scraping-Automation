import { getSellerBrands, mapSellerBrands } from "@/lib/smartscout";
import { respond, parseMarketplace, num } from "@/lib/respond";
import type { SellerBrand } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { sellerId: string } },
): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const limit = num(q.get("limit")) ?? 200;
  return respond(
    () => getSellerBrands(params.sellerId, parseMarketplace(q.get("marketplace"))),
    (raw) => {
      const mapped = mapSellerBrands(raw) as { returned: number; brands: SellerBrand[] };
      // response is revenue-sorted; cap for display (resellers can carry 10k+ brands)
      return { returned: mapped.returned, brands: mapped.brands.slice(0, limit) };
    },
  );
}
