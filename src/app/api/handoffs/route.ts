import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
import { handoffSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Handoff records: the route a crew member walked, the planned and alternate routes, hazards and surface conditions, kept for the next crew member.
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("handoffs").orderBy("savedAt", "desc").limit(20).get();
    const data = snap.docs.map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id }));
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load handoff records", 503);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = handoffSchema.parse(await request.json());
    const ref = missionRef(uid).collection("handoffs").doc();
    const data = { ...body, savedAt: new Date().toISOString(), isSimulated: true };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save handoff record");
  }
}
