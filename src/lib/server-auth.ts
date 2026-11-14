import "server-only";
import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export class AuthenticationError extends Error {
  constructor() {
    super("Authentication required. Sign in and retry.");
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Wait a minute and try again.");
    this.name = "RateLimitError";
  }
}

export async function requireUser(request: Request | NextRequest): Promise<{ uid: string; email?: string }> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthenticationError();
  const auth = getAdminAuth();
  let decoded: DecodedIdToken;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new AuthenticationError();
  }
  return { uid: decoded.uid, ...(decoded.email ? { email: decoded.email } : {}) };
}

export async function consumeMedaRequest(uid: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("rateLimits").doc("meda-index");
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 12;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const windowStartedAt = typeof data?.windowStartedAt === "number" ? data.windowStartedAt : 0;
    const requestCount = typeof data?.requestCount === "number" ? data.requestCount : 0;
    const inWindow = now - windowStartedAt < windowMs;
    if (inWindow && requestCount >= maxRequests) throw new RateLimitError();
    transaction.set(ref, {
      windowStartedAt: inWindow ? windowStartedAt : now,
      requestCount: inWindow ? requestCount + 1 : 1,
      updatedAt: new Date(now).toISOString(),
    });
  });
}

export function missionRef(uid: string) {
  return getAdminDb().collection("users").doc(uid).collection("missions").doc("ARES-FS-01");
}
