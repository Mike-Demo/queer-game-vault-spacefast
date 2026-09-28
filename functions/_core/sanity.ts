/**
 * Read-only Sanity GROQ fetch for the preview backend.
 *
 * The catalog is public: project id, dataset and API version are not secrets
 * (they ship in the original client bundle). Uses the CDN endpoint with the
 * published perspective, same as the original public client.
 */

const PROJECT_ID = "tzh8tziu";
const DATASET = "production";
const API_VERSION = "2024-10-01";

const ENDPOINT = `https://${PROJECT_ID}.apicdn.sanity.io/v${API_VERSION}/data/query/${DATASET}`;

export async function sanityFetch<T>(query: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  }
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Sanity query failed: ${response.status}`);
  }
  const body = (await response.json()) as { result?: T };
  return body.result as T;
}
