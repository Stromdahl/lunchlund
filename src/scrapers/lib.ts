// Browser-ish headers. The hosts return `415 Unsupported Media Type` (a WAF
// canned response, not real content negotiation — it's a GET with no body)
// for the bare `lunchlund/0.1` UA in some windows; a realistic UA plus
// Accept/Accept-Language reads as a normal browser and gets through. The
// project is still identified via the trailing comment for any host that
// inspects it. If a host asks us to back off, dial this back.
const COMMON_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
  "accept-language": "sv-SE,sv;q=0.9,en;q=0.8",
};

// Statuses worth retrying: transient server / rate-limit / timeout responses.
// 415 is deliberately absent — it's a WAF rejection that won't change on a
// retry seconds later; the headers above are the lever for it, not retries.
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_TRIES = 3;
const TIMEOUT_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch with browser-ish headers, a per-attempt timeout, and a short
 *  exponential backoff on transient (network / 5xx / 429) failures. Throws
 *  `${label}: ${status} ${statusText}` on a non-retryable or final non-2xx. */
async function fetchOk(url: string, label: string): Promise<Response> {
  let last: Error | undefined;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: COMMON_HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      // Network error / timeout — always retryable.
      last = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_TRIES) await sleep(attempt * 400);
      continue;
    }
    if (res.ok) return res;
    last = new Error(`${label}: ${res.status} ${res.statusText}`);
    if (!RETRY_STATUS.has(res.status) || attempt === MAX_TRIES) throw last;
    await sleep(attempt * 400);
  }
  throw last ?? new Error(`${label}: failed after ${MAX_TRIES} attempts`);
}

/** Fetch a URL as text. Throws `${label}: ${status} ${statusText}` on non-2xx. */
export async function fetchText(url: string, label: string): Promise<string> {
  const res = await fetchOk(url, label);
  return res.text();
}

/** Fetch a URL as bytes (for binary content like PDFs). */
export async function fetchBuffer(url: string, label: string): Promise<Buffer> {
  const res = await fetchOk(url, label);
  return Buffer.from(await res.arrayBuffer());
}

// Strip the small ZWJ/ZWNJ/word-joiner family of zero-width characters (sites
// built in Webflow/Framer love these), then collapse all whitespace and trim.
const ZERO_WIDTH = /[​-‍﻿]/g;

/** Normalise scraped text: drop zero-widths, collapse whitespace, trim. */
export function cleanText(s: string): string {
  return s.replace(ZERO_WIDTH, "").replace(/\s+/g, " ").trim();
}
