import "server-only";

export type CheckState = "ok" | "missing" | "placeholder";
export type FirebaseCheck = { name: string; group: "web" | "admin"; state: CheckState; hint: string };
export type FirebaseStatus = { webConfigured: boolean; adminConfigured: boolean; ready: boolean; checks: FirebaseCheck[]; nextStep: string };

const PLACEHOLDER = /^(YOUR_|REPLACE)|YOUR_PROJECT_ID|YOUR_FIREBASE|xxxxx|PASTE_PRIVATE_KEY_HERE/i;
const state = (v: string | undefined): CheckState => (!v || !v.trim() ? "missing" : PLACEHOLDER.test(v) ? "placeholder" : "ok");

/** Reports which Firebase settings are present. Never returns any value, only the state of each setting. */
export function getFirebaseStatus(env: NodeJS.ProcessEnv = process.env): FirebaseStatus {
  const web: [string, string][] = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", "Firebase Console → Project settings → General → Your apps → Web app → apiKey"],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "Same place → authDomain (PROJECT_ID.firebaseapp.com)"],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "Same place → projectId"],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", "Same place → appId"]
  ];
  const checks: FirebaseCheck[] = web.map(([name, hint]) => ({ name, group: "web", state: state(env[name]), hint }));

  const adc = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS || env.K_SERVICE || env.FIREBASE_CONFIG);
  const key = env.FIREBASE_PRIVATE_KEY;
  const keyState: CheckState = state(key) !== "ok" ? state(key) : /BEGIN PRIVATE KEY/.test(key as string) && (key as string).length > 200 ? "ok" : "placeholder";
  const admin: [string, CheckState, string][] = [
    ["FIREBASE_PROJECT_ID", state(env.FIREBASE_PROJECT_ID), "Project settings → General → Project ID"],
    ["FIREBASE_CLIENT_EMAIL", state(env.FIREBASE_CLIENT_EMAIL), "Project settings → Service accounts → Generate new private key → client_email"],
    ["FIREBASE_PRIVATE_KEY", keyState, "Same JSON file → private_key (keep the \\n characters, wrap the value in double quotes)"]
  ];
  admin.forEach(([name, s, hint]) => checks.push({ name, group: "admin", state: adc && s !== "ok" ? "ok" : s, hint: adc && s !== "ok" ? "Not needed: Application Default Credentials are in use" : hint }));

  const webConfigured = checks.filter((c) => c.group === "web").every((c) => c.state === "ok");
  const adminConfigured = checks.filter((c) => c.group === "admin").every((c) => c.state === "ok");
  const nextStep = !webConfigured && !adminConfigured ? "Create a Firebase project, add a Web app, then fill in .env.local (see the README, section Firebase setup)."
    : !webConfigured ? "Add the four NEXT_PUBLIC_FIREBASE_* values from your Firebase Web app to .env.local."
    : !adminConfigured ? "Add the service-account values (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) to .env.local."
    : "All settings found. Enable Anonymous sign-in and create the Firestore database, then run npm run check:firebase.";
  return { webConfigured, adminConfigured, ready: webConfigured && adminConfigured, checks, nextStep };
}
