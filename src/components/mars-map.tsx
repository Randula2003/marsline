"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import NextImage from "next/image";
import EvaWindow from "@/components/eva-window";
import ValidationPanel from "@/components/validation-panel";
import LiveDock from "@/components/live-dock";
import { planContingency, type Alternate, type Contingency, type Place } from "@/lib/contingency";
import type { HandoffRecord } from "@/lib/handoff";
import { remainingRoute, routeHits } from "@/lib/live";
import type { Inherited, LiveSession } from "@/lib/use-live-session";
import { toInherited } from "@/lib/handoff";
import { WALK_SPEED_KMH, type AvoidZone, cellOf, loadRegions, loadTerrain, loadVectors, planRoute, probe, type Probe, type RegionInfo, type Route, type Terrain, type Vectors } from "@/lib/terrain";

type Waypoint = { id: string; name: string; type: string; latitudeDeg: number | string; longitudeDeg: number | string };
type Pt = { key: string; label: string; lat: number; lon: number; kind: "base" | "target" | "waypoint" | "custom"; detail?: string; science?: number; thumb?: string };
export type RouteSave = { start: Pt; end: Pt; route: Route };
type Props = {
  waypoints: Waypoint[]; onSaveRoute?: (save: RouteSave) => Promise<void>;
  live: LiveSession; handoffs: HandoffRecord[]; canSaveHandoff: boolean; initialDock?: DockTab;
  onSaveHandoff: (notes: string) => Promise<void>; onMarkHazard: (lat: number, lon: number) => void;
};

