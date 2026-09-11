import { runSellerMapExport } from "@/lib/exporters";
import { toApiError } from "@/lib/smartscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3000;

// Direct (synchronous) export. The UI uses the background-job flow instead
// (/api/export/start + status + download) to avoid proxy timeouts; this remains
// for direct/API use.
export async function POST(req: Request): Promise<Response> {
  const b = await req.json().catch(() => ({}));
  try {
    const { buffer, filename } = await runSellerMapExport(b);
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
