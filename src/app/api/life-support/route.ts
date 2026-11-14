import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { lifeSupportSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("lifeSupport").get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a,b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))[0] ?? null;
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load snapshots" }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = lifeSupportSchema.parse(await request.json());
    const ref = missionRef(uid).collection("lifeSupport").doc();
    const data = { ...body, isSimulated: true, recordedAt: new Date().toISOString() };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save resource snapshot" }, { status: 400 }); }
}
