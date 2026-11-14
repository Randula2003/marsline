import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { apiErrorResponse } from "@/lib/api-errors";
import { ensureWorkspace } from "@/lib/firestore-workspace";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const refs = await ensureWorkspace(user.uid);
    const mission = await refs.missionRef.get();
    return NextResponse.json({ ok: true, mission: mission.data(), uid: user.uid });
  } catch (error) {
    return apiErrorResponse(error, "Workspace bootstrap failed", 503);
  }
}
