import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
import { lifeSupportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("lifeSupport").orderBy("recordedAt", "desc").limit(1).get();

    // Firestore's DocumentData is intentionally untyped. Add the fields used
    // by this route explicitly so TypeScript can safely sort the records.
    const latest = snap.docs[0];
    const record = latest?.data() as Record<string, unknown> | undefined;
    const data = latest && record
      ? { ...record, id: latest.id, recordedAt: typeof record.recordedAt === "string" ? record.recordedAt : "" }
      : null;

    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load snapshots", 503);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = lifeSupportSchema.parse(await request.json());
    const ref = missionRef(uid).collection("lifeSupport").doc();
    const data = { ...body, isSimulated: true, recordedAt: new Date().toISOString() };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save resource snapshot");
  }
}
