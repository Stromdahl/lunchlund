const USER_AGENT = "lunchlund/0.1 (+local tool)";

/** Fetch a URL as text. Throws `${label}: ${status} ${statusText}` on non-2xx. */
export async function fetchText(url: string, label: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${label}: ${res.status} ${res.statusText}`);
  return res.text();
}

/** Fetch a URL as bytes (for binary content like PDFs). */
export async function fetchBuffer(url: string, label: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${label}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// Strip the small ZWJ/ZWNJ/word-joiner family of zero-width characters (sites
// built in Webflow/Framer love these), then collapse all whitespace and trim.
const ZERO_WIDTH = /[​-‍﻿]/g;

/** Normalise scraped text: drop zero-widths, collapse whitespace, trim. */
export function cleanText(s: string): string {
  return s.replace(ZERO_WIDTH, "").replace(/\s+/g, " ").trim();
}