const VECTOR_LAYERS = [
  { id: "geology", title: "Geologic units", note: "USGS SIM 3464 · hover for unit" },
  { id: "linear", title: "Ridges, rims, delta fronts", note: "USGS linear features" },
  { id: "craters", title: "Small craters", note: "USGS location features" },
  { id: "ellipse", title: "Landing ellipse", note: "Perseverance 2021 target" }
];
const SMOOTH_OFF = ["traversability", "science", "slope"];
const fmtTime = (min: number) => { const m = Math.round(min); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`; };   // round first so 119.6 min is "2 h 00 min", never "1 h 60 min"
const DEFAULT_EVA_H = 8, DEFAULT_SPEED_KMH = WALK_SPEED_KMH; // ASSUMPTIONS the user can adjust in the route panel
export type DockTab = "layers" | "route" | "live" | "checks";
const DOCK_TABS: { id: DockTab; label: string }[] = [{ id: "layers", label: "LAYERS" }, { id: "route", label: "ROUTE" }, { id: "live", label: "LIVE" }, { id: "checks", label: "CHECKS" }];
const handoffStart = (h: Inherited): Pt => ({ key: "custom-start", label: `Last position of ${h.callsign}`, lat: h.lastPosition.lat, lon: h.lastPosition.lon, kind: "custom" });
const handoffEnd = (h: Inherited): Pt => ({ key: "custom-end", label: h.end?.label ?? "Destination", lat: h.end?.lat ?? h.lastPosition.lat, lon: h.end?.lon ?? h.lastPosition.lon, kind: "custom" });
const shortLabel = (label: string) => (label.startsWith("Saved · ") ? label.slice(8) : label.split(" · ")[0]);   // "T1 · Delta" -> "T1", "Saved · Camp" -> "Camp"
const HAZARD_RADIUS_M = 300;          // keep-out radius around a HAZARD waypoint
const STORM_BUFFER_M = 1500;          // extra margin around the simulated storm when planning around it
const CLASS_NAME = ["No-go", "Caution", "Nominal"];

function LayerToggle({ title, detail, note, checked, onChange }: { title: string; detail: string; note?: string; checked: boolean; onChange: () => void }) {
  return <label className="jz-layer"><input type="checkbox" checked={checked} onChange={onChange} /><span><b>{title}</b><small>{detail}</small>{note && <small className="jz-note">{note}</small>}</span></label>;
}

export default function MarsMap({ waypoints, onSaveRoute, live, handoffs, canSaveHandoff, initialDock, onSaveHandoff, onMarkHazard }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [vectors, setVectors] = useState<Vectors | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Record<string, boolean>>({ ctx: true, traversability: true, linear: true, ellipse: true });
  const [opacity, setOpacity] = useState(0.7);
  const [blockOverride, setBlockOverride] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState(DEFAULT_SPEED_KMH);
  const [evaLimitH, setEvaLimitH] = useState(DEFAULT_EVA_H);
  const [start, setStart] = useState<Pt | null>(null);
  const [end, setEnd] = useState<Pt | null>(null);
  const [pickMode, setPickMode] = useState<"start" | "end" | null>(null);
  const [hover, setHover] = useState<(Probe & { unit?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [imagesReady, setImagesReady] = useState(0);
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [regionId, setRegionId] = useState("jezero");
  const [dock, setDock] = useState<DockTab>(initialDock ?? "layers");
  const inheritedRef = useRef<Inherited | null>(null);
  useEffect(() => { inheritedRef.current = live.inherited; });
  const [avoidFrozen, setAvoidFrozen] = useState<AvoidZone[]>([]);      // zones the accepted route keeps out of (frozen when the route was taken)
  const [contingency, setContingency] = useState<Contingency | null>(null);

  const view = useRef({ x: 0, y: 0, z: 1 });
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const images = useRef(new Map<string, HTMLImageElement>());
  const drawRef = useRef<() => void>(() => {});
  const frame = useRef(0);
  const fitted = useRef(false);
  const touched = useRef(false);                 // true once the user has panned or zoomed: then resizes no longer refit the view
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0 });
  const lastCell = useRef("");
  const schedule = useCallback(() => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => drawRef.current()); }, []);

  // ---- data loading -----------------------------------------------------------------------------------------------
  useEffect(() => { loadRegions().then(setRegions).catch(() => setRegions([])); }, []);
  useEffect(() => {
    let alive = true;
    loadTerrain(regionId).then(async (t) => {
      const v = await loadVectors(t);
      if (!alive) return;
      images.current.clear(); fitted.current = false;
      setError(""); setTerrain(t); setVectors(v);
      setActive(Object.fromEntries(t.meta.defaultLayers.map((id) => [id, true])));
      const h = inheritedRef.current?.regionId === t.meta.id ? inheritedRef.current : null;
      setStart(h ? handoffStart(h) : { key: "base", label: t.meta.start.name, lat: t.meta.start.lat, lon: t.meta.start.lon, kind: "base" });
      const first = t.meta.targets[0];
      if (h?.end) setEnd(handoffEnd(h)); else setEnd(first ? { key: first.id, label: `${first.id} · ${first.name}`, lat: first.lat, lon: first.lon, kind: "target", detail: first.reason, science: first.science, thumb: first.thumb } : null);
    }).catch((e) => alive && setError(e instanceof Error ? e.message : "Unable to load map layers"));
    return () => { alive = false; };
  }, [regionId]);
  const selectRegion = (id: string) => {
    if (id === regionId) return;
    setTerrain(null); setVectors(null); setStart(null); setEnd(null); setHover(null); setPickMode(null); setBlockOverride(null); setAvoidFrozen([]); setContingency(null); setRegionId(id);
  };

  useEffect(() => {
    if (!terrain) return;
    for (const L of terrain.meta.layers) {
      if (!active[L.id] || !/\.(png|jpg)$/.test(L.file) || images.current.has(L.id)) continue;
      const img = new Image();
      images.current.set(L.id, img);
      img.onload = () => setImagesReady((n) => n + 1);
      img.src = `${terrain.base}/${L.file}`;
    }
  }, [terrain, active]);

  // ---- points & route ---------------------------------------------------------------------------------------------
  const points = useMemo<Pt[]>(() => {
    if (!terrain) return [];
    const m = terrain.meta;
    const list: Pt[] = [{ key: "base", label: m.start.name, lat: m.start.lat, lon: m.start.lon, kind: "base" }];
    m.targets.forEach((t) => list.push({ key: t.id, label: `${t.id} · ${t.name}`, lat: t.lat, lon: t.lon, kind: "target", detail: t.reason, science: t.science, thumb: t.thumb }));
    waypoints.forEach((w) => {
      const lat = Number(w.latitudeDeg), lon = Number(w.longitudeDeg);
      const [gx, gy] = cellOf(terrain, lon, lat);
      if (Number.isFinite(lat) && Number.isFinite(lon) && gx >= 0 && gy >= 0 && gx < terrain.w && gy < terrain.h) list.push({ key: `wp-${w.id}`, label: `Saved · ${w.name}`, lat, lon, kind: "waypoint" });
    });
    return list;
  }, [terrain, waypoints]);

  const bakedBlock = terrain?.meta.thresholds.slopeBlockDeg ?? 25;
  const blockSlope = Math.min(blockOverride ?? bakedBlock, bakedBlock);
  const routeResult = useMemo(() => (terrain && start && end && (start.lat !== end.lat || start.lon !== end.lon) ? planRoute(terrain, start, end, { blockSlopeDeg: blockSlope, speedKmh, avoid: avoidFrozen.length ? avoidFrozen : undefined }) : null), [terrain, start, end, blockSlope, speedKmh, avoidFrozen]);
  // cells that are walkable in the pre-computed map but exceed a stricter no-go slope chosen by the user
  const stricter = useMemo(() => {
    if (!terrain || typeof document === "undefined" || blockSlope >= bakedBlock) return null;
    const c = document.createElement("canvas"); c.width = terrain.w; c.height = terrain.h;
    const g = c.getContext("2d"); if (!g) return null;
    const img = g.createImageData(terrain.w, terrain.h), q = blockSlope * 4;
    for (let i = 0; i < terrain.w * terrain.h; i++) if (terrain.cls[i] !== 0 && terrain.cls[i] !== 255 && terrain.slope[i] >= q) { img.data[i * 4] = 220; img.data[i * 4 + 1] = 38; img.data[i * 4 + 2] = 38; img.data[i * 4 + 3] = 170; }
    g.putImageData(img, 0, 0); return c;
  }, [terrain, blockSlope, bakedBlock]);
  const route: Route | null = routeResult && !("error" in routeResult) ? routeResult : null;
  const routeError = routeResult && "error" in routeResult ? routeResult.error : "";
  // The planner snaps A and B to the nearest walkable cell; say so when that moved a point by more than two cells.
  const snapNote = (() => {
    if (!route) return "";
    const limit = 2 * (terrain?.meta.grid.stepM ?? 75), km = (m: number) => `${(m / 1000).toFixed(2)} km`;
    const moved = [route.snapStartM > limit && `Start (A) was moved ${km(route.snapStartM)}`, route.snapEndM > limit && `Destination (B) was moved ${km(route.snapEndM)}`].filter(Boolean);
    return moved.length ? `${moved.join(" and ")} to the nearest walkable ground because the chosen point is on no-go or unmapped terrain. The route and its distances start and end there.` : "";
  })();

  // ---- live mission: hazards, storm, alternate routes ---------------------------------------------------------------------
  const liveHere = !!terrain && live.regionId === terrain.meta.id;
  const inheritedHere = live.inherited && live.inherited.regionId === regionId ? live.inherited : null;
  const hazardZones = useMemo<AvoidZone[]>(() => [
    ...waypoints.filter((w) => w.type === "HAZARD").map((w) => ({ lat: Number(w.latitudeDeg), lon: Number(w.longitudeDeg), radiusM: HAZARD_RADIUS_M })),
    ...(inheritedHere ? inheritedHere.hazards.map((h) => ({ lat: h.lat, lon: h.lon, radiusM: h.radiusM })) : [])
  ].filter((z) => Number.isFinite(z.lat) && Number.isFinite(z.lon)), [waypoints, inheritedHere]);
  const stormHere = liveHere ? live.zone : null;
  const zonesNow = useMemo<AvoidZone[]>(() => [...(stormHere ? [{ lat: stormHere.lat, lon: stormHere.lon, radiusM: stormHere.radiusM + STORM_BUFFER_M }] : []), ...hazardZones], [stormHere, hazardZones]);
  const walkingHere = !!live.traverse && liveHere;
  const ahead = useMemo(() => (walkingHere && live.traverse ? remainingRoute(live.traverse.points, live.progress) : route?.points ?? []), [walkingHere, live.traverse, live.progress, route]);
  const routeThreatened = zonesNow.length > 0 && routeHits(ahead, zonesNow, 0).hit;
  const shelters = useMemo<Place[]>(() => points.filter((p) => p.kind === "base" || (p.kind === "waypoint" && waypoints.some((w) => `wp-${w.id}` === p.key && w.type === "HABITAT"))).map((p) => ({ lat: p.lat, lon: p.lon, label: p.label.replace("Saved · ", "") })), [points, waypoints]);
  const latest = useRef({ terrain, end, start, zonesNow, shelters, points, blockSlope, speedKmh, walkingHere, crew: live.crew });
  useEffect(() => { latest.current = { terrain, end, start, zonesNow, shelters, points, blockSlope, speedKmh, walkingHere, crew: live.crew }; });
  // Plan the extra routes every few real seconds while a storm or hazard is on the map (not on every frame: each plan is an A* search).
  const planKey = `${terrain?.meta.id}|${end?.key}|${start?.key}|${zonesNow.length}|${Math.floor(live.nowMs / 4000)}|${blockSlope}|${speedKmh}|${walkingHere}`;
  const { setAlternate } = live;
  useEffect(() => {
    const L = latest.current;
    if (!L.terrain || !L.end || L.zonesNow.length === 0) { setContingency(null); return; }
    const from = L.walkingHere ? L.crew : L.start ?? L.crew;
    const result = planContingency({
      terrain: L.terrain, from, dest: { lat: L.end.lat, lon: L.end.lon, label: shortLabel(L.end.label) }, zones: L.zonesNow, shelters: L.shelters,
      targets: L.points.filter((p) => p.kind === "target").map((p) => ({ lat: p.lat, lon: p.lon, label: shortLabel(p.label) })), blockSlopeDeg: L.blockSlope, speedKmh: L.speedKmh
    });
    setContingency(result);
    const first = result.alternates[0];
    setAlternate(first ? { label: first.title, points: first.route.points } : null);
  }, [planKey, setAlternate]);

  const acceptAlternate = (a: Alternate) => {
    if (!terrain) return;
    const destPt = points.find((p) => Math.abs(p.lat - a.to.lat) < 1e-6 && Math.abs(p.lon - a.to.lon) < 1e-6) ?? { key: "custom-end", label: a.to.label, lat: a.to.lat, lon: a.to.lon, kind: "custom" as const };
    setAvoidFrozen(zonesNow); setEnd(destPt);
    if (walkingHere) {
      setStart({ key: "custom-start", label: "Crew position", lat: live.crew.lat, lon: live.crew.lon, kind: "custom" });
      live.replaceTraverse({ points: a.route.points, timeMin: a.route.timeMin, distM: a.route.distM, fromLabel: "Crew position", toLabel: a.to.label, regionId: terrain.meta.id }, `Route changed: ${a.title} (${(a.route.distM / 1000).toFixed(2)} km, about ${Math.round(a.route.timeMin)} min).`);
    } else live.addFeed("warn", `Route changed: ${a.title}.`);
    live.setAlternate({ label: a.title, points: a.route.points });
  };
  const startTraverse = () => {
    if (!route || !terrain || !start || !end) return;
    live.startTraverse({ points: route.points, timeMin: route.timeMin, distM: route.distM, fromLabel: shortLabel(start.label), toLabel: shortLabel(end.label), regionId: terrain.meta.id });
  };
  // Bring a loaded handoff onto the map: the last position becomes A and the earlier destination becomes B.
  const loadHandoff = (record: HandoffRecord) => {
    const h = toInherited(record);
    live.inherit(h); setDock("live");
    if (h.regionId !== regionId) selectRegion(h.regionId);      // the new area applies it when it finishes loading
    else { setStart(handoffStart(h)); if (h.end) setEnd(handoffEnd(h)); }
  };

  // ---- drawing ----------------------------------------------------------------------------------------------------
  useEffect(() => {
    drawRef.current = () => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx || !terrain) return;
      const { w: cw, h: ch, dpr } = size.current;
      const { x: ox, y: oy, z } = view.current;
      const { west, north, meta } = terrain;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0c1117"; ctx.fillRect(0, 0, cw, ch);

      ctx.save(); ctx.translate(-ox * z, -oy * z); ctx.scale(z, z);
      for (const L of meta.layers) {
        const img = images.current.get(L.id);
        if (!active[L.id] || !img?.complete || !img.naturalWidth || !L.bounds) continue;
        const [s, w, n, e] = L.bounds;
        ctx.globalAlpha = L.base ? 1 : opacity;
        ctx.imageSmoothingEnabled = !SMOOTH_OFF.includes(L.id);
        ctx.drawImage(img, (w - west) / meta.grid.dlon, (north - n) / meta.grid.dlat, (e - w) / meta.grid.dlon, (n - s) / meta.grid.dlat);
      }
      if (vectors) {
        if (active.geology) for (const u of vectors.units) {
          ctx.globalAlpha = 0.38; ctx.fillStyle = u.color; ctx.fill(u.path, "evenodd");
          ctx.globalAlpha = 0.4; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.7 / z; ctx.stroke(u.path);
        }
        if (active.linear) for (const l of vectors.lines) { ctx.globalAlpha = 0.95; ctx.strokeStyle = l.color; ctx.lineWidth = 1.5 / z; ctx.stroke(l.path); }
        if (active.craters) {
          ctx.globalAlpha = 0.9; ctx.strokeStyle = "#f5f5f5"; ctx.lineWidth = 1 / z; ctx.beginPath();
          for (const [x, y] of vectors.craters) { ctx.moveTo(x + 3 / z, y); ctx.arc(x, y, 3 / z, 0, Math.PI * 2); }
          ctx.stroke();
        }
        if (active.ellipse) { ctx.globalAlpha = 1; ctx.setLineDash([6 / z, 4 / z]); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.6 / z; ctx.stroke(vectors.ellipse); ctx.setLineDash([]); }
      }
      if (stricter) { ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; ctx.drawImage(stricter, 0, 0, terrain.w, terrain.h); }
      ctx.restore(); ctx.globalAlpha = 1;

      const sx = (lon: number, lat: number): [number, number] => { const [gx, gy] = cellOf(terrain, lon, lat); return [(gx - ox) * z, (gy - oy) * z]; };
      if (start && end) { // straight line for comparison
        const [x1, y1] = sx(start.lon, start.lat), [x2, y2] = sx(end.lon, end.lat);
        ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (route) {
        ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath();
        route.points.forEach((p, i) => { const [x, y] = sx(p.lon, p.lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.font = "600 10px 'DM Mono', monospace"; ctx.textBaseline = "middle";
      const label = (text: string, x: number, y: number) => { ctx.lineWidth = 3; ctx.strokeStyle = "rgba(8,10,14,.9)"; ctx.strokeText(text, x, y); ctx.fillStyle = "#fff"; ctx.fillText(text, x, y); };
      // live mission overlays: hazards, storm (simulated dust cloud), earlier crew trail, alternate routes, this crew's trail
      const zr = (m: number) => (m / terrain.dxM) * z;
      const line = (pts: { lon: number; lat: number }[], color: string, width: number, dash: number[] = []) => {
        if (pts.length < 2) return;
        ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.setLineDash(dash); ctx.beginPath();
        pts.forEach((q, i) => { const [x, y] = sx(q.lon, q.lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = width + 3; ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
      };
      for (const hz of hazardZones) {
        const [x, y] = sx(hz.lon, hz.lat), r = Math.max(5, zr(hz.radiusM));
        ctx.fillStyle = "rgba(220,38,38,.22)"; ctx.strokeStyle = "#f87171"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); label("HAZARD", x + r + 4, y);
      }
      if (stormHere) {
        const [x, y] = sx(stormHere.lon, stormHere.lat), r = zr(stormHere.radiusM), g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        g.addColorStop(0, "rgba(214,160,96,.66)"); g.addColorStop(0.7, "rgba(196,140,84,.44)"); g.addColorStop(1, "rgba(196,140,84,.08)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.setLineDash([7, 5]); ctx.strokeStyle = "rgba(251,191,36,.95)"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]); label("DUST STORM · SIMULATED", x - 62, y);
      }
      if (inheritedHere) {
        line(inheritedHere.trail, "#c084fc", 2.5, [2, 5]);
        if (inheritedHere.storm) { const [x, y] = sx(inheritedHere.storm.lon, inheritedHere.storm.lat); ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(251,191,36,.6)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, zr(inheritedHere.storm.radiusM), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); label("STORM WHEN SAVED", x - 52, y); }
      }
      const ALT_COLOR = { detour: "#f59e0b", shelter: "#4ade80", retarget: "#c084fc" } as const;
      if (contingency) for (const a of contingency.alternates) line(a.route.points, ALT_COLOR[a.kind], 3, [9, 6]);
      if (liveHere) line(live.trail, "#fde047", 3);
      for (const p of [...points, ...(start?.kind === "custom" ? [start] : []), ...(end?.kind === "custom" ? [end] : [])]) {
        const [x, y] = sx(p.lon, p.lat);
        if (x < -20 || y < -20 || x > cw + 20 || y > ch + 20) continue;
        ctx.lineWidth = 2; ctx.strokeStyle = "#0c1117";
        if (p.kind === "target") { ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); label(p.label.split(" · ")[0], x + 10, y); }
        else if (p.kind === "base") { ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10); label("BASE", x + 10, y); }
        else if (p.kind === "waypoint") { ctx.fillStyle = "#22d3ee"; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke(); label(p.label.replace("Saved · ", ""), x + 10, y); }
        else { ctx.fillStyle = "#e879f9"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
      for (const [p, color, tag] of [[start, "#4ade80", "A"], [end, "#f87171", "B"]] as const) {
        if (!p) continue;
        const [x, y] = sx(p.lon, p.lat);
        ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke(); label(tag, x - 3, y - 20);
      }
      if (inheritedHere) { const [x, y] = sx(inheritedHere.lastPosition.lon, inheritedHere.lastPosition.lat); ctx.fillStyle = "#c084fc"; ctx.strokeStyle = "#0c1117"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); label(`LAST · ${inheritedHere.callsign}`, x + 10, y); }
      if (liveHere) {
        const [x, y] = sx(live.crew.lon, live.crew.lat);
        ctx.fillStyle = "rgba(253,224,71,.25)"; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fde047"; ctx.strokeStyle = "#0c1117"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); label("CREW", x + 12, y);
      }
      // scale bar
      const mpp = terrain.dxM / z; const nice = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].find((v) => v / mpp >= 80) ?? 100000; const bw = nice / mpp;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, ch - 18); ctx.lineTo(16 + bw, ch - 18); ctx.moveTo(16, ch - 23); ctx.lineTo(16, ch - 13); ctx.moveTo(16 + bw, ch - 23); ctx.lineTo(16 + bw, ch - 13); ctx.stroke();
      label(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, 22, ch - 30);
    };
    schedule();
  }, [terrain, vectors, active, opacity, route, start, end, points, imagesReady, stricter, schedule, hazardZones, stormHere, inheritedHere, contingency, liveHere, live.crew, live.trail]);

  // ---- sizing / fit / wheel ---------------------------------------------------------------------------------------
  const fit = useCallback(() => {
    if (!terrain) return;
    const { w: cw, h: ch } = size.current; if (!cw || !ch) return;
    const z = Math.min(cw / terrain.w, ch / terrain.h) * 0.98;
    touched.current = false;
    view.current = { z, x: terrain.w / 2 - cw / 2 / z, y: terrain.h / 2 - ch / 2 / z };
    schedule();
  }, [terrain, schedule]);
  useEffect(() => {
    const wrap = wrapRef.current, cv = canvasRef.current; if (!wrap || !cv) return;
    const resize = () => {
      const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      size.current = { w: r.width, h: r.height, dpr }; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      if (terrain && r.width > 0 && (!fitted.current || !touched.current)) { fitted.current = true; fit(); } else schedule();
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    return () => ro.disconnect();
  }, [terrain, fit, schedule]);
  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    touched.current = true;
    const v = view.current, nz = Math.min(14, Math.max(0.35, v.z * factor));
    const gx = v.x + sx / v.z, gy = v.y + sy / v.z;
    view.current = { z: nz, x: gx - sx / nz, y: gy - sy / nz }; schedule();
  }, [schedule]);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---- pointer interaction ----------------------------------------------------------------------------------------
  const local = (e: ReactPointerEvent) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const toCell = (sx: number, sy: number): [number, number] => [view.current.x + sx / view.current.z, view.current.y + sy / view.current.z];
  const unitAt = (gx: number, gy: number) => {
    const cv = canvasRef.current; const ctx = cv?.getContext("2d"); if (!ctx || !vectors) return undefined;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const hit = vectors.units.find((u) => ctx.isPointInPath(u.path, gx, gy, "evenodd"));
    ctx.restore(); return hit?.name;
  };
  const onDown = (e: ReactPointerEvent) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture can fail for synthetic or already-released pointers */ } pointers.current.set(e.pointerId, local(e)); gesture.current = { moved: 0, pinch: 0 }; };
  const onMove = (e: ReactPointerEvent) => {
    const p = local(e);
    if (!pointers.current.has(e.pointerId)) {
      if (!terrain) return;
      const [gx, gy] = toCell(p.x, p.y); const k = `${Math.floor(gx)},${Math.floor(gy)}`;
      if (k !== lastCell.current) { lastCell.current = k; const pr = probe(terrain, gx, gy); setHover(pr ? { ...pr, unit: unitAt(gx, gy) } : null); }
      return;
    }
    const prev = pointers.current.get(e.pointerId)!; pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / gesture.current.pinch);
      gesture.current.pinch = d; gesture.current.moved = 99; return;
    }
    const dx = p.x - prev.x, dy = p.y - prev.y; gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    touched.current = true;
    view.current = { ...view.current, x: view.current.x - dx / view.current.z, y: view.current.y - dy / view.current.z }; schedule();
  };
  const onUp = (e: ReactPointerEvent) => {
    const wasClick = pointers.current.size === 1 && gesture.current.moved < 6;
    const p = local(e); pointers.current.delete(e.pointerId); gesture.current.pinch = 0;
    if (!wasClick || !terrain) return;
    const hit = points.map((q) => { const [gx, gy] = cellOf(terrain, q.lon, q.lat); return { q, d: Math.hypot((gx - view.current.x) * view.current.z - p.x, (gy - view.current.y) * view.current.z - p.y) }; }).filter((h) => h.d < 14).sort((a, b) => a.d - b.d)[0];
    if (pickMode) {
      const [gx, gy] = toCell(p.x, p.y); const pr = probe(terrain, gx, gy);
      if (!pr) return;
      const pt: Pt = hit?.q ?? { key: `custom-${pickMode}`, label: `Map point ${pr.lat.toFixed(4)}°N ${pr.lon.toFixed(4)}°E`, lat: pr.lat, lon: pr.lon, kind: "custom" };
      (pickMode === "start" ? setStart : setEnd)(pt); setPickMode(null);
    } else if (hit) setEnd(hit.q);
  };

  const saveView = () => {
    drawRef.current();
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `marsline-${terrain?.meta.id ?? "map"}-view.png`; link.click(); URL.revokeObjectURL(url);
    }, "image/png");
  };
  const choose = (setter: (p: Pt) => void, key: string) => { const p = [...points, ...(start?.kind === "custom" ? [start] : []), ...(end?.kind === "custom" ? [end] : [])].find((q) => q.key === key); if (p) setter(p); };
  const optionList = [...points, ...(start?.kind === "custom" && !points.some((p) => p.key === start.key) ? [start] : []), ...(end?.kind === "custom" && !points.some((p) => p.key === end.key) ? [end] : [])];
  const toggle = (id: string) => setActive((a) => ({ ...a, [id]: !a[id] }));
  const imageLayers = terrain?.meta.layers.filter((l) => /\.(png|jpg)$/.test(l.file)) ?? [];
  const baseLayers = imageLayers.filter((l) => l.dataType !== "DERIVED"), derivedLayers = imageLayers.filter((l) => l.dataType === "DERIVED");
  const vectorLayers = VECTOR_LAYERS.filter((l) => terrain?.meta.vectors.includes(l.id));
  const onCount = (layers: { id: string }[]) => layers.filter((l) => active[l.id]).length;
  const customAssumptions = blockSlope < bakedBlock || speedKmh !== DEFAULT_SPEED_KMH || evaLimitH !== DEFAULT_EVA_H;
  const overLimit = !!route && route.timeMin > evaLimitH * 60;
  const dockBadge: Record<DockTab, string> = { live: live.conditions.level !== "NOMINAL" ? live.conditions.level : live.traverse ? `${Math.round(live.progress * 100)}%` : "", layers: String(imageLayers.filter((l) => active[l.id]).length + vectorLayers.filter((l) => active[l.id]).length), route: route ? `${(route.distM / 1000).toFixed(1)} km` : "", checks: "" };

  const profilePath = useMemo(() => {
    const profile = route?.profile ?? [];
    if (profile.length < 2) return null;
    const zs = profile.map((p) => p.z), zmin = Math.min(...zs), zmax = Math.max(...zs), total = profile[profile.length - 1].d || 1;
    const X = (d: number) => 4 + (d / total) * 292, Y = (z: number) => 70 - ((z - zmin) / Math.max(zmax - zmin, 1)) * 58;
    const line = profile.map((p, i) => `${i ? "L" : "M"}${X(p.d).toFixed(1)} ${Y(p.z).toFixed(1)}`).join("");
    return { line, area: `${line}L296 76L4 76Z`, zmin, zmax };
  }, [route]);

  if (error) return <article className="panel"><div className="empty-state">{error}</div></article>;
  return (
    <div className="jz-wrap">
      <div className="jz-tabs" role="tablist" aria-label="Study areas">{regions.map((r) => <button key={r.id} role="tab" aria-selected={r.id === regionId} className={`jz-tab ${r.id === regionId ? "on" : ""}`} onClick={() => selectRegion(r.id)}>{r.name}<small>{r.detail === "detailed" ? "DETAILED" : "REGIONAL"}</small></button>)}</div>
      {terrain && <div className="jz-strip"><span>{terrain.meta.blurb}</span><a href={`${terrain.base}/${terrain.meta.missionMap}`} download={`${terrain.meta.id}_mission_map.png`} title="Download the pre-rendered one-page mission map. Use the ⬇ button on the map to save your current view instead.">ONE-PAGE MAP (PNG) ↓</a></div>}
    <div className="jz">
      <div className="jz-stage" ref={wrapRef}>
        <canvas ref={canvasRef} className={`jz-canvas ${pickMode ? "picking" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)} aria-label="Interactive Mars surface map" />
        {!terrain && <div className="jz-loading">LOADING STUDY AREA…</div>}
        <div className="jz-zoom"><button aria-label="Zoom in" onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1.5)}>＋</button><button aria-label="Zoom out" onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1 / 1.5)}>－</button><button aria-label="Fit map" onClick={fit}>⤢</button><button aria-label="Save current view as PNG" title="Save current view as PNG" onClick={saveView}>⬇</button></div>
        {pickMode && <div className="jz-pick">Click the map to set the {pickMode === "start" ? "START (A)" : "DESTINATION (B)"} · <button onClick={() => setPickMode(null)}>cancel</button></div>}
        {route && dock !== "route" && start && end && <button className={`jz-sum ${overLimit || routeThreatened ? "warn" : ""}`} onClick={() => setDock(routeThreatened ? "live" : "route")} title={routeThreatened ? "Open the live tab for additional routes" : "Open the route panel"}><b>{shortLabel(start.label)} → {shortLabel(end.label)}</b><span>{(route.distM / 1000).toFixed(2)} km · {fmtTime(route.timeMin)}</span><small>{routeThreatened ? "ROUTE CROSSES STORM OR HAZARD · SEE ALTERNATES ›" : `${overLimit ? `OVER ${evaLimitH} h EVA LIMIT` : `WITHIN ${evaLimitH} h EVA LIMIT`} · OPEN ROUTE ›`}</small></button>}
        <div className="jz-probe">{hover ? <>
          <b>{hover.lat.toFixed(4)}°N · {hover.lon.toFixed(4)}°E</b>
          <span>Elevation {Math.round(hover.elevationM)} m · Slope {hover.slopeDeg.toFixed(1)}°</span>
          <span className={`jz-class c${hover.terrainClass}`}>{CLASS_NAME[hover.terrainClass]}{hover.unit ? ` · ${hover.unit}` : ""}</span>
        </> : <span>Hover the map for terrain readout</span>}</div>
      </div>

      <aside className="jz-side">
        <div className="jz-dock-tabs" role="tablist" aria-label="Map panels">
          {DOCK_TABS.map((t) => <button key={t.id} id={`jz-tab-${t.id}`} role="tab" aria-selected={dock === t.id} aria-controls={`jz-pane-${t.id}`} className={`jz-dock-tab ${dock === t.id ? "on" : ""}`} onClick={() => setDock(t.id)}>{t.label}{dockBadge[t.id] && <small>{dockBadge[t.id]}</small>}</button>)}
        </div>
        <div className="jz-dock-body">

          <div id="jz-pane-layers" role="tabpanel" aria-labelledby="jz-tab-layers" hidden={dock !== "layers"} className="jz-dock-pane">
            <article className="panel">
              <div className="panel-top"><span>DATA LAYERS</span><span className="tag green">{imageLayers.length + (terrain?.meta.vectors.length ?? 0)} LAYERS</span></div>
              {terrain?.meta.detail === "regional" && <p className="fineprint">Regional scale: 463 m elevation cells only, with no geologic map or optical imagery in the supplied files. Local slopes are smoothed, and targets are relief-derived candidates. Verify with HiRISE/CTX.</p>}
              <details className="jz-fold" open>
                <summary>IMAGERY · TOPOGRAPHY · THERMAL<small>{onCount(baseLayers)} on</small></summary>
                {baseLayers.map((l) => <LayerToggle key={l.id} title={l.title} detail={`${l.dataType} · ${l.resolution}`} note={l.note} checked={!!active[l.id]} onChange={() => toggle(l.id)} />)}
              </details>
              <details className="jz-fold" open>
                <summary>DERIVED FEATURES<small>{onCount(derivedLayers)} on</small></summary>
                {derivedLayers.map((l) => <LayerToggle key={l.id} title={l.title} detail={`${l.dataType} · ${l.resolution}`} note={l.note} checked={!!active[l.id]} onChange={() => toggle(l.id)} />)}
              </details>
              {!!vectorLayers.length && <details className="jz-fold">
                <summary>GEOLOGY OVERLAYS<small>{onCount(vectorLayers)} on</small></summary>
                {VECTOR_LAYERS.filter((l) => terrain?.meta.vectors.includes(l.id)).map((l) => <LayerToggle key={l.id} title={l.title} detail={l.note} checked={!!active[l.id]} onChange={() => toggle(l.id)} />)}
              </details>}
              <label className="jz-opacity">Overlay opacity<input type="range" min={0.15} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
              {active.traversability && <div className="jz-legend"><i style={{ background: "#22c55e" }} />Nominal<i style={{ background: "#f59e0b" }} />Caution<i style={{ background: "#dc2626" }} />No-go</div>}
            </article>
          </div>

          <div id="jz-pane-route" role="tabpanel" aria-labelledby="jz-tab-route" hidden={dock !== "route"} className="jz-dock-pane">
            <article className="panel">
              <div className="panel-top"><span>TERRAIN-AWARE ROUTE</span><span className="tag orange">A* · SLOPE + GEOLOGY</span></div>
              <div className="jz-fields">
                <label>Start (A)<select value={start?.key ?? ""} onChange={(e) => choose(setStart, e.target.value)}>{optionList.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
                <button className="button outline" onClick={() => setPickMode("start")}>PICK A ON MAP</button>
                <label>Destination (B)<select value={end?.key ?? ""} onChange={(e) => choose(setEnd, e.target.value)}>{optionList.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
                <button className="button outline" onClick={() => setPickMode("end")}>PICK B ON MAP</button>
              </div>
              <details className="jz-fold">
                <summary>ASSUMPTIONS · ADJUST TO SEE THE EFFECT{customAssumptions && <small className="jz-custom">CUSTOM</small>}</summary>
                <div className="jz-assume">
                  <label><span>No-go slope <b>{blockSlope}°</b></span><input type="range" min={6} max={Math.round(bakedBlock)} step={1} value={blockSlope} onChange={(e) => setBlockOverride(Number(e.target.value))} /></label>
                  <label><span>Walking speed <b>{speedKmh.toFixed(1)} km/h</b></span><input type="range" min={1.5} max={4.5} step={0.5} value={speedKmh} onChange={(e) => setSpeedKmh(Number(e.target.value))} /></label>
                  <label><span>Spacewalk limit <b>{evaLimitH} h</b></span><input type="range" min={4} max={10} step={1} value={evaLimitH} onChange={(e) => setEvaLimitH(Number(e.target.value))} /></label>
                  <button className="button outline" onClick={() => { setBlockOverride(null); setSpeedKmh(DEFAULT_SPEED_KMH); setEvaLimitH(DEFAULT_EVA_H); }}>RESET TO DEFAULTS</button>
                  {blockSlope < bakedBlock && <p className="fineprint">Stricter no-go slope is drawn in red on the map. You can only tighten the limit; looser limits would need the notebook to be re-run.</p>}
                </div>
              </details>
              {routeError && <div className="fetch-result error">{routeError}</div>}
              {route && <>
                <div className="jz-stats">
                  <div><small>DISTANCE</small><b>{(route.distM / 1000).toFixed(2)} km</b></div>
                  <div><small>WALK TIME*</small><b>{fmtTime(route.timeMin)}</b></div>
                  <div><small>CLIMB / DESCENT</small><b>+{Math.round(route.gainM)} / −{Math.round(route.lossM)} m</b></div>
                  <div><small>MAX / MEAN SLOPE</small><b>{route.maxSlopeDeg.toFixed(1)}° / {route.meanSlopeDeg.toFixed(1)}°</b></div>
                  <div><small>ON CAUTION TERRAIN</small><b>{route.cautionPct.toFixed(0)}%</b></div>
                  <div><small>STRAIGHT LINE</small><b>{(route.straightM / 1000).toFixed(2)} km</b></div>
                </div>
                {snapNote && <p className="jz-verdict warn">{snapNote}</p>}
                {overLimit && <p className="jz-verdict warn">Estimated {fmtTime(route.timeMin)} exceeds your {evaLimitH} h spacewalk limit. Split this into several excursions or use a rover.</p>}
                <p className={`jz-verdict ${route.straightBlocked ? "warn" : ""}`}>{route.straightBlocked ? `The straight line crosses no-go terrain. This route detours ${route.detourPct.toFixed(0)}% to stay on walkable ground.` : `The straight line is walkable; the planned route is ${route.detourPct.toFixed(0)}% longer to favour easier terrain.`}</p>
                {profilePath && <svg className="jz-profile" viewBox="0 0 300 84" role="img" aria-label="Elevation profile along the route"><path d={profilePath.area} fill="rgba(56,189,248,.18)" /><path d={profilePath.line} fill="none" stroke="#38bdf8" strokeWidth="1.6" /><text x="4" y="10" fill="#929eaa" fontSize="7">{Math.round(profilePath.zmax)} m</text><text x="4" y="82" fill="#929eaa" fontSize="7">{Math.round(profilePath.zmin)} m</text></svg>}
                <p className="fineprint">*Concept estimate: {speedKmh} km/h on easy ground, scaled by slope, roughness and geology cost. Slope limits: caution ≥ {terrain?.meta.thresholds.slopeCautionDeg}°, no-go ≥ {blockSlope}°. Not validated for crew operations.</p>
                {onSaveRoute && start && end && <button className="button primary full" disabled={saving} onClick={async () => { setSaving(true); try { await onSaveRoute({ start, end, route }); } finally { setSaving(false); } }}>{saving ? "SAVING…" : "SAVE ROUTE TO MISSION"}</button>}
                {terrain && <details className="jz-fold">
                  <summary>SPACEWALK WINDOW · SUN AND MEASURED TEMPERATURE</summary>
                  <EvaWindow latDeg={(terrain.meta.gridBounds[0] + terrain.meta.gridBounds[2]) / 2} routeHours={route.timeMin / 60} weatherUrl={terrain.meta.id === "jezero" ? `${terrain.base}/meda_timeseries.json` : undefined} />
                </details>}
              </>}
              {end && (end.thumb || end.detail) && <details className="jz-fold">
                <summary>DESTINATION · WHY GO THERE</summary>
                {end.thumb && terrain && <NextImage className="jz-thumb" src={`${terrain.base}/${end.thumb}`} alt={`Orbital CTX view around ${end.label}, about 3 km wide`} width={480} height={480} loading="eager" unoptimized />}
                {end.detail && <p className="jz-why"><b>Why go there:</b> {end.detail}{end.science !== undefined ? ` · science value ${end.science.toFixed(2)}` : ""}</p>}
              </details>}
            </article>
          </div>

          <div id="jz-pane-live" role="tabpanel" aria-labelledby="jz-tab-live" hidden={dock !== "live"} className="jz-dock-pane">
            <LiveDock live={live} regionId={terrain?.meta.id} extentKm={terrain ? Math.min(terrain.w * terrain.dxM, terrain.h * terrain.dyM) / 1000 : 57} hasRoute={!!route} routeLabel={start && end ? `${shortLabel(start.label)} to ${shortLabel(end.label)}` : ""}
              contingency={contingency} routeThreatened={routeThreatened} avoidCount={avoidFrozen.length} onStart={startTraverse}
              onStartFromCrew={() => { setStart({ key: "custom-start", label: "Crew position", lat: live.crew.lat, lon: live.crew.lon, kind: "custom" }); setDock("route"); }}
              onAccept={acceptAlternate} onClearAvoid={() => setAvoidFrozen([])} onMarkHazard={() => onMarkHazard(live.crew.lat, live.crew.lon)}
              handoffs={handoffs} canSave={canSaveHandoff} onSave={onSaveHandoff} onLoad={loadHandoff} />
          </div>

          <div id="jz-pane-checks" role="tabpanel" aria-labelledby="jz-tab-checks" hidden={dock !== "checks"} className="jz-dock-pane">
            {terrain?.meta.validation && <ValidationPanel base={terrain.base} file={terrain.meta.validation} image={terrain.meta.validationImage} />}
            {terrain && <article className="panel">
              <div className="panel-top"><span>DATA QUALITY</span><span className="tag">VALIDATION</span></div>
              <div className="data-line"><span>No-go / caution / nominal</span><b>{(terrain.meta.traversabilityShare.nogo * 100).toFixed(0)} / {(terrain.meta.traversabilityShare.caution * 100).toFixed(0)} / {(terrain.meta.traversabilityShare.nominal * 100).toFixed(0)} %</b></div>
              <div className="data-line"><span>Cell size</span><b>{terrain.meta.grid.stepM} m</b></div>
              {terrain.meta.molaCheck && <div className="data-line"><span>HRSC vs MOLA elevation</span><b>r = {terrain.meta.molaCheck.corr} · RMS {terrain.meta.molaCheck.rmsM} m</b></div>}
              <p className="fineprint">{terrain.meta.assumptions}</p>
            </article>}
          </div>

        </div>
      </aside>
    </div>
    </div>
  );
}
