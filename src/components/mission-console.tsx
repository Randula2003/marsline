"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { MEDA_INDEXES, type MedaSensor, NASA_DATASETS, MARS_MEAN_RADIUS_KM } from "@/lib/constants";
import { enableDemoMode, firebaseRequest, isDemoMode } from "@/lib/firebase-client";
import { resetDemoData } from "@/lib/demo-store";
import MarsMap, { type RouteSave } from "@/components/mars-map";

type Waypoint = { id: string; name: string; type: string; latitudeDeg: number | string; longitudeDeg: number | string; notes?: string | null; sequence?: number };
type LogEntry = { id: string; title: string; note: string; logType: string; occurredAt: string };
type MissionMessage = { id: string; senderCallsign: string; recipient: string; subject: string; messageBody: string; priority: "ROUTINE" | "PRIORITY" | "URGENT"; marsSol: number; deliveryStatus: string; sentAt: string };
type MissionData = { id: string; code: string; name: string; targetRegion: string; status: string; counts: { waypoints: number; logs: number; targets: number; datasets: number }; waypoints: Waypoint[]; logs: LogEntry[]; latestResources: null | { oxygenReservePct: number; waterRemainingLiters: number; waterCapacityLiters: number; waterUseLitersDay: number; co2ScrubberPct: number; powerReservePct: number } };
type InitialData = { databaseReady: boolean; mission: MissionData | null };
type MedaResult = { sensor: string; title: string; sourceUrl: string; retrievedAt: string; httpStatus: number; byteCount: number; rowCount: number; sourceLastModified: string | null; note: string };

