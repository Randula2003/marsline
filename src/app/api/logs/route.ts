import { NextResponse } from "next/server";
import { requireUser, missionRef } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
import { logSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const snap = await missionRef(uid).collection("logs").orderBy("occurredAt", "desc").limit(100).get();

    // Explicitly type the Firestore fields used for ordering.
    const data = snap.docs.map((doc) => {
      const record = doc.data() as Record<string, unknown>;
      return {
        ...record,
        id: doc.id,
        occurredAt: typeof record.occurredAt === "string" ? record.occurredAt : "",
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load mission log", 503);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = logSchema.parse(await request.json());
    const ref = missionRef(uid).collection("logs").doc();
    const now = new Date().toISOString();
    const data = { ...body, occurredAt: now, createdAt: now };
    await ref.set(data);
    return NextResponse.json({ data: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to create log entry");
  }
}
