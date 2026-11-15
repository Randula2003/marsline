"use client";
// The LIVE tab of the map dock: simulated scenario, traverse controls, additional routes and the handoff for the next crew member.
import { useState } from "react";
import type { Alternate, Contingency } from "@/lib/contingency";
import type { HandoffRecord } from "@/lib/handoff";
import { trailLengthM, type Scenario } from "@/lib/live";
import type { LiveSession } from "@/lib/use-live-session";

const fmtMin = (min: number) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`; };
const SCENARIOS: { id: Scenario; label: string; hint: string }[] = [
  { id: "clear", label: "CLEAR", hint: "No storm" },
  { id: "approaching", label: "STORM APPROACHING", hint: "Front moves toward the crew" },
  { id: "storm", label: "INSIDE STORM", hint: "Crew is in the dust" }
];
const KIND: Record<Alternate["kind"], string> = { detour: "DETOUR", shelter: "SHELTER", retarget: "NEW TARGET" };

type Props = {
  live: LiveSession; regionId: string | undefined; extentKm: number; hasRoute: boolean; routeLabel: string;
  contingency: Contingency | null; routeThreatened: boolean; avoidCount: number;
  onStart: () => void; onStartFromCrew: () => void; onAccept: (a: Alternate) => void; onClearAvoid: () => void; onMarkHazard: () => void;
  handoffs: HandoffRecord[]; canSave: boolean; onSave: (notes: string) => Promise<void>; onLoad: (h: HandoffRecord) => void;
};

export default function LiveDock({ live, regionId, extentKm, hasRoute, routeLabel, contingency, routeThreatened, avoidCount, onStart, onStartFromCrew, onAccept, onClearAvoid, onMarkHazard, handoffs, canSave, onSave, onLoad }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const c = live.conditions, walking = !!live.traverse;
  const here = live.regionId === regionId;
  const remaining = live.traverse ? live.traverse.timeMin * (1 - live.progress) : 0;

  return <article className="panel lv">
    <div className="panel-top"><span>LIVE MISSION</span><span className="tag orange">SIMULATED</span></div>

    <div className={`lv-level ${c.level}`}><b>{c.headline}</b><small>{c.advice}</small></div>
    <div className="lv-coords"><span>CREW POSITION</span><b>{live.crew.lat.toFixed(5)}°N · {live.crew.lon.toFixed(5)}°E</b>{!here && <small>In another study area. Switch area to see it on the map.</small>}</div>

    <details className="jz-fold" open>
      <summary>CONDITION SCENARIO · SIMULATED</summary>
      <div className="lv-seg">{SCENARIOS.map((s) => <button key={s.id} className={live.scenario === s.id ? "on" : ""} onClick={() => live.setScenario(s.id, extentKm)} title={s.hint}>{s.label}</button>)}</div>
      <p className="fineprint">No live weather feed exists for the Perseverance area. Baseline temperature, pressure and wind come from archived MEDA sample sols. The dust storm is a scenario you switch on to test the alternate routes.</p>
    </details>

    <details className="jz-fold" open>
      <summary>TRAVERSE<small>{walking ? `${Math.round(live.progress * 100)}%` : "STOPPED"}</small></summary>
      {walking ? <>
        <div className="progress-track"><i style={{ width: `${live.progress * 100}%` }} /></div>
        <p className="fineprint">{live.traverse!.fromLabel} → {live.traverse!.toLabel} · {fmtMin(remaining)} left at {live.speed}× simulated speed</p>
        <div className="lv-row">
          <button className="button outline" onClick={() => live.setPaused(!live.paused)}>{live.paused ? "RESUME" : "PAUSE"}</button>
          <button className="button outline" onClick={live.stopTraverse}>STOP &amp; KEEP ROUTE</button>
        </div>
      </> : <>
        <p className="fineprint">{hasRoute ? `Walk the planned route: ${routeLabel}.` : "Plan a route on the ROUTE tab first."}</p>
        <div className="lv-row">
          <button className="button primary" disabled={!hasRoute} onClick={onStart}>START TRAVERSE</button>
          <button className="button outline" disabled={!here} onClick={onStartFromCrew} title="Use the crew position as point A">A = CREW</button>
        </div>
      </>}
      <div className="lv-seg small" aria-label="Simulation speed">{[1, 4, 10].map((s) => <button key={s} className={live.speed === s ? "on" : ""} onClick={() => live.setSpeed(s)}>{s}×</button>)}</div>
    </details>

    <details className="jz-fold" open>
      <summary>ADDITIONAL ROUTES{contingency?.alternates.length ? <small>{contingency.alternates.length}</small> : null}</summary>
      {avoidCount > 0 && <div className="lv-avoid"><span>Route avoids {avoidCount} hazard zone{avoidCount > 1 ? "s" : ""}.</span><button className="button outline" onClick={onClearAvoid}>REMOVE</button></div>}
      {!contingency && <p className="fineprint">Alternates appear when a storm or a hazard marker threatens the route. Try STORM APPROACHING above.</p>}
      {contingency && <>
        {routeThreatened && <p className="jz-verdict warn">The planned route crosses a storm or hazard zone.</p>}
        {contingency.unreachable && <p className="jz-verdict warn">Destination unreachable right now: {contingency.reason}</p>}
        {!routeThreatened && !contingency.unreachable && <p className="jz-verdict">The planned route is clear for now. These are ready if it changes.</p>}
        {contingency.alternates.map((a) => <div className={`lv-alt ${a.kind}`} key={a.kind}>
          <div><span className="tag">{KIND[a.kind]}</span><b>{a.title}</b><small>{(a.route.distM / 1000).toFixed(2)} km · {fmtMin(a.route.timeMin)} · max slope {a.route.maxSlopeDeg.toFixed(0)}°</small></div>
          <button className="button primary" onClick={() => onAccept(a)}>TAKE THIS ROUTE</button>
        </div>)}
        {!contingency.alternates.length && <p className="jz-verdict warn">No route avoids the hazard. Stay in place and call the station.</p>}
      </>}
      <button className="button outline full" disabled={!here} onClick={onMarkHazard}>MARK HAZARD AT CREW POSITION</button>
    </details>

    <details className="jz-fold" open>
      <summary>SAVE FOR THE NEXT CREW MEMBER<small>{live.trail.length} POINTS</small></summary>
      <p className="fineprint">Saves the route walked ({(trailLengthM(live.trail) / 1000).toFixed(2)} km), the planned and alternate routes, the hazards and the surface conditions. A record is also saved automatically when a traverse ends.</p>
      <textarea rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the next person: surface, hazards, what to avoid…" />
      <div className="lv-row">
        <button className="button primary" disabled={!canSave || saving || live.trail.length < 2} onClick={async () => { setSaving(true); try { await onSave(notes); setNotes(""); } finally { setSaving(false); } }}>{saving ? "SAVING…" : "SAVE ROUTE & SURFACE"}</button>
        <button className="button outline" disabled={!live.trail.length || walking} onClick={live.clearTrail}>CLEAR TRAIL</button>
      </div>
      {live.inherited && <div className="lv-inherit"><b>Loaded: {live.inherited.title}</b><small>by {live.inherited.callsign} · {new Date(live.inherited.savedAt).toLocaleString("en-GB")}</small>{live.inherited.notes && <p>{live.inherited.notes}</p>}<button className="button outline" onClick={() => live.inherit(null)}>UNLOAD</button></div>}
      <div className="jz-group">PREVIOUS HANDOFFS · {handoffs.length}</div>
      {handoffs.length === 0 && <p className="fineprint">None saved yet.</p>}
      {handoffs.slice(0, 6).map((h) => <div className="lv-hand" key={h.id}>
        <div><b>{h.title}</b><small>{h.callsign} · {(h.distanceTraveledM / 1000).toFixed(2)} km · {h.conditions.level} · {new Date(h.savedAt).toLocaleString("en-GB")}</small></div>
        <button className="button outline" onClick={() => onLoad(h)}>LOAD</button>
      </div>)}
    </details>
  </article>;
}
