import "server-only";
import { createSign } from "crypto";
import type { Cell } from "./export";

// Minimal Google Sheets writer: signs a service-account JWT with Node crypto and
// calls the Sheets REST API directly (no googleapis dependency). Configure with:
//   GOOGLE_SERVICE_ACCOUNT_JSON = the service-account key JSON (as a string)
//   GOOGLE_SHEET_ID             = the target spreadsheet id
// Share the sheet with the service-account email (Editor).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let cachedSa: ServiceAccount | null = null;
function serviceAccount(): ServiceAccount {
  if (cachedSa) return cachedSa;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set. Add the service-account key JSON to the app env and share the sheet with its client_email (Editor).",
    );
  }
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  }
  // Env vars often store the key with literal \n — normalize to real newlines.
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  cachedSa = parsed;
  return parsed;
}

export function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set.");
  return id;
}

export function googleSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHEET_ID);
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;

  const sa = serviceAccount();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(sa.private_key).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google auth failed: ${body.error_description || body.error || res.status}`);
  }
  tokenCache = { token: body.access_token, exp: now + 3600 };
  return body.access_token;
}

// Cells → JSON-safe values for the Sheets API (Date → ISO date, null → "").
function toValues(rows: Cell[][]): (string | number | boolean)[][] {
  return rows.map((row) =>
    row.map((c) => {
      if (c === null || c === undefined) return "";
      if (c instanceof Date) return c.toISOString().slice(0, 10);
      return c;
    }),
  );
}

/** Append rows to the end of a tab's data (INSERT_ROWS, RAW). */
export async function appendRows(tab: string, rows: Cell[][]): Promise<void> {
  if (rows.length === 0) return;
  const token = await accessToken();
  const range = encodeURIComponent(`${tab}!A1`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}/values/${range}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: toValues(rows) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sheets append to "${tab}" failed: ${res.status} ${text.slice(0, 300)}`);
  }
}
