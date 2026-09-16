import { startSheetJob } from "@/lib/sheet-jobs";
import { googleSheetsConfigured } from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!googleSheetsConfigured()) {
    return Response.json(
      {
        error:
          "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID in the app env, and share the sheet with the service-account email (Editor).",
        status: 400,
      },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const payload = (body?.payload ?? {}) as Record<string, unknown>;
  if (payload.nodeId === undefined || payload.nodeId === null || payload.nodeId === "") {
    return Response.json({ error: "nodeId is required", status: 400 }, { status: 400 });
  }
  const id = startSheetJob(payload);
  return Response.json({ id });
}
