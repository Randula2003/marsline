// Browser demo backend. Used automatically when Firebase is not configured (or when the user switches to demo mode),
// so every feature of the console works without any cloud setup. Data lives in this browser's localStorage only.
import { ZodError } from "zod";
import { handoffSchema, lifeSupportSchema, logSchema, messageSchema, waypointSchema } from "@/lib/validation";
import { MISSION_SOL, NASA_DATASETS } from "@/lib/constants";

type Rec = Record<string, unknown> & { id: string };
type Db = { waypoints: Rec[]; logs: Rec[]; lifeSupport: Rec[]; messages: Rec[]; handoffs: Rec[] };
const KEY = "marsline-demo-v1";
const now = () => new Date().toISOString();
const uid = () => `demo-${Math.random().toString(36).slice(2, 10)}`;

function seed(): Db {
  const t = now();
  return {
    waypoints: [
      { id: "demo-habitat", name: "Jezero habitat reference", type: "HABITAT", latitudeDeg: 18.4447, longitudeDeg: 77.4508, notes: "Demo reference", sequence: 1, coordinateSystem: "IAU2000:49900", createdAt: t, isDemo: true },
      { id: "demo-delta", name: "Delta science target", type: "SCIENCE_TARGET", latitudeDeg: 18.43, longitudeDeg: 77.48, notes: "Illustrative target", sequence: 2, coordinateSystem: "IAU2000:49900", createdAt: t, isDemo: true }
    ],
    logs: [{ id: "demo-log-1", title: "Demo workspace initialised", note: "Marsline is running in demo mode. Entries are saved in this browser only.", logType: "MISSION_STATUS", occurredAt: t, createdAt: t }],
    lifeSupport: [],
    handoffs: [],
    messages: [{
      id: "demo-msg-1", senderCallsign: "MARS MAIN STATION", recipient: "ASTRONAUT-01", direction: "STATION_TO_ASTRONAUT", subject: "Welcome to the Marsline demo",
      messageBody: "Messages are stored in this browser as a simulation. Nothing is transmitted over a radio link.", priority: "ROUTINE", marsSol: MISSION_SOL,
      transport: "BROWSER_DEMO", deliveryStatus: "DELIVERED_SIMULATION", transmissionNote: "Demo mode simulation only.", sentAt: t, createdAt: t
    }]
  };
}

let memory: Db | null = null;
function load(): Db {   // note: data saved before handoffs existed has no handoffs list, so it is defaulted below
  if (memory) return memory;
  try { const raw = window.localStorage.getItem(KEY); if (raw) { memory = JSON.parse(raw) as Db; memory.handoffs ??= []; return memory; } } catch { /* storage blocked: stay in memory */ }
  memory = seed(); save(); return memory;
}
function save() { try { window.localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* ignore */ } }
export function resetDemoData() { memory = seed(); save(); }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const bad = (error: unknown, fallback: string) => {
  if (error instanceof ZodError) return json({ error: "Request validation failed." }, 400);
  if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, 400);
  return json({ error: error instanceof Error ? error.message : fallback }, 400);
};
const body = async (init: RequestInit) => JSON.parse(typeof init.body === "string" ? init.body : "{}");

export async function demoRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const db = load();
  const url = path.split("?")[0];

  if (url === "/api/health") return json({ ok: true, database: "Browser demo storage", projectId: "demo mode (no Firebase)", uid: "demo-user", checkedAt: now() });
  if (url === "/api/workspace" && method === "POST") return json({ ok: true, uid: "demo-user", mission: { code: "ARES-FS-01", name: "Ares · Jezero Field Study", status: "PLANNING" } });
  if (url === "/api/nasa/catalog") return json({ source: "Built-in catalogue (demo)", data: NASA_DATASETS });

  if (url === "/api/waypoints") {
    if (method === "GET") return json({ data: [...db.waypoints].sort((a, b) => Number(a.sequence) - Number(b.sequence)) });
    try {
      const b = waypointSchema.parse(await body(init));
      const last = Math.max(0, ...db.waypoints.map((w) => Number(w.sequence) || 0));
      const rec: Rec = { id: uid(), ...b, sequence: last + 1, coordinateSystem: "IAU2000:49900", createdAt: now(), isDemo: false };
      db.waypoints.push(rec); save(); return json({ data: rec }, 201);
    } catch (e) { return bad(e, "Unable to save waypoint"); }
  }
  const wp = url.match(/^\/api\/waypoints\/(.+)$/);
  if (wp && method === "DELETE") {
    const i = db.waypoints.findIndex((w) => w.id === wp[1]);
    if (i < 0) return json({ error: "Waypoint not found" }, 404);
    db.waypoints.splice(i, 1); save(); return json({ ok: true });
  }

  if (url === "/api/logs") {
    if (method === "GET") return json({ data: [...db.logs].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 100) });
    try { const b = logSchema.parse(await body(init)); const t = now(); const rec: Rec = { id: uid(), ...b, occurredAt: t, createdAt: t }; db.logs.unshift(rec); save(); return json({ data: rec }, 201); }
    catch (e) { return bad(e, "Unable to create log entry"); }
  }

  if (url === "/api/life-support") {
    if (method === "GET") return json({ data: [...db.lifeSupport].sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))[0] ?? null });
    try { const b = lifeSupportSchema.parse(await body(init)); const rec: Rec = { id: uid(), ...b, isSimulated: true, recordedAt: now() }; db.lifeSupport.unshift(rec); save(); return json({ data: rec }, 201); }
    catch (e) { return bad(e, "Unable to save resource snapshot"); }
  }

  if (url === "/api/messages") {
    if (method === "GET") return json({ data: [...db.messages].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))).slice(0, 100) });
    try {
      const b = messageSchema.parse(await body(init)); const t = now();
      const rec: Rec = {
        id: uid(), senderCallsign: b.senderCallsign, recipient: "MARS MAIN STATION", direction: "ASTRONAUT_TO_STATION", subject: b.subject, messageBody: b.messageBody,
        priority: b.priority, marsSol: b.marsSol, transport: "BROWSER_DEMO", deliveryStatus: "QUEUED_SIMULATION",
        transmissionNote: "Stored in this browser for the Marsline communications simulator. Not transmitted over a spacecraft radio link.", sentAt: t, createdAt: t
      };
      db.messages.unshift(rec); save(); return json({ data: rec }, 201);
    } catch (e) { return bad(e, "Unable to save mission message"); }
  }

  if (url === "/api/handoffs") {
    if (method === "GET") return json({ data: [...db.handoffs].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).slice(0, 20) });
    try { const b = handoffSchema.parse(await body(init)); const rec: Rec = { id: uid(), ...b, savedAt: now(), isSimulated: true }; db.handoffs.unshift(rec); db.handoffs.splice(50); save(); return json({ data: rec }, 201); }
    catch (e) { return bad(e, "Unable to save handoff record"); }
  }

  // Real NASA PDS index fetch still goes through the server (read-only, allow-listed); only the sign-in is skipped.
  if (url.startsWith("/api/nasa/meda/")) {
    const headers = new Headers(init.headers); headers.set("x-marsline-demo", "1");
    return fetch(path, { ...init, headers, cache: "no-store" });
  }
  return json({ error: `Demo mode does not implement ${method} ${url}` }, 404);
}
