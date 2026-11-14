import "server-only";
import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function requireUser(request: Request | NextRequest): Promise<{ uid: string; email?: string }> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Authentication required. Sign in to Firebase and retry.");
  const decoded = await getAdminAuth().verifyIdToken(token);
  return { uid: decoded.uid, ...(decoded.email ? { email: decoded.email } : {}) };
}

export function missionRef(uid: string) {
  return getAdminDb().collection("users").doc(uid).collection("missions").doc("ARES-FS-01");
}
