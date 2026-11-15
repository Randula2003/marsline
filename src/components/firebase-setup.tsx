"use client";
import { useEffect, useState } from "react";

type Check = { name: string; group: "web" | "admin"; state: "ok" | "missing" | "placeholder"; hint: string };
type Status = { webConfigured: boolean; adminConfigured: boolean; ready: boolean; checks: Check[]; nextStep: string };
const ICON = { ok: "✓", missing: "✗", placeholder: "✗" } as const;
const WORD = { ok: "found", missing: "missing", placeholder: "still a placeholder" } as const;

export default function FirebaseSetup() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/firebase-status").then((r) => r.json()).then((s: Status) => alive && setStatus(s)).catch(() => alive && setError("Could not read the server's Firebase settings."));
    return () => { alive = false; };
  }, []);
  return (
    <article className="panel">
      <div className="panel-top"><span>FIREBASE SETUP CHECKLIST</span><span className={`tag ${status?.ready ? "green" : "orange"}`}>{status ? (status.ready ? "SETTINGS FOUND" : "ACTION NEEDED") : "CHECKING"}</span></div>
      {error && <div className="fetch-result error">{error}</div>}
      {status && <>
        {(["web", "admin"] as const).map((group) => (
          <div key={group} className="fb-group">
            <div className="jz-group">{group === "web" ? "WEB APP SETTINGS (browser)" : "SERVER SETTINGS (service account)"}</div>
            {status.checks.filter((c) => c.group === group).map((c) => (
              <div key={c.name} className={`fb-check ${c.state}`}><i>{ICON[c.state]}</i><div><b>{c.name}</b><small>{c.state === "ok" ? WORD.ok : `${WORD[c.state]} · ${c.hint}`}</small></div></div>
            ))}
          </div>
        ))}
        <p className="jz-why"><b>Next step:</b> {status.nextStep}</p>
        <p className="fineprint">Values are never shown here. After editing <code>.env.local</code>, restart <code>npm run dev</code>. To test the real connection (Firestore write/read and anonymous sign-in), run <code>npm run check:firebase</code> in a terminal.</p>
      </>}
    </article>
  );
}
