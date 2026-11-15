"use client";
// One live mission session for the whole console: a simulated clock, the crew's position along the route being walked, the trail
// they leave, a simulated dust storm and the conditions that follow from it. It lives in the console (not in the map) so a traverse
// keeps running, and the trail keeps recording, while the user looks at other pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendTrail, bearingDeg, conditionsFor, edgeDistanceM, makeStorm, marsLocalHour, pointAlong, stormZone, thin, trailLengthM,
  type Conditions, type LonLat, type MedaSol, type Scenario, type Storm, type StormZone, type TrailPoint
} from "@/lib/live";

export const DRAFT_KEY = "marsline-live-draft";
const JEZERO_BASE: LonLat = { lat: 18.4663, lon: 77.42984 };
const JEZERO_EXTENT_KM = 57;

export type TraversePlan = { points: LonLat[]; timeMin: number; distM: number; fromLabel: string; toLabel: string; regionId: string };
export type FeedItem = { id: number; at: string; kind: "info" | "ok" | "warn" | "alert"; text: string };
export type EndReason = "manual" | "arrived" | "stopped";
export type HandoffDraft = {
  reason: EndReason; regionId: string; fromLabel: string; toLabel: string; plan: LonLat[]; alternate: { label: string; points: LonLat[] } | null;
  trail: TrailPoint[]; lastPosition: LonLat; conditions: Conditions; scenario: Scenario; zone: StormZone | null; distanceTraveledM: number;
};
/** A saved handoff the current crew member has loaded: its trail, hazards and last position are shown on the map. */
export type Inherited = {
  key: string; title: string; callsign: string; savedAt: string; notes: string; regionId: string;
  start: (LonLat & { label: string }) | null; end: (LonLat & { label: string }) | null;
  plannedRoute: LonLat[]; alternate: { label: string; points: LonLat[] } | null; trail: LonLat[];
  hazards: (LonLat & { label: string; radiusM: number })[]; storm: (LonLat & { radiusM: number }) | null; lastPosition: LonLat; headline: string;
};

const clock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

