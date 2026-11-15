import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function resolveProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  }
  if (process.env.FIREBASE_CONFIG) {
    try { return JSON.parse(process.env.FIREBASE_CONFIG).projectId as string | undefined; } catch { /* Use explicit project ID below. */ }
  }
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey && projectId) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }
  if (process.env.K_SERVICE || process.env.FIREBASE_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
  }
  throw new Error("Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local, or use Application Default Credentials.");
}

/** True only when real (non-placeholder) server credentials are available. Used to allow the browser demo mode. */
export function isFirebaseAdminConfigured(): boolean {
  const real = (v?: string) => Boolean(v) && !/^(YOUR_|REPLACE|xxx)/i.test(v as string) && !/YOUR_PROJECT_ID|xxxxx/i.test(v as string);
  const key = process.env.FIREBASE_PRIVATE_KEY;
  const explicit = real(process.env.FIREBASE_PROJECT_ID) && real(process.env.FIREBASE_CLIENT_EMAIL) && Boolean(key) && !/YOUR_PRIVATE_KEY/i.test(key as string) && (key as string).replace(/\\n/g, "\n").length > 200;
  return explicit || Boolean(process.env.K_SERVICE || process.env.FIREBASE_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export function getAdminAuth() { return getAuth(getFirebaseAdminApp()); }
export function getAdminDb() { return getFirestore(getFirebaseAdminApp()); }
