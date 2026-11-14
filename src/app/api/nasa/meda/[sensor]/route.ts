import { NextResponse } from "next/server";
import { consumeMedaRequest, requireUser, missionRef } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
import { MEDA_INDEXES, type MedaSensor } from "@/lib/constants";
import { fetchMedaIndex } from "@/lib/nasa";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ sensor: string }> }) {
  let uid: string | undefined;
  let fetchId: string | undefined;
  let sensor: MedaSensor | undefined;
  try {
    const user = await requireUser(request);
    uid = user.uid;
    const { sensor: raw } = await context.params;
    const sensorName = raw.toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(MEDA_INDEXES, sensorName)) {
      return NextResponse.json({ error: `Allowed MEDA sensors: ${Object.keys(MEDA_INDEXES).join(", ")}` }, { status: 400 });
    }
    sensor = sensorName as MedaSensor;
    if (process.env.NASA_DATA_ENABLED === "false") {
      return NextResponse.json({ error: "NASA data fetches are disabled." }, { status: 403 });
    }
    await consumeMedaRequest(uid);
    const recordRef = missionRef(uid).collection("dataFetches").doc();
    fetchId = recordRef.id;
    const started = { sensor, sourceUrl: MEDA_INDEXES[sensor].url, result: "STARTED", startedAt: new Date().toISOString() };
    await recordRef.set(started);
    const result = await fetchMedaIndex(sensor);
    await recordRef.set({ ...started, result: "SUCCESS", httpStatus: result.httpStatus, rowCount: result.rowCount, byteCount: result.byteCount, sourceLastModified: result.sourceLastModified, retrievedAt: result.retrievedAt, note: result.note }, { merge: true });
    return NextResponse.json({ ...result, archiveType: "PDS product index", persistence: "Firestore" });
  } catch (error) {
    if (uid && fetchId && sensor) {
      try { await missionRef(uid).collection("dataFetches").doc(fetchId).set({ sensor, result: "FAILED", errorMessage: error instanceof Error ? error.message : "Fetch failed", completedAt: new Date().toISOString() }, { merge: true }); } catch { /* Keep original error. */ }
    }
    return apiErrorResponse(error, "Unable to fetch MEDA index", 502);
  }
}
