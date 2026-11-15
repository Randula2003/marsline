#!/usr/bin/env node
// Checks the Firebase setup end to end. Usage: npm run check:firebase [-- --no-auth-test]
//  1. reads .env.local and reports missing / placeholder settings (values are never printed)
//  2. Admin SDK: writes, reads and deletes one document in Firestore (collection _marsline_healthcheck)
//  3. Web API key: asks Firebase Authentication for an anonymous sign-in (confirms Anonymous sign-in is enabled).
//     This creates one anonymous user in YOUR Firebase project; skip it with --no-auth-test.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");   // fileURLToPath keeps Windows drive paths correct
const envFile = process.env.FIREBASE_ENV_FILE ? path.resolve(process.env.FIREBASE_ENV_FILE) : path.join(root, ".env.local");   // FIREBASE_ENV_FILE is used by tests
const env = { ...process.env };
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith("#")) continue;
    let v = m[2]; if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1); env[m[1]] = v;
  }
} else console.log("! .env.local not found: copy .env.local.example to .env.local first.\n");

const PLACEHOLDER = /^(YOUR_|REPLACE)|YOUR_PROJECT_ID|YOUR_FIREBASE|xxxxx|PASTE_PRIVATE_KEY_HERE/i;
const want = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
let problems = 0;
console.log("Settings in .env.local");
for (const k of want) {
  const v = env[k]; const bad = !v || !v.trim() ? "missing" : PLACEHOLDER.test(v) ? "still a placeholder" : k === "FIREBASE_PRIVATE_KEY" && !/BEGIN PRIVATE KEY/.test(v) ? "does not look like a private key" : "";
  console.log(`  ${bad ? "✗" : "✓"} ${k}${bad ? ` — ${bad}` : ""}`); if (bad) problems++;
}
if (problems) {
  console.log(`\n${problems} setting(s) need attention. Quick path:
  1. https://console.firebase.google.com → Add project → (name it e.g. marsline)
  2. Project settings → General → Your apps → Add app → Web (</>) → copy the 4 config values into the NEXT_PUBLIC_FIREBASE_* lines
  3. Build → Authentication → Get started → Sign-in method → enable Anonymous
  4. Build → Firestore Database → Create database (production mode)
  5. Project settings → Service accounts → Generate new private key → copy project_id, client_email, private_key into the FIREBASE_* lines
  Then run this check again. Full guide: README.md, section "Firebase setup".`);
  process.exit(1);
}

let failed = 0;
try {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }), projectId: env.FIREBASE_PROJECT_ID });
  const ref = getFirestore(app).collection("_marsline_healthcheck").doc("ping");
  await ref.set({ at: new Date().toISOString() }); const snap = await ref.get(); await ref.delete();
  console.log(snap.exists ? "\n✓ Firestore: write, read and delete worked" : "\n✗ Firestore: wrote a document but could not read it back");
  if (!snap.exists) failed++;
} catch (e) {
  failed++; const msg = String(e?.message || e);
  console.log(`\n✗ Firestore (Admin SDK): ${msg.split("\n")[0]}`);
  if (/NOT_FOUND|5 NOT_FOUND/.test(msg)) console.log("   → Create the database: Firebase Console → Build → Firestore Database → Create database.");
  else if (/PERMISSION_DENIED|7 PERMISSION/.test(msg)) console.log("   → The service account lacks access. Generate a new key from Project settings → Service accounts for THIS project.");
  else if (/invalid_grant|private key|PEM|DECODER/i.test(msg)) console.log("   → The private key is malformed. Paste it in double quotes and keep the \\n sequences exactly as in the JSON file.");
}

if (process.argv.includes("--no-auth-test")) console.log("- Anonymous sign-in test skipped");
else {
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(env.NEXT_PUBLIC_FIREBASE_API_KEY)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    const j = await r.json();
    if (r.ok && j.idToken) console.log("✓ Authentication: anonymous sign-in is enabled");
    else {
      failed++; const m = j?.error?.message || `HTTP ${r.status}`;
      console.log(`✗ Authentication: ${m}`);
      if (/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(m)) console.log("   → Enable it: Firebase Console → Build → Authentication → Sign-in method → Anonymous → Enable.");
      else if (/API key not valid|API_KEY_INVALID|INVALID_KEY/i.test(m)) console.log("   → The Web API key is wrong. Copy apiKey from Project settings → Your apps → Web app.");
    }
  } catch (e) { failed++; console.log(`✗ Authentication: could not reach Firebase (${e?.message})`); }
}
console.log(failed ? `\n${failed} check(s) failed. Fix them and run again.` : "\nAll good: restart npm run dev and the sidebar will show FIREBASE CONNECTED.");
process.exit(failed ? 1 : 0);
