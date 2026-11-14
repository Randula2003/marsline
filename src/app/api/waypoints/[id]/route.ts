import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(request);
    const { id } = await context.params;
    const ref = missionRef(uid).collection("waypoints").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Waypoint not found" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error, "Unable to delete waypoint"); }
}
