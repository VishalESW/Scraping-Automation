import "dotenv/config";

export interface SmartScoutConfig {
  token: string;
  baseUrl: string;
  defaultMarketplace: string;
  authHeader: string;
  authPrefix: string;
  contentType: string;
  origin: string;
  referer: string;
  userAgent: string;
  extraHeaders: Record<string, string>;
  minRequestIntervalMs: number;
}

let cached: SmartScoutConfig | undefined;

/** Reads configuration from environment variables (populated from `.env` in dev,
 *  or from the `env` block of the MCP server config when launched by Claude). */
export function getConfig(): SmartScoutConfig {
  if (cached) return cached;

  let extraHeaders: Record<string, string> = {};
  const rawExtra = process.env.SMARTSCOUT_EXTRA_HEADERS?.trim();
  if (rawExtra) {
    try {
      extraHeaders = JSON.parse(rawExtra) as Record<string, string>;
    } catch {
      throw new Error(
        'SMARTSCOUT_EXTRA_HEADERS must be valid JSON, e.g. {"X-Foo":"bar"}',
      );
    }
  }

  cached = {
    token: process.env.SMARTSCOUT_TOKEN ?? "",
    baseUrl: (process.env.SMARTSCOUT_BASE_URL ?? "https://smartscoutapi-east.azurewebsites.net").replace(
      /\/+$/,
      "",
    ),
    defaultMarketplace: process.env.SMARTSCOUT_MARKETPLACE ?? "US",
    authHeader: process.env.SMARTSCOUT_AUTH_HEADER ?? "Authorization",
    authPrefix: process.env.SMARTSCOUT_AUTH_PREFIX ?? "Bearer ",
    contentType: process.env.SMARTSCOUT_CONTENT_TYPE ?? "application/json-patch+json",
    origin: process.env.SMARTSCOUT_ORIGIN ?? "https://app.smartscout.com",
    referer: process.env.SMARTSCOUT_REFERER ?? "https://app.smartscout.com/",
    userAgent:
      process.env.SMARTSCOUT_USER_AGENT ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    extraHeaders,
    minRequestIntervalMs: Number(process.env.SMARTSCOUT_MIN_INTERVAL_MS ?? 1200),
  };
  return cached;
}
