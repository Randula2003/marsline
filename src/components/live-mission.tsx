"use client";
// Tablet-first mission screen: large status, crew position, conditions and the live feed above the satellite map.
import type { ReactNode } from "react";
import { trailLengthM } from "@/lib/live";
import type { LiveSession } from "@/lib/use-live-session";

const hhmm = (h: number) => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

export default function LiveMission({ live, callsign, children }: { live: LiveSession; callsign: string; children: ReactNode }) {
  const c = live.conditions, walking = !!live.traverse;
  return <div className="lm">
    <div className={`lm-banner ${c.level}`} role="status" aria-live="polite">
      <div><span className="overline">{c.level} · LIVE CONDITIONS</span><h2>{c.headline}</h2><p>{c.advice}</p></div>
      <div className="lm-clock"><small>LOCAL SOLAR TIME</small><b>{hhmm(live.localHour)}</b><small>{c.daylight ? "DAYLIGHT" : "NIGHT"}</small></div>
    </div>

    <div className="lm-grid">
      <article className="panel lm-card">
        <div className="panel-top"><span>CREW POSITION</span><span className="tag green">{callsign}</span></div>
        <div className="lm-coord"><small>LATITUDE</small><b>{live.crew.lat.toFixed(5)}° N</b></div>
        <div className="lm-coord"><small>LONGITUDE</small><b>{live.crew.lon.toFixed(5)}° E</b></div>
        <div className="data-line"><span>Study area</span><b>{live.regionId}</b></div>
        <div className="data-line"><span>Status</span><b>{walking ? `WALKING · ${Math.round(live.progress * 100)}%` : "STOPPED"}</b></div>
        <div className="data-line"><span>Route walked</span><b>{(trailLengthM(live.trail) / 1000).toFixed(2)} km</b></div>
        <p className="fineprint">Simulated position along the planned route. A tablet cannot receive GPS on Mars; a real system would use rover or beacon fixes.</p>
      </article>

      <article className="panel lm-card">
        <div className="panel-top"><span>WEATHER AT CREW</span><span className="tag orange">SIM STORM + MEDA BASELINE</span></div>
        <div className="lm-stats">
          <div><small>AIR TEMP</small><b>{c.tempC.toFixed(0)} °C</b></div>
          <div><small>WIND / GUST</small><b>{c.windMs.toFixed(0)} / {c.gustMs.toFixed(0)} m/s</b></div>
          <div><small>PRESSURE</small><b>{c.pressurePa.toFixed(0)} Pa</b></div>
          <div><small>DUST OPACITY</small><b>τ {c.dustTau.toFixed(1)}</b></div>
          <div><small>VISIBILITY</small><b>~{c.visibilityKm.toFixed(1)} km</b></div>
          <div><small>STORM EDGE</small><b>{c.stormEdgeKm === null ? "none" : c.stormEdgeKm <= 0 ? "inside" : `${c.stormEdgeKm.toFixed(1)} km`}</b></div>
        </div>
        <p className="fineprint">{c.stormEtaMin !== null ? `Storm edge reaches the crew in about ${c.stormEtaMin} min at this speed. ` : ""}Baseline from archived Perseverance MEDA sample sol data; the dust storm is a simulated scenario. There is no live weather feed for this site.</p>
      </article>

      <article className="panel lm-card lm-feed">
        <div className="panel-top"><span>LIVE MISSION FEED</span><span className="tag">{live.feed.length} EVENTS</span></div>
        {live.feed.length === 0 ? <div className="empty-state">No events yet. Start a traverse or switch a scenario on the LIVE tab.</div> : <ul>{live.feed.slice(0, 8).map((f) => <li key={f.id} className={f.kind}><time>{f.at}</time><span>{f.text}</span></li>)}</ul>}
      </article>
    </div>

    <div className="section-heading"><div><span className="eyebrow">SATELLITE VIEW</span><h2>Orbital imagery, crew position and dust cloud</h2></div><span className="subtle">CTX imagery · simulated dust cloud and routes</span></div>
    {children}
  </div>;
}
