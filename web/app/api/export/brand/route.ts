import { runBrandExport } from "@/lib/exporters";
import { toApiError } from "@/lib/smartscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 1800;

export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  try {
    const { buffer, filename } = await runBrandExport(b);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const e = toApiError(err);
    return Response.json(e, { status: e.status });
  }
}
