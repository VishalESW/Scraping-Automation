import { getProduct, mapProducts } from "@/lib/smartscout";
import { respond, parseMarketplace } from "@/lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { asin: string } },
): Promise<Response> {
  const q = new URL(req.url).searchParams;
  return respond(
    () => getProduct(params.asin, parseMarketplace(q.get("marketplace"))),
    mapProducts,
  );
}
