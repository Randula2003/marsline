import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { MEDA_INDEXES, type MedaSensor } from "@/lib/constants";
import { fetchMedaIndex } from "@/lib/nasa";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ sensor: string }> }) {
  const { sensor: raw } = await context.params;
  const sensor = raw.toUpperCase() as MedaSensor;
  if (!(sensor in MEDA_INDEXES)) return NextResponse.json({ error: `Allowed MEDA sensors: ${Object.keys(MEDA_INDEXES).join(", ")}` }, { status: 400 });
  if (process.env.NASA_DATA_ENABLED === "false") return NextResponse.json({ error: "NASA data fetches are disabled." }, { status: 403 });
  let uid: string | undefined;
  let fetchId: string | undefined;
  try {
    const user = await requireUser(request); uid = user.uid;
    const recordRef = missionRef(uid).collection("dataFetches").doc();
    fetchId = recordRef.id;
    const started = { sensor, sourceUrl: MEDA_INDEXES[sensor].url, result: "STARTED", startedAt: new Date().toISOString() };
    await recordRef.set(started);
    const result = await fetchMedaIndex(sensor);
    await recordRef.set({ ...started, result: "SUCCESS", httpStatus: result.httpStatus, rowCount: result.rowCount, byteCount: result.byteCount, sourceLastModified: result.sourceLastModified, retrievedAt: result.retrievedAt, note: result.note }, { merge: true });
    return NextResponse.json({ ...result, archiveType: "PDS product index", persistence: "Firestore" });
  } catch (error) {
    if (uid && fetchId) {
      try { await missionRef(uid).collection("dataFetches").doc(fetchId).set({ sensor, result: "FAILED", errorMessage: error instanceof Error ? error.message : "Fetch failed", completedAt: new Date().toISOString() }, { merge: true }); } catch { /* Keep original error. */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch MEDA index" }, { status: 502 });
  }
}
