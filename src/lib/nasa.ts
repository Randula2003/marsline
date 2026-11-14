import { MEDA_INDEXES, type MedaSensor } from "@/lib/constants";

const MAX_INDEX_BYTES = 2 * 1024 * 1024;

export async function fetchMedaIndex(sensor: MedaSensor) {
  const sourceUrl = MEDA_INDEXES[sensor].url;
  const response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`NASA PDS returned HTTP ${response.status} for ${sensor}.`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_INDEX_BYTES) {
    await response.body?.cancel();
    throw new Error("NASA PDS index exceeds the 2 MiB response limit.");
  }
  if (!response.body) throw new Error("NASA PDS returned an empty response body.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_INDEX_BYTES) {
      await reader.cancel();
      throw new Error("NASA PDS index exceeds the 2 MiB response limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const csv = new TextDecoder().decode(bytes);
  const rows = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return {
    sensor, title: MEDA_INDEXES[sensor].title, sourceUrl,
    retrievedAt: new Date().toISOString(), httpStatus: response.status,
    byteCount, rowCount: Math.max(0, rows.length - 1),
    preview: rows.slice(0, 4), sourceLastModified: response.headers.get("last-modified"),
    note: "PDS product index metadata only. Row counts are not measurements or a live weather feed."
  };
}
