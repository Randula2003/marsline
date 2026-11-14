"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import NextImage from "next/image";
import { WALK_SPEED_KMH, cellOf, loadRegions, loadTerrain, loadVectors, planRoute, probe, type Probe, type RegionInfo, type Route, type Terrain, type Vectors } from "@/lib/terrain";

type Waypoint = { id: string; name: string; type: string; latitudeDeg: number | string; longitudeDeg: number | string };
type Pt = { key: string; label: string; lat: number; lon: number; kind: "base" | "target" | "waypoint" | "custom"; detail?: string; science?: number; thumb?: string };
export type RouteSave = { start: Pt; end: Pt; route: Route };
type Props = { waypoints: Waypoint[]; onSaveRoute?: (save: RouteSave) => Promise<void> };

const VECTOR_LAYERS = [
  { id: "geology", title: "Geologic units", note: "USGS SIM 3464 · hover for unit" },
  { id: "linear", title: "Ridges, rims, delta fronts", note: "USGS linear features" },
  { id: "craters", title: "Small craters", note: "USGS location features" },
  { id: "ellipse", title: "Landing ellipse", note: "Perseverance 2021 target" }
];
const SMOOTH_OFF = ["traversability", "science", "slope"];
const fmtTime = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;
const DEFAULT_EVA_H = 8, DEFAULT_SPEED_KMH = WALK_SPEED_KMH; // ASSUMPTIONS the user can adjust in the route panel
const CLASS_NAME = ["No-go", "Caution", "Nominal"];

function LayerToggle({ title, detail, note, checked, onChange }: { title: string; detail: string; note?: string; checked: boolean; onChange: () => void }) {
  return <label className="jz-layer"><input type="checkbox" checked={checked} onChange={onChange} /><span><b>{title}</b><small>{detail}</small>{note && <small className="jz-note">{note}</small>}</span></label>;
}

