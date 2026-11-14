import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/server-auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    await getAdminDb().collection("users").doc(user.uid).get();
    return NextResponse.json({ ok: true, database: "Cloud Firestore", projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "configured project", uid: user.uid, checkedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, database: "unavailable", error: error instanceof Error ? error.message : "Firestore connection failed" }, { status: 503 });
  }
}
