import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { waypointSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("waypoints").get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load waypoints" }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = waypointSchema.parse(await request.json());
    const collection = missionRef(uid).collection("waypoints");
    const count = await collection.count().get();
    const ref = collection.doc();
    const data = { ...body, sequence: count.data().count + 1, coordinateSystem: "IAU2000:49900", createdAt: new Date().toISOString(), isDemo: false };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save waypoint" }, { status: 400 }); }
}
