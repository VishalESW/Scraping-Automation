import "server-only";
import { randomUUID } from "crypto";
import { toApiError, type ApiError } from "@/lib/smartscout";
import { runExport, type ExportType } from "@/lib/exporters";

// In-memory export jobs. The app runs as a single `next start` Node process
// (one Dokploy container), so a module-level Map is shared across all route
// handlers. Jobs are ephemeral — a container restart loses in-flight jobs,
// which is acceptable (the user just re-runs the export).
interface Job {
  id: string;
  status: "pending" | "done" | "error";
  filename?: string;
  data?: Uint8Array;
  error?: ApiError;
  created: number;
}

// Pin the registry to globalThis so it's a true per-process singleton — Next
// bundles each route handler separately, so a bare module-level Map would not be
// shared between the start / status / download routes.
const g = globalThis as unknown as { __ssExportJobs?: Map<string, Job> };
const jobs: Map<string, Job> = g.__ssExportJobs ?? (g.__ssExportJobs = new Map<string, Job>());
const TTL_MS = 30 * 60 * 1000; // keep finished files for 30 min

function sweep(): void {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.created > TTL_MS) jobs.delete(id);
  }
}

export function startExportJob(type: ExportType, payload: Record<string, unknown>): string {
  sweep();
  const id = randomUUID();
  const job: Job = { id, status: "pending", created: Date.now() };
  jobs.set(id, job);
  // fire-and-forget; the long-running Node process keeps executing this
  runExport(type, payload)
    .then(({ buffer, filename }) => {
      job.data = new Uint8Array(buffer);
      job.filename = filename;
      job.status = "done";
    })
    .catch((err) => {
      job.error = toApiError(err);
      job.status = "error";
    });
  return id;
}

export function getExportJob(id: string): Job | undefined {
  return jobs.get(id);
}
