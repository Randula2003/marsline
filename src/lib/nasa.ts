import { MEDA_INDEXES, type MedaSensor } from "@/lib/constants";

export async function fetchMedaIndex(sensor: MedaSensor) {
  const sourceUrl = MEDA_INDEXES[sensor].url;
  const response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`NASA PDS returned HTTP ${response.status} for ${sensor}.`);
  const csv = await response.text();
  const rows = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return {
    sensor, title: MEDA_INDEXES[sensor].title, sourceUrl,
    retrievedAt: new Date().toISOString(), httpStatus: response.status,
    byteCount: Buffer.byteLength(csv, "utf8"), rowCount: Math.max(0, rows.length - 1),
    preview: rows.slice(0, 4), sourceLastModified: response.headers.get("last-modified"),
    note: "PDS product index metadata only. Row counts are not measurements or a live weather feed."
  };
}
