import { z } from "zod";
import { SmartScoutError } from "../client.js";

/** Amazon marketplaces SmartScout exposes. */
export const MARKETPLACES = ["US", "UK", "DE", "CA", "MX", "FR", "IT", "ES", "AU", "JP", "IN"] as const;

/** Shared marketplace parameter. Optional; falls back to the server's SMARTSCOUT_MARKETPLACE.
 *  IDs are marketplace-specific, so a multi-step workflow must stay on one marketplace. */
export const marketplaceParam = z
  .enum(MARKETPLACES)
  .optional()
  .describe(
    "Amazon marketplace: US, UK, DE, CA, MX, FR, IT, ES, AU, JP, IN. Keep the SAME marketplace across a " +
      "multi-step workflow — brandId, subcategoryId and sellerId are marketplace-specific. " +
      "Omit to use the server's configured default.",
  );

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

const MAX_CHARS = 60_000;

/** Runs a client call and wraps the result (or error) as an MCP tool result. */
export async function toResult(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    let text = JSON.stringify(data, null, 2);
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + `\n… [truncated ${text.length - MAX_CHARS} chars]`;
    }
    return { content: [{ type: "text", text }] };
  } catch (err) {
    let message: string;
    if (err instanceof SmartScoutError) {
      message = err.message + (err.body ? `\n\nResponse body: ${err.body}` : "");
    } else if (err instanceof Error) {
      message = err.message;
    } else {
      message = String(err);
    }
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}