const nav = [
  ["overview", "Mission overview", "◫", "MISSION"], ["map", "Surface map", "⌖", ""],
  ["conditions", "Current conditions", "◉", ""], ["science", "Science data layers", "⌁", ""],
  ["routes", "Route planner", "⌁", ""], ["lifesupport", "Life support", "♡", "CREW SYSTEMS"],
  ["radiation", "Radiation context", "◌", ""], ["watch", "Wrist interface", "◷", ""],
  ["communications", "Mission communications", "✉", "OPERATIONS"],
  ["log", "Mission log", "▤", "OPERATIONS"], ["settings", "Data & Firebase", "⚙", ""]
] as const;
const layers = [
  { instrument: "MOLA / HRSC", title: "Elevation and hillshade", kind: "TOPOGRAPHIC", detail: "Global relief and elevation context from MGS MOLA and Mars Express HRSC.", url: "https://trek.nasa.gov/mars/" },
  { instrument: "THEMIS", title: "Day/night infrared", kind: "THERMAL", detail: "Mars Odyssey thermal infrared mosaics.", url: "https://trek.nasa.gov/mars/" },
  { instrument: "TES", title: "Dust and mineral products", kind: "ATMOSPHERIC", detail: "Mars Global Surveyor thermal-emission and dust products.", url: "https://trek.nasa.gov/mars/" },
  { instrument: "HiRISE", title: "High-resolution images", kind: "OPTICAL", detail: "Targeted orbital images for local terrain inspection.", url: "https://www.uahirise.org/" },
  { instrument: "CTX", title: "Context Camera", kind: "OPTICAL", detail: "Regional imagery between high-resolution footprints.", url: "https://trek.nasa.gov/mars/" },
  { instrument: "CRISM", title: "Mineral spectroscopy", kind: "SPECTRAL", detail: "Visible and near-infrared mineralogical observations.", url: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm" },
  { instrument: "SHARAD", title: "Subsurface radar", kind: "RADAR", detail: "Orbital radar sounding products and tracks.", url: "https://pds-geosciences.wustl.edu/missions/mro/sharad.htm" },
  { instrument: "MEDA", title: "Rover-local environment", kind: "IN SITU", detail: "Perseverance pressure, wind, temperature, humidity and related products.", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" }
];
const engineered = [
  { source: "HRSC DTM", kind: "DERIVED", title: "Slope and roughness", detail: "Horn slope (degrees) and local roughness from the 75 m HRSC elevation model, cross-checked against MGS MOLA." },
  { source: "USGS SIM 3464", kind: "GEOLOGIC", title: "Geologic units, scarps and craters", detail: "14 mapped units, ridge/rim/delta-front lines and 341 small craters, reprojected from Mars MTM to longitude/latitude." },
  { source: "CTX · THEMIS", kind: "OPTICAL · THERMAL", title: "Imagery and day/night infrared", detail: "Caltech CTX mosaic plus THEMIS day and night thermal infrared, warped onto the same grid as the terrain layers." },
  { source: "DERIVED", kind: "SAFETY", title: "Traversability classes", detail: "No-go, caution and nominal terrain from slope, roughness, geology cost and scarps. Drives the A* route planner." },
  { source: "MGS MOLA", kind: "REGIONAL", title: "More study areas", detail: "Nili Fossae, Syrtis Major and Isidis Planitia built from the global 463 m MOLA tile: hillshade, slope, traversability, relief-derived targets and routes. Add more by editing REGIONS in the notebook." },
  { source: "MEDA INDEX", kind: "IN SITU", title: "Sol, season and local-time coverage", detail: "Which Perseverance sols, seasons (Ls) and hours have wind and ancillary data, ready to guide real data retrieval." }
] as const;
function marsDistance(a: Waypoint, b: Waypoint) {
  const rad = (v: number) => v * Math.PI / 180;
  const lat1 = rad(Number(a.latitudeDeg)), lat2 = rad(Number(b.latitudeDeg));
  const dLat = lat2 - lat1, dLon = rad(Number(b.longitudeDeg) - Number(a.longitudeDeg));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_MEAN_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
const missionTimeZone = "Asia/Colombo";
const missionTimeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: missionTimeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const store = () => (isDemoMode() ? "demo storage in this browser" : "Cloud Firestore");
const dateText = (v: string) => new Date(v).toLocaleString("en-GB", { timeZone: missionTimeZone });

export default function MissionConsole({ initial }: { initial: InitialData }) {
  const [view, setView] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dbReady, setDbReady] = useState(initial.databaseReady);
  const [dbInfo, setDbInfo] = useState(initial.databaseReady ? "Firebase workspace connected" : "Configure Firebase project settings");
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initial.mission?.waypoints ?? []);
  const [logs, setLogs] = useState<LogEntry[]>(initial.mission?.logs ?? []);
  const [messages, setMessages] = useState<MissionMessage[]>([]);
  const [senderCallsign, setSenderCallsign] = useState("ASTRONAUT-01");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messagePriority, setMessagePriority] = useState<"ROUTINE" | "PRIORITY" | "URGENT">("ROUTINE");
  const [messageSol, setMessageSol] = useState("018");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [meda, setMeda] = useState<Partial<Record<MedaSensor, MedaResult | { error: string }>>>({});
  const [busySensor, setBusySensor] = useState<MedaSensor | "">("");
  const [missionTime, setMissionTime] = useState("--:--:--");
  const [toast, setToast] = useState("");
  const [wpName, setWpName] = useState("");
  const [wpType, setWpType] = useState("SCIENCE_TARGET");
  const [wpLat, setWpLat] = useState("18.4447");
  const [wpLon, setWpLon] = useState("77.4508");
  const [wpNotes, setWpNotes] = useState("");
  const [logTitle, setLogTitle] = useState("");
  const [logText, setLogText] = useState("");
  const [logType, setLogType] = useState("SCIENCE_OBSERVATION");
  const [resources, setResources] = useState(initial.mission?.latestResources ?? { oxygenReservePct: 78, waterRemainingLiters: 6.4, waterCapacityLiters: 10, waterUseLitersDay: 2.5, co2ScrubberPct: 92, powerReservePct: 86 });
  const [resourceNotes, setResourceNotes] = useState("Demonstration values only.");
  const [lastHealth, setLastHealth] = useState("Not checked");
  const [healthChecking, setHealthChecking] = useState(false);
  const [demo, setDemo] = useState(false);
  const missionCode = initial.mission?.code ?? "ARES-FS-01";
  const counts = initial.mission?.counts;
  const routeDistance = useMemo(() => waypoints.slice(1).reduce((sum, wp, i) => sum + marsDistance(waypoints[i], wp), 0), [waypoints]);
  const medaCount = Object.keys(meda).length;
  const waterPct = resources.waterCapacityLiters > 0 ? Math.max(0, Math.min(100, resources.waterRemainingLiters / resources.waterCapacityLiters * 100)) : 0;

  const notify = useCallback((text: string) => { setToast(text); window.setTimeout(() => setToast(""), 3200); }, []);
  function navigate(name: string) { setView(name); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const checkHealth = useCallback(async () => {
    setHealthChecking(true);
    setDbInfo(isDemoMode() ? "Checking demo storage…" : "Checking Firebase Authentication and Cloud Firestore…");
    try {
      const res = await firebaseRequest("/api/health");
      const raw = await res.text();
      let data: { ok?: boolean; database?: string; projectId?: string; error?: string } = {};
      try { data = raw ? JSON.parse(raw) as typeof data : {}; }
      catch { throw new Error(`Health endpoint returned an unreadable response (HTTP ${res.status}).`); }

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Firebase health check failed (HTTP ${res.status}).`);
      }

      setDbReady(true);
      setDbInfo(`${data.database ?? "Cloud Firestore"} · ${data.projectId ?? "Connected"}`);
      setLastHealth(missionTimeFormatter.format(new Date()));
      notify(isDemoMode() ? "Demo mode is active. Data is saved in this browser." : "Firebase Authentication and Firestore are connected.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Firebase connection unavailable.";
      setDbReady(false);
      setDbInfo(message);
      setLastHealth(missionTimeFormatter.format(new Date()));
      notify(`Firebase check failed: ${message}`);
    } finally {
      setHealthChecking(false);
    }
  }, [notify]);
  const refreshWorkspace = useCallback(async () => {
    try {
      const [w, l, resourcesResult, messageResult] = await Promise.all([firebaseRequest("/api/waypoints"), firebaseRequest("/api/logs"), firebaseRequest("/api/life-support"), firebaseRequest("/api/messages")]);
      if (w.ok) setWaypoints((await w.json()).data ?? []);
      if (l.ok) setLogs((await l.json()).data ?? []);
      if (messageResult.ok) setMessages((await messageResult.json()).data ?? []);
      if (resourcesResult.ok) { const latest = (await resourcesResult.json()).data; if (latest) setResources({ oxygenReservePct: latest.oxygenReservePct, waterRemainingLiters: latest.waterRemainingLiters, waterCapacityLiters: latest.waterCapacityLiters, waterUseLitersDay: latest.waterUseLitersDay, co2ScrubberPct: latest.co2ScrubberPct, powerReservePct: latest.powerReservePct }); }
    } catch { /* Keep the preview state if Firebase is not configured. */ }
  }, []);
  useEffect(() => {
    const update = () => setMissionTime(missionTimeFormatter.format(new Date()));
    update(); const timer = window.setInterval(update, 1000);
    void (async () => {
      try {
        const bootstrap = await firebaseRequest("/api/workspace", { method: "POST" });
        setDemo(isDemoMode());
        const result = await bootstrap.json();
        if (!bootstrap.ok) throw new Error(result.error ?? "Could not initialize Firebase workspace");
        await checkHealth(); await refreshWorkspace();
        notify(isDemoMode() ? "Demo workspace ready. Data is saved in this browser." : "Your Firebase mission workspace is ready");
      } catch (error) {
        setDbReady(false); setDbInfo(error instanceof Error ? error.message : "Firebase setup is required");
      }
    })();
    return () => window.clearInterval(timer);
  }, [checkHealth, notify, refreshWorkspace]);

  async function switchToDemo() {
    enableDemoMode(); setDemo(true);
    await checkHealth(); await refreshWorkspace();
  }
  async function resetDemo() {
    resetDemoData(); await refreshWorkspace(); notify("Demo data reset to the starter state");
  }
  async function saveRoute({ start, end, route }: RouteSave) {
    const post = async (path: string, body: unknown) => {
      const res = await firebaseRequest(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Unable to save");
      return json.data;
    };
    try {
      const summary = `${(route.distM / 1000).toFixed(2)} km, about ${Math.round(route.timeMin)} min walking (concept estimate), max slope ${route.maxSlopeDeg.toFixed(1)} deg, climb ${Math.round(route.gainM)} m, ${route.cautionPct.toFixed(0)}% on caution terrain.`;
      const created: Waypoint[] = [];
      for (const [p, type] of [[start, "OBSERVATION_POINT"], [end, "SCIENCE_TARGET"]] as const) {
        if (p.kind === "waypoint" || waypoints.some((w) => Math.abs(Number(w.latitudeDeg) - p.lat) < 1e-5 && Math.abs(Number(w.longitudeDeg) - p.lon) < 1e-5)) continue;
        created.push(await post("/api/waypoints", { name: p.label.slice(0, 80), type: p.kind === "base" ? "HABITAT" : type, latitudeDeg: Number(p.lat.toFixed(6)), longitudeDeg: Number(p.lon.toFixed(6)), notes: `Terrain-aware route ${start.label} to ${end.label}: ${summary}`.slice(0, 1000) }));
      }
      const log = await post("/api/logs", { title: `Route planned: ${start.label} to ${end.label}`.slice(0, 120), note: summary, logType: "ROUTE_UPDATE" });
      setWaypoints((old) => [...old, ...created]); setLogs((old) => [log, ...old]); notify(`Route saved to ${store()}`);
    } catch (e) { notify(e instanceof Error ? e.message : "Database unavailable"); }
  }
  async function addWaypoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const res = await firebaseRequest("/api/waypoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: wpName, type: wpType, latitudeDeg: Number(wpLat), longitudeDeg: Number(wpLon), notes: wpNotes }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Unable to save waypoint");
      setWaypoints((old) => [...old, json.data]); setWpName(""); setWpNotes(""); notify(`Waypoint stored in ${store()}`);
    } catch (e) { notify(e instanceof Error ? e.message : "Database unavailable"); }
  }
  async function removeWaypoint(id: string) {
    try {
      const res = await firebaseRequest(`/api/waypoints/${id}`, { method: "DELETE" }); const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setWaypoints((old) => old.filter((w) => w.id !== id)); notify(`Waypoint deleted from ${store()}`);
    } catch (e) { notify(e instanceof Error ? e.message : "Delete failed"); }
  }
  async function addLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const res = await firebaseRequest("/api/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: logTitle, note: logText, logType }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Unable to save entry");
      setLogs((old) => [json.data, ...old]); setLogTitle(""); setLogText(""); notify(`Mission log saved to ${store()}`);
    } catch (e) { notify(e instanceof Error ? e.message : "Database unavailable"); }
  }
  async function addResourceSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const res = await firebaseRequest("/api/life-support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...resources, notes: resourceNotes }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error ?? "Unable to save snapshot");
      notify(`Simulated resource snapshot saved to ${store()}`);
    } catch (e) { notify(e instanceof Error ? e.message : "Database unavailable"); }
  }
  async function sendMissionMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingMessage(true);
    try {
      const res = await firebaseRequest("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderCallsign,
          subject: messageSubject,
          messageBody,
          priority: messagePriority,
          marsSol: Number(messageSol),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unable to save message");
      setMessages((old) => [json.data, ...old]);
      setMessageSubject("");
      setMessageBody("");
      notify("Message saved to the Mars Main Station simulation outbox. No radio transmission occurred.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to save mission message");
    } finally {
      setSendingMessage(false);
    }
  }
  async function loadMeda(sensor: MedaSensor) {
    setBusySensor(sensor);
    try {
      const res = await firebaseRequest(`/api/nasa/meda/${sensor}`, { cache: "no-store" }); const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "PDS retrieval failed");
      setMeda((old) => ({ ...old, [sensor]: json })); notify(isDemoMode() ? `${sensor} index fetched from NASA PDS (demo mode: not stored)` : `${sensor} index fetched and retrieval recorded in Firestore`);
    } catch (e) {
      const text = e instanceof Error ? e.message : "NASA index retrieval failed";
      setMeda((old) => ({ ...old, [sensor]: { error: text } })); notify(text);
    } finally { setBusySensor(""); }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <a className="brand" href="#overview" onClick={(e) => { e.preventDefault(); navigate("overview"); }}><span className="brand-mark">M</span><span><b>MARSLINE</b><small>MISSION INTELLIGENCE</small></span></a>
      <div className="mission-selector"><span className="overline">ACTIVE EXPEDITION</span><strong>{missionCode}</strong><small><i className="pulse" /> SURFACE OPERATIONS</small></div>
      <nav className="side-nav">{nav.map(([id, label, glyph, group]) => <div key={id}>{group && <div className="nav-group">{group}</div>}<button className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)}><span>{glyph}</span>{label}</button></div>)}</nav>
      <div className="sidebar-bottom"><div className="connection-card"><i className={`connection-dot ${dbReady ? "online" : ""}`} /><div><b>{demo ? "DEMO MODE" : dbReady ? "FIREBASE CONNECTED" : "FIREBASE NOT CONFIGURED"}</b><small>{demo ? "Data saved in this browser" : dbReady ? "Firebase Authentication + Cloud Firestore" : "Configure Firebase project settings"}</small></div></div><div className="sidebar-foot">BUILD 4.0 · NEXT.JS + FIREBASE<br />NASA PDS · MARS TREK WMTS</div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle navigation">☰</button><div className="breadcrumb"><span>ARES EXPEDITION</span><b>/</b><strong>{nav.find((item) => item[0] === view)?.[1]}</strong></div><div className="topbar-right"><span className="clock">UTC+05:30 {missionTime}</span><span className="sol-chip">SOL <b>018</b></span><span className={`db-chip ${dbReady ? "connected" : ""}`}>{demo ? "DEMO MODE" : dbReady ? "FIREBASE ONLINE" : "FIREBASE SETUP"}</span></div></header>
      <div className="page-content">
        {view === "overview" && <>
          <PageHead eyebrow="HUMAN EXPLORATION · SURFACE OPERATIONS" title="Mission overview" desc="One operational picture for terrain, environment, science objectives and crew resources." right={<span className="heading-status"><i className="pulse" /> WORKSPACE READY<small>{demo ? "BROWSER DEMO MODE" : dbReady ? "CLOUD FIRESTORE MODE" : "FIREBASE SETUP REQUIRED"}</small></span>} />
          {demo && <div className="setup-banner"><b>Demo mode.</b><span>Every feature works without Firebase: waypoints, logs, messages and life-support snapshots are saved in this browser only. Add Firebase settings to save to Cloud Firestore instead.</span><button onClick={() => navigate("settings")}>FIREBASE SETUP →</button></div>}
          {!demo && !dbReady && <div className="setup-banner"><b>Firebase is not connected.</b><span>Add your Firebase Web App settings and Admin SDK credentials, or run the whole application in demo mode now.</span><button onClick={() => void switchToDemo()}>USE DEMO MODE</button><button onClick={() => navigate("settings")}>FIREBASE SETUP →</button></div>}
          <div className="hero-grid"><article className="hero-card"><div className="hero-planet"><div className="planet" /><div className="orbit one" /><div className="orbit two" /></div><div className="hero-copy"><span className="overline">MISSION TARGET</span><h2>Jezero Crater</h2><p>Perseverance exploration region · western Isidis Planitia</p><div className="coordinates"><span>18.38° N</span><span>77.58° E</span></div><button className="text-action" onClick={() => navigate("map")}>OPEN NASA SURFACE MAP ↗</button></div></article>
            <article className="panel mission-card"><div className="panel-top"><span>EXPEDITION STATUS</span><span className="tag orange">{initial.mission?.status ?? "SEED REQUIRED"}</span></div><div className="sol-number"><strong>018</strong><span>SOL</span></div><div className="progress-track"><i style={{ width: "36%" }} /></div><div className="progress-meta"><span>Mission day 18</span><b>36% · concept timeline</b></div><div className="mini-stats"><div><small>SCIENCE TARGETS</small><b>{counts?.targets ?? 0}</b></div><div><small>WAYPOINTS</small><b>{waypoints.length}</b></div><div><small>LOG ENTRIES</small><b>{logs.length}</b></div></div></article></div>
          <SectionTitle eyebrow="OPERATIONAL PICTURE" title="Mission systems" note="Resource figures are simulations" />
          <div className="metric-grid four"><Metric label="OXYGEN RESERVE" value={`${resources.oxygenReservePct}%`} symbol="O₂" note="SIMULATED" pct={resources.oxygenReservePct} /><Metric label="WATER RESERVE" value={`${Math.round(waterPct)}%`} symbol="H₂O" note="SIMULATED" pct={waterPct} /><Metric label="POWER RESERVE" value={`${resources.powerReservePct}%`} symbol="⚡" note="SIMULATED" pct={resources.powerReservePct} /><Metric label="NASA DATASETS" value={String(counts?.datasets ?? NASA_DATASETS.length)} symbol="✦" note="CATALOGUE RECORDS" pct={89} /></div>
          <div className="two-col"><article className="panel"><div className="panel-top"><span>MISSION WATCHLIST</span><span className="tag">DATA PROVENANCE</span></div><Watch title="Environmental observations" desc="Perseverance MEDA indexes are rover-local PDS archive products, not live Mars weather." button="CONDITIONS" onClick={() => navigate("conditions")} /><Watch title="Terrain and elevation" desc="NASA Mars Trek exposes global MOLA / HRSC layers and targeted image footprints." button="MAP" onClick={() => navigate("map")} /><Watch title="Mineralogy and subsurface" desc="Compare CRISM spectral footprints and SHARAD radar tracks with optical imagery." button="SCIENCE" onClick={() => navigate("science")} /></article>
            <article className="panel"><div className="panel-top"><span>QUICK OPERATIONS</span><span className="tag">WORKSPACE</span></div><div className="quick-grid"><Quick title="Plan route" symbol="＋" onClick={() => navigate("routes")} /><Quick title="Check conditions" symbol="◉" onClick={() => navigate("conditions")} /><Quick title="Life support" symbol="♡" onClick={() => navigate("lifesupport")} /><Quick title="Science note" symbol="▤" onClick={() => navigate("log")} /></div></article></div>
          <Notice title="Scientific and safety scope">NASA observations are historical, location-specific and instrument-dependent. Resource reserves and mission values are software simulations, not certified life-support calculations.</Notice>
        </>}
        {view === "map" && <>
          <PageHead eyebrow="NASA ORBITAL DATA · GEOSPATIAL CONTEXT" title="Surface map" desc="Pick a study area: Jezero in detail, plus regional views of Nili Fossae, Syrtis Major and Isidis Planitia. Layered NASA and USGS data with terrain-aware routes." right={<a className="button primary" href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer">OPEN NASA MARS TREK ↗</a>} />
          <MarsMap waypoints={waypoints} onSaveRoute={dbReady ? saveRoute : undefined} />
          <SectionTitle eyebrow="MISSION OVERLAY DATA" title="Saved waypoints" note={`${waypoints.length} saved records`} />
          <div className="metric-grid three">{waypoints.length ? waypoints.map((w) => <article className="panel waypoint-card" key={w.id}><b>{w.name}</b><span className="tag">{w.type}</span><small>{Number(w.latitudeDeg).toFixed(5)}° · {Number(w.longitudeDeg).toFixed(5)}°</small></article>) : <div className="empty-state">No waypoint records yet. Add them in Route Planner.</div>}</div>
          <Notice title="Where this data comes from">Layers were engineered offline by <code>notebooks/01_feature_engineering.ipynb</code>. Jezero uses Mars Express HRSC elevation (75 m), MRO CTX imagery, Mars Odyssey THEMIS and the USGS geologic map (SIM 3464). The other areas use the global MGS MOLA elevation tile (463 m) only, so their slopes are smoothed and their targets are relief-derived. Slope limits and scores are concept-level assumptions, not NASA-certified mobility limits. Coordinates use the Mars 2000 sphere, east-positive longitude.</Notice>
        </>}
        {view === "conditions" && <>
          <PageHead eyebrow="SURFACE ENVIRONMENT · IN-SITU ARCHIVE" title="Current conditions" desc="Retrieve the published MEDA archive indexes and record retrieval metadata." />
          <div className="data-warning"><b>Not a live global weather feed.</b> MEDA measures conditions at the Perseverance rover site. PDS indexes catalogue archived products; row counts are not measurements or forecasts.</div>
          <div className="data-banner"><div><span className="overline">OBSERVATION PLATFORM</span><h2>Perseverance · MEDA</h2><p>Mars Environmental Dynamics Analyzer. PDS publishes separate calibrated and derived product indexes for the instrument suite.</p></div><a className="button outline" href="https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" target="_blank" rel="noreferrer">PDS MEDA DOCUMENTATION ↗</a></div>
          <SectionTitle eyebrow="PDS CSV PRODUCT INDEXES" title="Retrieve source indexes" note="Successful fetches are recorded in Firestore" />
          <div className="metric-grid three">{(Object.keys(MEDA_INDEXES) as MedaSensor[]).map((sensor) => {
            const result = meda[sensor]; const config = MEDA_INDEXES[sensor];
            return <article className="panel sensor-card" key={sensor}><div className="sensor-head"><span className="sensor-code">{sensor}</span><span className="tag">PDS INDEX</span></div><h3>{config.title}</h3><p>Perseverance rover archive · Jezero region</p>
              {result && "error" in result ? <div className="fetch-result error">{result.error}</div> : result ? <div className="fetch-result"><b>{result.rowCount.toLocaleString()} index records</b><small>Retrieved {dateText(result.retrievedAt)}</small><small>{(result.byteCount / 1024).toFixed(1)} KB · HTTP {result.httpStatus}</small><small>{result.sourceLastModified ?? "Source modification date not provided"}</small></div> : <div className="fetch-empty">Not retrieved in this session</div>}
              <button className="button primary full" disabled={busySensor === sensor} onClick={() => loadMeda(sensor)}>{busySensor === sensor ? "FETCHING…" : "FETCH PDS INDEX →"}</button><a className="source-link" href={config.url} target="_blank" rel="noreferrer">OPEN ORIGINAL CSV ↗</a></article>;
          })}</div>
          <Notice title="What this integration retrieves">This connects to NASA&apos;s published PDS CSV product indexes. It records status, HTTP code, row count, bytes, source modified header and retrieval time in Firestore. It does not yet download every underlying calibrated product file or parse sensor measurements into environmental time-series records.</Notice>
        </>}
        {view === "science" && <>
          <PageHead eyebrow="MULTI-MISSION SCIENCE CONTEXT" title="Science data layers" desc="Catalogue optical, thermal, spectral, topographic, atmospheric, radar and rover-local products." right={<a className="button primary" href="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars" target="_blank" rel="noreferrer">WMTS DOCUMENTATION ↗</a>} />
          <div className="science-feature"><div><span className="overline">LAYER STACK</span><h2>One location. Multiple scientific perspectives.</h2><p>Begin with terrain, then compare thermal, dust, mineralogical, high-resolution optical and in-situ archive products. Their coverage, resolution and acquisition history differ.</p></div><div className="layer-stack"><i /><i /><i /><i /><i /></div></div>
          <SectionTitle eyebrow="ENGINEERED FOR THIS APP" title="Layers built from your NASA files" note="Produced by notebooks/01_feature_engineering.ipynb" />
          <div className="metric-grid three">{engineered.map((item) => <article className="dataset-card" key={item.title}><div className="dataset-head"><span className="dataset-code">{item.source}</span><span className="tag green">{item.kind}</span></div><h3>{item.title}</h3><p>{item.detail}</p><button className="button outline" onClick={() => navigate("map")}>SHOW ON MAP →</button></article>)}</div>
          <SectionTitle eyebrow="CATALOGUE" title="Other NASA science sources" note="Not yet rendered as map layers" />
          <div className="metric-grid three">{layers.map((item) => <DatasetCard key={item.instrument} {...item} />)}</div>
          <div className="metric-grid three">{NASA_DATASETS.slice(7).map((item) => <DatasetCard key={item.productCode} instrument={item.instrument} title={item.title} kind={item.dataType} detail={item.description} url={item.sourceUrl} />)}</div>
          <Notice title="Coverage is not uniform">A blank tile or missing footprint means that a dataset has no coverage at that location; it does not indicate the absence of a surface feature. Confirm footprint, projection, observation time and processing level.</Notice>
        </>}
        {view === "routes" && <>
          <PageHead eyebrow="EXCURSION PLANNING · MARS COORDINATES" title="Route planner" desc="Create saved waypoints and estimate direct Mars surface distance between consecutive stops." />
          <div className="data-banner"><div><span className="overline">TERRAIN-AWARE</span><h2>Plan a walkable route on the map</h2><p>A* pathfinding over slope, roughness, geology and ridge scarps. The straight-line distances below ignore terrain.</p></div><button className="button primary" onClick={() => navigate("map")}>OPEN SURFACE MAP →</button></div>
          <div className="route-layout"><article className="panel"><div className="panel-top"><span>ADD WAYPOINT</span><span className="tag">IAU2000:49900</span></div><form className="form-grid" onSubmit={addWaypoint}>
            <label>Waypoint name<input required minLength={2} maxLength={80} value={wpName} onChange={(e) => setWpName(e.target.value)} placeholder="Clay-bearing outcrop" /></label>
            <label>Waypoint type<select value={wpType} onChange={(e) => setWpType(e.target.value)}><option value="SCIENCE_TARGET">Science target</option><option value="HABITAT">Habitat</option><option value="RESOURCE_CACHE">Resource cache</option><option value="OBSERVATION_POINT">Observation point</option><option value="HAZARD">Hazard / avoid</option><option value="ROVER_POSITION">Rover position</option><option value="OTHER">Other</option></select></label>
            <label>Latitude (°)<input type="number" required min={-90} max={90} step="0.000001" value={wpLat} onChange={(e) => setWpLat(e.target.value)} /></label>
            <label>Longitude (°E)<input type="number" required min={0} max={360} step="0.000001" value={wpLon} onChange={(e) => setWpLon(e.target.value)} /></label>
            <label className="wide">Notes<textarea rows={2} value={wpNotes} onChange={(e) => setWpNotes(e.target.value)} maxLength={1000} placeholder="Image footprint, science rationale or terrain note..." /></label>
            <button className="button primary wide" type="submit">＋ SAVE WAYPOINT TO FIRESTORE</button>
          </form></article>
          <article className="panel route-summary"><div className="panel-top"><span>ROUTE DISTANCE</span><span className="tag orange">MARS RADIUS</span></div><div className="distance-number">{routeDistance.toFixed(2)} <span>KM</span></div><p>Great-circle estimate using mean Mars radius of {MARS_MEAN_RADIUS_KM.toLocaleString()} km.</p><div className="data-line"><span>Waypoints</span><b>{waypoints.length}</b></div><div className="data-line"><span>Coordinate system</span><b>IAU 2000 / 49900</b></div><div className="data-line"><span>Terrain correction</span><b>Use Surface map planner</b></div></article></div>
          <article className="panel"><div className="panel-top"><span>SAVED WAYPOINTS</span><span className="tag">{waypoints.length} RECORDS</span></div>{waypoints.length === 0 ? <div className="empty-state">No waypoint records. Connect Firebase and initialize the starter workspace to begin.</div> : <div className="table-wrap"><table><thead><tr><th>SEQ</th><th>NAME</th><th>TYPE</th><th>LATITUDE</th><th>LONGITUDE</th><th>LEG DISTANCE</th><th /></tr></thead><tbody>{waypoints.map((w, i) => <tr key={w.id}><td>{i + 1}</td><td><b>{w.name}</b></td><td>{w.type}</td><td>{Number(w.latitudeDeg).toFixed(5)}°</td><td>{Number(w.longitudeDeg).toFixed(5)}°</td><td>{i ? `${marsDistance(waypoints[i - 1], w).toFixed(2)} km` : "START"}</td><td><button className="remove" onClick={() => removeWaypoint(w.id)}>REMOVE</button></td></tr>)}</tbody></table></div>}</article>
          <Notice title="Route limitation">Straight-line distances do not account for slope, boulders, roughness, suit mobility, dust, visibility or obstacles. Use the Surface map to plan a terrain-aware route in any study area.</Notice>
        </>}
        {view === "lifesupport" && <>
          <PageHead eyebrow="CREW RESOURCE MODEL" title="Life support" desc="Save an editable resource snapshot in Cloud Firestore. These values are fictional demonstrations." />
          <div className="simulation-banner">SIMULATION ONLY · NOT REAL LIFE-SUPPORT TELEMETRY OR OPERATIONAL GUIDANCE</div>
          <form className="panel resource-form" onSubmit={addResourceSnapshot}><div className="resource-grid">
            <ResourceField label="Oxygen reserve (%)" value={resources.oxygenReservePct} max={100} onChange={(v) => setResources((s) => ({ ...s, oxygenReservePct: v }))} />
            <ResourceField label="Water remaining (L)" value={resources.waterRemainingLiters} max={100000} onChange={(v) => setResources((s) => ({ ...s, waterRemainingLiters: v }))} />
            <ResourceField label="Water capacity (L)" value={resources.waterCapacityLiters} max={100000} onChange={(v) => setResources((s) => ({ ...s, waterCapacityLiters: v }))} />
            <ResourceField label="Planned water use (L/day)" value={resources.waterUseLitersDay} max={10000} onChange={(v) => setResources((s) => ({ ...s, waterUseLitersDay: v }))} />
            <ResourceField label="CO₂ scrubber model (%)" value={resources.co2ScrubberPct} max={100} onChange={(v) => setResources((s) => ({ ...s, co2ScrubberPct: v }))} />
            <ResourceField label="Power reserve (%)" value={resources.powerReservePct} max={100} onChange={(v) => setResources((s) => ({ ...s, powerReservePct: v }))} />
          </div><label className="field-label">Snapshot note<textarea rows={2} value={resourceNotes} onChange={(e) => setResourceNotes(e.target.value)} /></label><button className="button primary" type="submit">SAVE SIMULATED SNAPSHOT TO FIRESTORE</button>
          <div className="resource-preview"><Metric label="OXYGEN" value={`${resources.oxygenReservePct}%`} symbol="O₂" note="SIMULATED" pct={resources.oxygenReservePct} /><Metric label="WATER" value={`${resources.waterRemainingLiters} L`} symbol="H₂O" note="SIMULATED" pct={resources.waterCapacityLiters ? resources.waterRemainingLiters / resources.waterCapacityLiters * 100 : 0} /><Metric label="CO₂ MODEL" value={`${resources.co2ScrubberPct}%`} symbol="CO₂" note="SIMULATED" pct={resources.co2ScrubberPct} /><Metric label="POWER" value={`${resources.powerReservePct}%`} symbol="⚡" note="SIMULATED" pct={resources.powerReservePct} /></div></form>
        </>}
        {view === "radiation" && <>
          <PageHead eyebrow="SPACE ENVIRONMENT · ARCHIVAL SCIENCE" title="Radiation context" desc="Inspect the NASA instruments contributing to the radiation picture; do not infer a crew dose from an unvalidated summary." />
          <div className="data-banner"><div><span className="overline">SURFACE IN-SITU INSTRUMENT</span><h2>Curiosity · RAD</h2><p>The Radiation Assessment Detector measured energetic particle radiation at Gale Crater. Perseverance MEDA RDS is a different instrument and its products must not be treated as interchangeable.</p></div><span className="rad-symbol">☢</span></div>
          <div className="metric-grid three"><DatasetCard instrument="RAD" title="Curiosity Radiation Assessment Detector" kind="RADIATION" detail="Surface particle radiation archive from Gale Crater." url="https://pds.nasa.gov/" /><DatasetCard instrument="MEDA RDS" title="Radiation and Dust Sensor" kind="UV / DUST" detail="Perseverance MEDA archive products; inspect instrument documentation for parameter definitions." url="https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" /><DatasetCard instrument="MAVEN" title="Mars atmospheric / solar interaction" kind="ORBITAL" detail="Plasma, magnetic field and solar-wind interaction archive." url="https://pds-ppi.igpp.ucla.edu/" /></div>
          <article className="panel"><div className="panel-top"><span>PUBLISHED MEASUREMENTS · CONTEXT ONLY</span><span className="tag orange">NOT A CREW DOSE</span></div>
            <div className="data-line"><span>Earth natural background (world average)</span><b>≈ 2.4 mSv per year · ≈ 0.007 mSv/day</b></div>
            <div className="data-line"><span>Mars surface, galactic cosmic rays</span><b>≈ 0.64 mSv/day</b></div>
            <div className="data-line"><span>Cruise from Earth to Mars</span><b>≈ 1.8 mSv/day</b></div>
            <p className="fineprint">Sources: Curiosity RAD at Gale Crater (Hassler et al., 2014, Science 343); MSL RAD during cruise (Zeitlin et al., 2013, Science 340); UNSCEAR for the Earth average. Values are rounded; check the papers before quoting them. Gale Crater is much lower than Jezero, so the atmosphere overhead differs, and solar particle events can raise dose rates sharply. Do not copy these numbers to another site or use them as a crew dose.</p></article>
          <Notice title="No invented dose estimate">This app does not calculate or certify astronaut dose. Interpretation depends on instrument type, energy spectrum, time, shielding, solar-event context and validated mission dosimetry.</Notice>
        </>}
        {view === "watch" && <>
          <PageHead eyebrow="CREW COMPANION DISPLAY" title="Wrist interface" desc="A responsive wearable-sized preview connected to the mission workspace." />
          <div className="watch-layout"><div className="watch-device"><div className="watch-face"><div className="watch-top"><b>MARSLINE</b><span>SOL 018</span></div><div className="watch-time">{missionTime.slice(0, 5)}</div><small>MISSION UTC+05:30</small><div className="watch-temp"><i className="mini-mars" /><b>ENV DATA</b><small>ARCHIVE BASED</small></div><div className="watch-values"><div><small>O₂</small><b>{resources.oxygenReservePct}%</b></div><div><small>H₂O</small><b>{Math.round(waterPct)}%</b></div><div><small>POWER</small><b>{resources.powerReservePct}%</b></div></div><div className="watch-foot"><i className="pulse" /> MISSION LINK · CONCEPT</div></div></div><article className="panel"><div className="panel-top"><span>WEARABLE DISPLAY</span><span className="tag">PREVIEW</span></div><h2>Mission information at a glance</h2><p className="muted">Compact status for mission time, simulated resources, database connectivity and environmental data availability. This is a web preview, not paired watch hardware.</p><div className="data-line"><span>Mission ID</span><b>{missionCode}</b></div><div className="data-line"><span>Waypoints</span><b>{waypoints.length}</b></div><div className="data-line"><span>MEDA indexes checked</span><b>{medaCount}</b></div><div className="data-line"><span>Firebase status</span><b>{dbReady ? "CONNECTED" : "NOT CONNECTED"}</b></div><button className="button outline" onClick={() => navigate("conditions")}>OPEN CURRENT CONDITIONS</button></article></div>
        </>}
        {view === "communications" && <>
          <PageHead eyebrow="ASTRONAUT COMMUNICATIONS / MISSION RELAY CONCEPT" title="Mission communications" desc="Compose an astronaut-to-Mars Main Station report and save it to the authenticated mission outbox." />
          <div className="simulation-banner">SIMULATED COMMUNICATIONS / FIRESTORE STORAGE ONLY / NO SPACECRAFT RADIO TRANSMISSION</div>
          <div className="log-layout comms-layout">
            <article className="panel">
              <div className="panel-top"><span>COMPOSE OUTGOING MESSAGE</span><span className="tag orange">ASTRONAUT TO MAIN STATION</span></div>
              <form className="form-grid" onSubmit={sendMissionMessage}>
                <label>Sender callsign<input required minLength={2} maxLength={60} value={senderCallsign} onChange={(e) => setSenderCallsign(e.target.value)} placeholder="ASTRONAUT-01" /></label>
                <label>Mission sol<input required type="number" min={0} max={100000} value={messageSol} onChange={(e) => setMessageSol(e.target.value)} /></label>
                <label>Priority<select value={messagePriority} onChange={(e) => setMessagePriority(e.target.value as "ROUTINE" | "PRIORITY" | "URGENT")}><option value="ROUTINE">Routine</option><option value="PRIORITY">Priority</option><option value="URGENT">Urgent</option></select></label>
                <label>Recipient<input value="MARS MAIN STATION" readOnly /></label>
                <label className="wide">Subject<input required minLength={3} maxLength={120} value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} placeholder="Surface conditions report - Jezero Crater" /></label>
                <label className="wide">Message<textarea required minLength={3} maxLength={4000} rows={8} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Report mission status, location, observations, resources, and requested support." /></label>
                <button className="button primary wide" type="submit" disabled={sendingMessage || !dbReady}>{sendingMessage ? "SAVING MESSAGE..." : "SAVE TO MAIN STATION OUTBOX"}</button>
              </form>
              <p className="fineprint">This demonstration saves the message in your workspace (Cloud Firestore, or this browser in demo mode). It does not transmit a signal or make the message visible to a separate station account.</p>
            </article>
            <article className="panel">
              <div className="panel-top"><span>OUTGOING MESSAGE RECORDS</span><span className="tag">{messages.length} STORED</span></div>
              {messages.length === 0 ? <div className="empty-state">No outgoing messages have been saved.</div> : <div className="log-list">{messages.map((message) => <article className="log-entry" key={message.id}>
                <div className="log-entry-head"><b>{message.subject}</b><small>{dateText(message.sentAt)}</small></div>
                <div className="comms-meta"><span className="tag">{message.priority}</span><span className="tag orange">{message.deliveryStatus}</span></div>
                <p>{message.senderCallsign} to {message.recipient} / SOL {message.marsSol}</p>
                <p className="comms-body">{message.messageBody}</p>
              </article>)}</div>}
            </article>
          </div>
          <Notice title="Communications limitation">Messages are stored in the authenticated astronaut workspace for demonstration and testing. Real transmission to Mars Main Station requires a spacecraft communication system, relay network, mission-control endpoint, and a separate authenticated station inbox.</Notice>
        </>}
        {view === "log" && <>
          <PageHead eyebrow="MISSION RECORDS · SCIENCE NOTES" title="Mission log" desc="Save observations, route changes and mission notes in the Cloud Firestore." />
          <div className="log-layout"><article className="panel"><div className="panel-top"><span>CREATE LOG ENTRY</span><span className="tag">FIRESTORE</span></div><form className="form-grid" onSubmit={addLog}>
            <label>Entry type<select value={logType} onChange={(e) => setLogType(e.target.value)}><option value="SCIENCE_OBSERVATION">Science observation</option><option value="ROUTE_UPDATE">Route update</option><option value="ENVIRONMENTAL_NOTE">Environmental note</option><option value="MISSION_STATUS">Mission status</option><option value="RESOURCE_UPDATE">Resource update</option><option value="GENERAL">General</option></select></label>
            <label className="wide">Title<input required maxLength={120} value={logTitle} onChange={(e) => setLogTitle(e.target.value)} placeholder="Observation at delta margin" /></label>
            <label className="wide">Mission note<textarea required rows={5} maxLength={3000} value={logText} onChange={(e) => setLogText(e.target.value)} placeholder="Record observation, instrument, source dataset, sol and location context..." /></label>
            <button className="button primary wide" type="submit">SAVE MISSION ENTRY</button>
          </form></article><article className="panel"><div className="panel-top"><span>CHRONOLOGICAL RECORD</span><span className="tag">{logs.length} ENTRIES</span></div>{logs.length === 0 ? <div className="empty-state">No mission notes have been recorded yet.</div> : <div className="log-list">{logs.map((l) => <div className="log-entry" key={l.id}><div className="log-entry-head"><b>{l.title}</b><small>{dateText(l.occurredAt)}</small></div><span className="tag">{l.logType}</span><p>{l.note}</p></div>)}</div>}</article></div>
        </>}
        {view === "settings" && <>
          <PageHead eyebrow="DATABASE · APPLICATION CONFIGURATION" title="Data & Firebase" desc="Inspect Firebase Authentication, Cloud Firestore collections and NASA data services." />
          <div className="settings-grid"><article className="panel"><div className="panel-top"><span>FIREBASE AUTH + FIRESTORE</span><span className={`tag ${dbReady ? "green" : "orange"}`}>{demo ? "DEMO MODE" : dbReady ? "CONNECTED" : "NOT CONNECTED"}</span></div><h2>{demo ? "Browser demo storage" : "Primary cloud database"}</h2><p className="muted">Cloud Firestore is the primary persistent store. Each authenticated Firebase UID receives a private mission workspace with subcollections for routes, science and operations.</p><div className="status-block"><i className={`connection-dot ${dbReady ? "online" : ""}`} /><div><b>{demo ? "Demo storage active" : dbReady ? "Firebase connected" : "Connection not established"}</b><small>{dbInfo}</small></div></div><div className="data-line"><span>Last health check</span><b>{lastHealth}</b></div><div className="data-line"><span>Workspace initialization</span><b>Automatic on first sign-in</b></div><div className="data-line"><span>Starter dataset catalogue</span><b>Automatic workspace bootstrap</b></div><button type="button" className="button outline full" onClick={() => void checkHealth()} disabled={healthChecking}>{healthChecking ? "CHECKING…" : demo ? "CHECK DEMO STORAGE" : "CHECK FIREBASE CONNECTION"}</button>{!demo && <button type="button" className="button outline full" onClick={() => void switchToDemo()}>USE DEMO MODE (NO FIREBASE)</button>}{demo && <button type="button" className="button outline full" onClick={() => void resetDemo()}>RESET DEMO DATA</button>}<a className="button outline full" href="https://firebase.google.com/docs/firestore" target="_blank" rel="noreferrer">FIREBASE DOCUMENTATION ↗</a></article>
          <article className="panel"><div className="panel-top"><span>NASA SCIENCE SERVICES</span><span className="tag green">PUBLIC SOURCES</span></div><Source name="NASA Mars Trek WMTS" description="Orbital map tiles, metadata and coverage" url="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars" /><Source name="PDS Atmospheres · MEDA" description="Perseverance environmental instrument products" url="https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" /><Source name="NASA Planetary Data System" description="Mission archives and documentation" url="https://pds.nasa.gov/" /><Source name="HiRISE catalogue" description="High-resolution MRO imagery" url="https://www.uahirise.org/" /><Source name="CRISM archive" description="MRO spectral products" url="https://pds-geosciences.wustl.edu/missions/mro/crism.htm" /></article></div>
          <article className="panel schema-panel"><div className="panel-top"><span>FIRESTORE DOCUMENT MODEL</span><span className="tag">COLLECTIONS</span></div><div className="schema-grid">{["users/{uid}", "missions/{missionId}", "waypoints", "logs", "messages", "lifeSupport", "nasaDatasets", "scienceTargets", "dataFetches"].map((collection) => <span key={collection}>{collection}</span>)}</div><p className="muted">Workspace collections are scoped under <code>users/{'{uid}'}/missions/ARES-FS-01</code>, including waypoints, logs, messages, lifeSupport, nasaDatasets and dataFetches.</p></article>
        </>}
        <footer className="footer"><span>MARSLINE · RESEARCH CONCEPT · BUILD 4.0.0</span><span>NASA PDS · MARS TREK · NEXT.JS / FIRESTORE</span></footer>
      </div>
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function PageHead({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc: string; right?: ReactNode }) {
  const parts = title.split(" ");
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{parts[0]} <em>{parts.slice(1).join(" ")}</em></h1><p>{desc}</p></div>{right}</div>;
}
function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{note && <span className="subtle">{note}</span>}</div>;
}
function Metric({ label, value, symbol, note, pct }: { label: string; value: string; symbol: string; note: string; pct: number }) {
  const safe = Math.max(0, Math.min(100, pct));
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><b>{symbol}</b></div><strong>{value}</strong><small>{note}</small><div className="meter"><i style={{ width: `${safe}%` }} /></div></article>;
}
function Watch({ title, desc, button, onClick }: { title: string; desc: string; button: string; onClick: () => void }) {
  return <div className="watch-item"><i className="watch-dot" /><span><b>{title}</b><small>{desc}</small></span><button onClick={onClick}>{button} →</button></div>;
}
function Quick({ title, symbol, onClick }: { title: string; symbol: string; onClick: () => void }) {
  return <button className="quick-tile" onClick={onClick}><b>{symbol}</b><span>{title}</span></button>;
}
function Notice({ title, children }: { title: string; children: ReactNode }) {
  return <div className="notice"><b>{title}</b><p>{children}</p></div>;
}
function DatasetCard({ instrument, title, kind, detail, url }: { instrument: string; title: string; kind: string; detail: string; url: string }) {
  return <article className="dataset-card"><div className="dataset-head"><span className="dataset-code">{instrument}</span><span className="tag">{kind}</span></div><h3>{title}</h3><p>{detail}</p><a href={url} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a></article>;
}
function ResourceField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <label className="field-label">{label}<input type="number" min={0} max={max} step="0.1" required value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}
function Source({ name, description, url }: { name: string; description: string; url: string }) {
  return <div className="source-item"><b>{name}</b><small>{description}</small><a href={url} target="_blank" rel="noreferrer">OPEN ↗</a></div>;
}
