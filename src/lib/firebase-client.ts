"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { demoRequest } from "@/lib/demo-store";

const publicConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function isFirebaseClientConfigured(): boolean {
  return Boolean(publicConfig.apiKey && publicConfig.authDomain && publicConfig.projectId && publicConfig.appId && !publicConfig.apiKey.startsWith("YOUR_"));
}

function getClientAuth() {
  if (!isFirebaseClientConfigured()) {
    throw new Error("Firebase web configuration is missing. Copy .env.local.example to .env.local and add your Firebase Web App values.");
  }
  const app = getApps().length ? getApp() : initializeApp(publicConfig);
  return getAuth(app);
}

let authUserPromise: Promise<User> | null = null;
export async function getFirebaseUser(): Promise<User> {
  const auth = getClientAuth();
  if (auth.currentUser) return auth.currentUser;
  if (!authUserPromise) {
    authUserPromise = new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user); });
    }).then(async (existingUser) => {
      if (existingUser) return existingUser;
      const credential = await signInAnonymously(auth);
      return credential.user;
    })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("operation-not-allowed")) {
          throw new Error("Enable Authentication → Sign-in method → Anonymous in your Firebase project.");
        }
        throw new Error(`Firebase Authentication failed: ${message}`);
      })
      .finally(() => { authUserPromise = null; });
  }
  return authUserPromise;
}

// Demo mode keeps every feature working without cloud setup (data stays in this browser). It switches on automatically when the
// Firebase web settings are missing, when NEXT_PUBLIC_DEMO_MODE=true, or when the user chooses it from the console.
// The user's choice is remembered in localStorage so a page reload does not drop back to a Firebase setup that is not working yet.
const DEMO_KEY = "marsline-demo-mode";
let demoMode = false;
function storedDemoChoice(): boolean { try { return typeof window !== "undefined" && window.localStorage.getItem(DEMO_KEY) === "1"; } catch { return false; } }
export function isDemoMode(): boolean { return demoMode || storedDemoChoice() || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isFirebaseClientConfigured(); }
export function enableDemoMode() { demoMode = true; try { window.localStorage.setItem(DEMO_KEY, "1"); } catch { /* storage blocked: stays on for this tab only */ } }
export function disableDemoMode() { demoMode = false; try { window.localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } }

export async function firebaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (isDemoMode()) return demoRequest(path, init);
  const user = await getFirebaseUser();
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers, cache: init.cache ?? "no-store" });
}
