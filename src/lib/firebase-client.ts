"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";

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

export async function firebaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const user = await getFirebaseUser();
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers, cache: init.cache ?? "no-store" });
}