export default function MarsMap({ waypoints, onSaveRoute }: Props) {
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

  const view = useRef({ x: 0, y: 0, z: 1 });
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const images = useRef(new Map<string, HTMLImageElement>());
  const drawRef = useRef<() => void>(() => {});
  const frame = useRef(0);
  const fitted = useRef(false);
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
      setStart({ key: "base", label: t.meta.start.name, lat: t.meta.start.lat, lon: t.meta.start.lon, kind: "base" });
      const first = t.meta.targets[0];
      setEnd(first ? { key: first.id, label: `${first.id} · ${first.name}`, lat: first.lat, lon: first.lon, kind: "target", detail: first.reason, science: first.science, thumb: first.thumb } : null);
    }).catch((e) => alive && setError(e instanceof Error ? e.message : "Unable to load map layers"));
    return () => { alive = false; };
  }, [regionId]);
  const selectRegion = (id: string) => {
    if (id === regionId) return;
    setTerrain(null); setVectors(null); setStart(null); setEnd(null); setHover(null); setPickMode(null); setBlockOverride(null); setRegionId(id);
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
  const routeResult = useMemo(() => (terrain && start && end && (start.lat !== end.lat || start.lon !== end.lon) ? planRoute(terrain, start, end, { blockSlopeDeg: blockSlope, speedKmh }) : null), [terrain, start, end, blockSlope, speedKmh]);
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
      // scale bar
      const mpp = terrain.dxM / z; const nice = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].find((v) => v / mpp >= 80) ?? 100000; const bw = nice / mpp;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, ch - 18); ctx.lineTo(16 + bw, ch - 18); ctx.moveTo(16, ch - 23); ctx.lineTo(16, ch - 13); ctx.moveTo(16 + bw, ch - 23); ctx.lineTo(16 + bw, ch - 13); ctx.stroke();
      label(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, 22, ch - 30);
    };
    schedule();
  }, [terrain, vectors, active, opacity, route, start, end, points, imagesReady, stricter, schedule]);

  // ---- sizing / fit / wheel ---------------------------------------------------------------------------------------
  const fit = useCallback(() => {
    if (!terrain) return;
    const { w: cw, h: ch } = size.current; if (!cw || !ch) return;
    const z = Math.min(cw / terrain.w, ch / terrain.h) * 0.98;
    view.current = { z, x: terrain.w / 2 - cw / 2 / z, y: terrain.h / 2 - ch / 2 / z };
    schedule();
  }, [terrain, schedule]);
  useEffect(() => {
    const wrap = wrapRef.current, cv = canvasRef.current; if (!wrap || !cv) return;
    const resize = () => {
      const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      size.current = { w: r.width, h: r.height, dpr }; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      if (terrain && !fitted.current && r.width > 0) { fitted.current = true; fit(); } else schedule();
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    return () => ro.disconnect();
  }, [terrain, fit, schedule]);
  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
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
    <div className="jz">
      <div className="jz-stage" ref={wrapRef}>
        <canvas ref={canvasRef} className={`jz-canvas ${pickMode ? "picking" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)} aria-label="Interactive Mars surface map" />
        {!terrain && <div className="jz-loading">LOADING STUDY AREA…</div>}
        <div className="jz-zoom"><button aria-label="Zoom in" onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1.5)}>＋</button><button aria-label="Zoom out" onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1 / 1.5)}>－</button><button aria-label="Fit map" onClick={fit}>⤢</button><button aria-label="Save current view as PNG" title="Save current view as PNG" onClick={saveView}>⬇</button></div>
        {pickMode && <div className="jz-pick">Click the map to set the {pickMode === "start" ? "START (A)" : "DESTINATION (B)"} · <button onClick={() => setPickMode(null)}>cancel</button></div>}
        <div className="jz-probe">{hover ? <>
          <b>{hover.lat.toFixed(4)}°N · {hover.lon.toFixed(4)}°E</b>
          <span>Elevation {Math.round(hover.elevationM)} m · Slope {hover.slopeDeg.toFixed(1)}°</span>
          <span className={`jz-class c${hover.terrainClass}`}>{CLASS_NAME[hover.terrainClass]}{hover.unit ? ` · ${hover.unit}` : ""}</span>
        </> : <span>Hover the map for terrain readout</span>}</div>
      </div>

      <aside className="jz-side">
        <article className="panel">
          <div className="panel-top"><span>STUDY AREA</span><span className="tag green">{regions.length || 1} AREAS</span></div>
          <div className="jz-regions">{(regions.length ? regions : []).map((r) => <button key={r.id} className={`jz-region ${r.id === regionId ? "on" : ""}`} onClick={() => selectRegion(r.id)}>
            <b>{r.name}</b><small>{r.lat.toFixed(2)}°N · {r.lon.toFixed(2)}°E · {r.widthKm}×{r.heightKm} km</small><span className={`tag ${r.detail === "detailed" ? "green" : ""}`}>{r.detail === "detailed" ? `DETAILED · ${r.resolutionM} m` : `REGIONAL · ${r.resolutionM} m`}</span></button>)}</div>
          {terrain && <p className="jz-why">{terrain.meta.blurb}</p>}
          {terrain?.meta.detail === "regional" && <p className="fineprint">Regional scale: 463 m elevation cells only, with no geologic map or optical imagery in the supplied files. Local slopes are smoothed, and targets are relief-derived candidates. Verify with HiRISE/CTX.</p>}
          {terrain && <a className="button primary full" href={`${terrain.base}/${terrain.meta.missionMap}`} download={`${terrain.meta.id}_mission_map.png`}>DOWNLOAD ONE-PAGE MAP (PNG) ↓</a>}
          <p className="fineprint">Use the ⬇ button on the map to save exactly what you see, including your layers and route.</p>
        </article>
        <article className="panel">
          <div className="panel-top"><span>DATA LAYERS</span><span className="tag green">{imageLayers.length + (terrain?.meta.vectors.length ?? 0)} LAYERS</span></div>
          <div className="jz-group">IMAGERY · TOPOGRAPHY · THERMAL</div>
          {imageLayers.filter((l) => l.dataType !== "DERIVED").map((l) => <LayerToggle key={l.id} title={l.title} detail={`${l.dataType} · ${l.resolution}`} note={l.note} checked={!!active[l.id]} onChange={() => toggle(l.id)} />)}
          <div className="jz-group">DERIVED FEATURES</div>
          {imageLayers.filter((l) => l.dataType === "DERIVED").map((l) => <LayerToggle key={l.id} title={l.title} detail={`${l.dataType} · ${l.resolution}`} note={l.note} checked={!!active[l.id]} onChange={() => toggle(l.id)} />)}
          {!!terrain?.meta.vectors.length && <div className="jz-group">GEOLOGY OVERLAYS</div>}
          {VECTOR_LAYERS.filter((l) => terrain?.meta.vectors.includes(l.id)).map((l) => <LayerToggle key={l.id} title={l.title} detail={l.note} checked={!!active[l.id]} onChange={() => toggle(l.id)} />)}
          <label className="jz-opacity">Overlay opacity<input type="range" min={0.15} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
          {active.traversability && <div className="jz-legend"><i style={{ background: "#22c55e" }} />Nominal<i style={{ background: "#f59e0b" }} />Caution<i style={{ background: "#dc2626" }} />No-go</div>}
        </article>

        <article className="panel">
          <div className="panel-top"><span>TERRAIN-AWARE ROUTE</span><span className="tag orange">A* · SLOPE + GEOLOGY</span></div>
          <div className="jz-assume">
            <div className="jz-group">ASSUMPTIONS · ADJUST TO SEE THE EFFECT</div>
            <label><span>No-go slope <b>{blockSlope}°</b></span><input type="range" min={6} max={Math.round(bakedBlock)} step={1} value={blockSlope} onChange={(e) => setBlockOverride(Number(e.target.value))} /></label>
            <label><span>Walking speed <b>{speedKmh.toFixed(1)} km/h</b></span><input type="range" min={1.5} max={4.5} step={0.5} value={speedKmh} onChange={(e) => setSpeedKmh(Number(e.target.value))} /></label>
            <label><span>Spacewalk limit <b>{evaLimitH} h</b></span><input type="range" min={4} max={10} step={1} value={evaLimitH} onChange={(e) => setEvaLimitH(Number(e.target.value))} /></label>
            <button className="button outline" onClick={() => { setBlockOverride(null); setSpeedKmh(DEFAULT_SPEED_KMH); setEvaLimitH(DEFAULT_EVA_H); }}>RESET TO DEFAULTS</button>
            {blockSlope < bakedBlock && <p className="fineprint">Stricter no-go slope is drawn in red on the map. You can only tighten the limit; looser limits would need the notebook to be re-run.</p>}
          </div>
          <div className="jz-fields">
            <label>Start (A)<select value={start?.key ?? ""} onChange={(e) => choose(setStart, e.target.value)}>{optionList.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
            <button className="button outline" onClick={() => setPickMode("start")}>PICK A ON MAP</button>
            <label>Destination (B)<select value={end?.key ?? ""} onChange={(e) => choose(setEnd, e.target.value)}>{optionList.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
            <button className="button outline" onClick={() => setPickMode("end")}>PICK B ON MAP</button>
          </div>
          {end?.thumb && terrain && <NextImage className="jz-thumb" src={`${terrain.base}/${end.thumb}`} alt={`Orbital CTX view around ${end.label}, about 3 km wide`} width={480} height={480} loading="eager" unoptimized />}
          {end?.detail && <p className="jz-why"><b>Why go there:</b> {end.detail}{end.science !== undefined ? ` · science value ${end.science.toFixed(2)}` : ""}</p>}
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
            {route.timeMin > evaLimitH * 60 && <p className="jz-verdict warn">Estimated {fmtTime(route.timeMin)} exceeds your {evaLimitH} h spacewalk limit. Split this into several excursions or use a rover.</p>}
            <p className={`jz-verdict ${route.straightBlocked ? "warn" : ""}`}>{route.straightBlocked ? `The straight line crosses no-go terrain. This route detours ${route.detourPct.toFixed(0)}% to stay on walkable ground.` : `The straight line is walkable; the planned route is ${route.detourPct.toFixed(0)}% longer to favour easier terrain.`}</p>
            {profilePath && <svg className="jz-profile" viewBox="0 0 300 84" role="img" aria-label="Elevation profile along the route"><path d={profilePath.area} fill="rgba(56,189,248,.18)" /><path d={profilePath.line} fill="none" stroke="#38bdf8" strokeWidth="1.6" /><text x="4" y="10" fill="#929eaa" fontSize="7">{Math.round(profilePath.zmax)} m</text><text x="4" y="82" fill="#929eaa" fontSize="7">{Math.round(profilePath.zmin)} m</text></svg>}
            <p className="fineprint">*Concept estimate: {speedKmh} km/h on easy ground, scaled by slope, roughness and geology cost. Slope limits: caution ≥ {terrain?.meta.thresholds.slopeCautionDeg}°, no-go ≥ {blockSlope}°. Not validated for crew operations.</p>
            {onSaveRoute && start && end && <button className="button primary full" disabled={saving} onClick={async () => { setSaving(true); try { await onSaveRoute({ start, end, route }); } finally { setSaving(false); } }}>{saving ? "SAVING…" : "SAVE ROUTE TO MISSION"}</button>}
          </>}
        </article>

        {terrain && <article className="panel">
          <div className="panel-top"><span>DATA QUALITY</span><span className="tag">VALIDATION</span></div>
          <div className="data-line"><span>No-go / caution / nominal</span><b>{(terrain.meta.traversabilityShare.nogo * 100).toFixed(0)} / {(terrain.meta.traversabilityShare.caution * 100).toFixed(0)} / {(terrain.meta.traversabilityShare.nominal * 100).toFixed(0)} %</b></div>
          <div className="data-line"><span>Cell size</span><b>{terrain.meta.grid.stepM} m</b></div>
          {terrain.meta.molaCheck && <div className="data-line"><span>HRSC vs MOLA elevation</span><b>r = {terrain.meta.molaCheck.corr} · RMS {terrain.meta.molaCheck.rmsM} m</b></div>}
          <p className="fineprint">{terrain.meta.assumptions}</p>
        </article>}
      </aside>
    </div>
    </div>
  );
}
