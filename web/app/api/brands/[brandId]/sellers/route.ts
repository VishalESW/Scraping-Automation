import { getBrandSellers, mapBrandSellers } from "@/lib/smartscout";
import { respond, parseMarketplace } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { brandId: string } },
): Promise<Response> {
  const q = new URL(req.url).searchParams;
  return respond(
    () => getBrandSellers(params.brandId, parseMarketplace(q.get("marketplace"))),
    mapBrandSellers,
  );
}
