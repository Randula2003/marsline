import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(request);
    const { id } = await context.params;
    const ref = missionRef(uid).collection("waypoints").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Waypoint not found" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete waypoint" }, { status: 400 }); }
}
