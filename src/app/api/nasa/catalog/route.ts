import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { NASA_DATASETS } from "@/lib/constants";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("nasaDatasets").get();
    const data = snap.empty ? NASA_DATASETS : snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ source: "Cloud Firestore", data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load catalogue" }, { status: 503 }); }
}
