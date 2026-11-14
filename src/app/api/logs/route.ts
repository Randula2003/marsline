import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { logSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("logs").limit(100).get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a,b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load mission log" }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = logSchema.parse(await request.json());
    const ref = missionRef(uid).collection("logs").doc();
    const data = { ...body, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create log entry" }, { status: 400 }); }
}
