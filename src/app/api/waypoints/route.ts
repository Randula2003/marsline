import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
import { waypointSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("waypoints").get();

    // Firestore documents are untyped, so explicitly normalize sequence.
    const data = snap.docs
      .map((doc) => {
        const record = doc.data() as Record<string, unknown>;
        const parsedSequence = Number(record.sequence ?? 0);
        return {
          ...record,
          id: doc.id,
          sequence: Number.isFinite(parsedSequence) ? parsedSequence : 0,
        };
      })
      .sort((a, b) => a.sequence - b.sequence);

    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load waypoints", 503);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = waypointSchema.parse(await request.json());
    const collection = missionRef(uid).collection("waypoints");
    // Use highest existing sequence + 1 so deletions never cause duplicate numbers.
    const last = await collection.orderBy("sequence", "desc").limit(1).get();
    const lastSequence = Number(last.docs[0]?.data().sequence ?? 0);
    const ref = collection.doc();
    const data = {
      ...body,
      sequence: (Number.isFinite(lastSequence) ? lastSequence : 0) + 1,
      coordinateSystem: "IAU2000:49900",
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save waypoint");
  }
}
