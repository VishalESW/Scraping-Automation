import "server-only";
import { randomUUID } from "crypto";
import { toApiError, type ApiError } from "@/lib/smartscout";
import { runSheetFill, type SheetFillProgress } from "@/lib/sheet-fill";

// In-memory sheet-fill jobs. The job runs fire-and-forget in the single Node
// process and writes to Google Sheets incrementally, so it keeps filling the
// sheet even if the browser stops polling. Progress is read via /api/sheet/status.
interface SheetJob {
  id: string;
  status: "running" | "done" | "error";
  progress: SheetFillProgress;
  error?: ApiError;
  created: number;
  updated: number;
}

const g = globalThis as unknown as { __ssSheetJobs?: Map<string, SheetJob> };
const jobs: Map<string, SheetJob> = g.__ssSheetJobs ?? (g.__ssSheetJobs = new Map<string, SheetJob>());
const TTL_MS = 2 * 60 * 60 * 1000; // keep finished jobs 2h (runs can be long)

function sweep(): void {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (j.status !== "running" && now - j.updated > TTL_MS) jobs.delete(id);
  }
}

export function startSheetJob(payload: Record<string, unknown>): string {
  sweep();
  const id = randomUUID();
  const job: SheetJob = {
    id,
    status: "running",
    progress: { totalSubcats: 0, subcatsDone: 0, brandsWritten: 0, productsWritten: 0, current: null },
    created: Date.now(),
    updated: Date.now(),
  };
  jobs.set(id, job);

  runSheetFill(payload, (p) => {
    job.progress = p;
    job.updated = Date.now();
  })
    .then((p) => {
      job.progress = p;
      job.status = "done";
      job.updated = Date.now();
    })
    .catch((err) => {
      job.error = toApiError(err);
      job.status = "error";
      job.updated = Date.now();
    });

  return id;
}

export function getSheetJob(id: string): SheetJob | undefined {
  return jobs.get(id);
}