export function useLiveSession(options: { onEnd?: (draft: HandoffDraft) => void } = {}) {
  const [sols, setSols] = useState<MedaSol[] | null>(null);
  const [simMin, setSimMin] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenarioState] = useState<Scenario>("clear");
  const [storm, setStorm] = useState<Storm | null>(null);
  const [extentKm, setExtentKm] = useState(JEZERO_EXTENT_KM);
  const [crewPos, setCrewPos] = useState<{ point: LonLat; regionId: string }>({ point: JEZERO_BASE, regionId: "jezero" });
  const [traverse, setTraverse] = useState<(TraversePlan & { startedMin: number }) | null>(null);
  const [lastPlan, setLastPlan] = useState<TraversePlan | null>(null);
  const [alternate, setAlternate] = useState<{ label: string; points: LonLat[] } | null>(null);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [inherited, setInherited] = useState<Inherited | null>(null);
  const feedId = useRef(0), onEnd = useRef(options.onEnd), simRef = useRef(0), trailRef = useRef<TrailPoint[]>([]), prevLevel = useRef("NOMINAL");
  useEffect(() => { onEnd.current = options.onEnd; });
  useEffect(() => { simRef.current = simMin; }, [simMin]);
  useEffect(() => { trailRef.current = trail; }, [trail]);

  const addFeed = useCallback((kind: FeedItem["kind"], text: string) => setFeed((old) => [{ id: ++feedId.current, at: clock(), kind, text }, ...old].slice(0, 40)), []);

  // MEDA sample sols give the real baseline for temperature, pressure and wind.
  useEffect(() => {
    let alive = true;
    fetch("/data/regions/jezero/meda_timeseries.json").then((r) => (r.ok ? r.json() : null)).then((d: { sols?: MedaSol[] } | null) => { if (alive && d?.sols?.length) setSols(d.sols); }).catch(() => { /* conditions fall back to typical values */ });
    return () => { alive = false; };
  }, []);

  // The clock.
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => { setNowMs(Date.now()); setSimMin((m) => m + speed); }, 1000);
    return () => window.clearInterval(id);
  }, [paused, speed]);

  // Restore the last trail after a reload (the traverse itself is not resumed).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY); if (!raw) return;
        const d = JSON.parse(raw) as { trail?: TrailPoint[]; point?: LonLat; regionId?: string };
        if (Array.isArray(d.trail) && d.trail.length) setTrail(d.trail.slice(-600));
        if (d.point && typeof d.regionId === "string") setCrewPos({ point: d.point, regionId: d.regionId });
      } catch { /* ignore a corrupt draft */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const progress = traverse ? Math.min(1, Math.max(0, (simMin - traverse.startedMin) / Math.max(traverse.timeMin, 0.01))) : 0;
  const crew = useMemo<LonLat>(() => (traverse ? pointAlong(traverse.points, progress).point : crewPos.point), [traverse, progress, crewPos]);
  const regionId = traverse?.regionId ?? crewPos.regionId;
  const zone = useMemo(() => stormZone(storm, simMin), [storm, simMin]);
  const edgeM = zone ? edgeDistanceM(crew, zone) : null;
  const localHour = nowMs ? marsLocalHour(new Date(nowMs), crew.lon) : 12;
  const sol = useMemo(() => sols?.find((s) => s.hours.some((h) => h.windMs !== undefined)) ?? sols?.[0] ?? null, [sols]);
  // A storm is "departing" when it is moving away from the crew (its heading points more than 90 degrees from the direction of the crew).
  const departing = !!(zone && storm && Math.abs(((storm.headingDeg - bearingDeg(zone, crew) + 540) % 360) - 180) > 90);
  const hourKey = Math.round(localHour * 4) / 4, edgeKey = edgeM === null ? null : Math.round(edgeM / 100);
  const conditions = useMemo<Conditions>(() => conditionsFor({ sol, localHour: hourKey, stormEdgeM: edgeKey === null ? null : edgeKey * 100, stormSpeedKmh: storm?.speedKmh, departing }), [sol, hourKey, edgeKey, storm, departing]);

  const draft = useCallback((reason: EndReason, over?: { trail?: TrailPoint[]; lastPosition?: LonLat }): HandoffDraft => {
    const plan = traverse ?? lastPlan, t = over?.trail ?? trail;
    return {
      reason, regionId, fromLabel: plan?.fromLabel ?? "Crew position", toLabel: plan?.toLabel ?? "—", plan: thin(plan?.points ?? [], 400), alternate: alternate ? { label: alternate.label, points: thin(alternate.points, 400) } : null,
      trail: thin(t, 600), lastPosition: over?.lastPosition ?? crew, conditions, scenario, zone, distanceTraveledM: trailLengthM(t)
    };
  }, [traverse, lastPlan, trail, alternate, regionId, crew, conditions, scenario, zone]);

  // Record the trail while walking; stop at the destination.
  useEffect(() => {
    if (!traverse) return;
    const p = { ...crew, t: simRef.current };
    setTrail((old) => appendTrail(old, p));
  }, [crew, traverse]);
  useEffect(() => {
    if (!traverse || progress < 1) return;
    const end = traverse.points[traverse.points.length - 1], finalTrail = appendTrail(trailRef.current, { ...end, t: simRef.current }, 1);
    setTrail(finalTrail); setCrewPos({ point: end, regionId: traverse.regionId }); setLastPlan(traverse); setTraverse(null);
    addFeed("ok", `Arrived at ${traverse.toLabel}. Route recorded (${(trailLengthM(finalTrail) / 1000).toFixed(2)} km).`);
    onEnd.current?.({ ...draft("arrived", { trail: finalTrail, lastPosition: end }), plan: thin(traverse.points, 400) });
  }, [traverse, progress, draft, addFeed]);

  // Keep the trail and position across reloads.
  useEffect(() => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ trail: trail.slice(-600), point: crew, regionId })); } catch { /* storage blocked */ }
  }, [trail, crew, regionId]);

  // Live feed: say so when conditions change level.
  useEffect(() => {
    if (conditions.level === prevLevel.current) return;
    const kind = conditions.level === "NOMINAL" ? "ok" : conditions.level === "ADVISORY" ? "info" : conditions.level === "WARNING" ? "warn" : "alert";
    addFeed(kind, `${conditions.headline}${conditions.stormEtaMin !== null ? ` (edge in about ${conditions.stormEtaMin} min)` : ""}.`);
    prevLevel.current = conditions.level;
  }, [conditions, addFeed]);

  const setScenario = useCallback((s: Scenario, extent?: number) => {
    const ext = extent ?? extentKm; setExtentKm(ext); setScenarioState(s); setStorm(makeStorm(s, crew, ext, simRef.current));
    addFeed(s === "clear" ? "ok" : "warn", s === "clear" ? "Scenario cleared: no storm." : s === "approaching" ? "SIMULATED: a dust front has formed to the north-west and is moving toward the crew." : "SIMULATED: the crew is inside a dust storm.");
  }, [crew, extentKm, addFeed]);
  const startTraverse = useCallback((plan: TraversePlan) => {
    const first = plan.points[0];
    setTraverse({ ...plan, startedMin: simRef.current }); setLastPlan(plan); setAlternate(null); setTrail([{ ...first, t: simRef.current }]); setPaused(false);
    addFeed("info", `Traverse started: ${plan.fromLabel} to ${plan.toLabel}, ${(plan.distM / 1000).toFixed(2)} km, about ${Math.round(plan.timeMin)} min.`);
  }, [addFeed]);
  const replaceTraverse = useCallback((plan: TraversePlan, why: string) => {
    setTraverse({ ...plan, startedMin: simRef.current }); setLastPlan(plan); addFeed("warn", why);
  }, [addFeed]);
  const stopTraverse = useCallback(() => {
    if (!traverse) return;
    const final = appendTrail(trail, { ...crew, t: simRef.current }, 1);
    setTrail(final); setCrewPos({ point: crew, regionId: traverse.regionId }); setLastPlan(traverse); setTraverse(null);
    addFeed("info", "Traverse stopped. Route walked so far is kept.");
    onEnd.current?.({ ...draft("stopped", { trail: final, lastPosition: crew }), plan: thin(traverse.points, 400) });
  }, [traverse, trail, crew, draft, addFeed]);
  const placeCrew = useCallback((point: LonLat, region: string) => { if (!traverse) { setCrewPos({ point, regionId: region }); addFeed("info", `Crew position set to ${point.lat.toFixed(4)}°N, ${point.lon.toFixed(4)}°E.`); } }, [traverse, addFeed]);
  const clearTrail = useCallback(() => { setTrail([]); try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } addFeed("info", "Recorded trail cleared."); }, [addFeed]);
  const inherit = useCallback((h: Inherited | null) => {
    setInherited(h);
    if (h) { setCrewPos({ point: h.lastPosition, regionId: h.regionId }); setTraverse(null); addFeed("info", `Loaded handoff "${h.title}" from ${h.callsign}. Their route, hazards and last position are on the map.`); }
  }, [addFeed]);

  return {
    simMin, nowMs, paused, setPaused, speed, setSpeed, scenario, setScenario, storm, zone, extentKm, conditions, localHour, crew, regionId, traverse, progress, lastPlan, trail, feed, inherited,
    alternate, setAlternate, addFeed, startTraverse, replaceTraverse, stopTraverse, placeCrew, clearTrail, inherit, draft
  };
}
export type LiveSession = ReturnType<typeof useLiveSession>;
