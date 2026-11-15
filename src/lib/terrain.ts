// Loads the Jezero layers produced by notebooks/01_feature_engineering.ipynb and plans terrain-aware routes.
// All grid coordinates are in "cells" of the 75 m analysis grid: gx = (lon - west) / dlon, gy = (north - lat) / dlat.

export const REGIONS_BASE = "/data/regions";
export const regionBase = (id: string) => `${REGIONS_BASE}/${id}`;

export type RegionInfo = { id: string; name: string; blurb: string; detail: "detailed" | "regional"; lat: number; lon: number; widthKm: number; heightKm: number; resolutionM: number; targets: number; missionMap: string };
export async function loadRegions(): Promise<RegionInfo[]> {
  const res = await fetch(`${REGIONS_BASE}/index.json`);
  if (!res.ok) throw new Error("Study-area index not found. Run notebooks/01_feature_engineering.ipynb first.");
  return res.json();
}

export type LayerMeta = { id: string; base?: boolean; note?: string; title: string; file: string; dataType: string; source: string; resolution: string; bounds?: [number, number, number, number] };
export type Target = { id: string; name: string; unit: string; lat: number; lon: number; science: number; slopeDeg: number; elevationM: number; terrainClass: number; reason: string; thumb?: string };
export type Meta = {
  id: string; name: string; blurb: string; detail: "detailed" | "regional"; vectors: string[]; defaultLayers: string[];
  elevEncoding: { offset: number; scale: number }; missionMap: string;
  region: string;
  grid: { width: number; height: number; dlon: number; dlat: number; stepM: number; mPerDeg: number };
  gridBounds: [number, number, number, number]; // south, west, north, east
  thresholds: { slopeBlockDeg: number; slopeCautionDeg: number; roughCautionM: number };
  start: { id: string; name: string; lat: number; lon: number };
  targets: Target[];
  traversabilityShare: { nogo: number; caution: number; nominal: number };
  molaCheck: { meanDiffM: number; rmsM: number; corr: number } | null;
  validation?: string; validationImage?: string;
  elevationRangeM: [number, number];
  assumptions: string;
  layers: LayerMeta[];
};
export type Terrain = { meta: Meta; base: string; w: number; h: number; west: number; north: number; slope: Uint8Array; cost: Uint8Array; cls: Uint8Array; elev: Float32Array; dxM: number; dyM: number };

export const cellOf = (t: Terrain, lon: number, lat: number): [number, number] => [(lon - t.west) / t.meta.grid.dlon, (t.north - lat) / t.meta.grid.dlat];
export const lonLatOf = (t: Terrain, gx: number, gy: number): [number, number] => [t.west + gx * t.meta.grid.dlon, t.north - gy * t.meta.grid.dlat];

async function pixels(url: string): Promise<ImageData> {
  const img = new Image();
  // onload (not img.decode()) so loading also completes while the tab is in the background
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error(`Could not load ${url}`)); img.src = url; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export async function loadTerrain(id: string): Promise<Terrain> {
  const base = regionBase(id);
  const res = await fetch(`${base}/meta.json`);
  if (!res.ok) throw new Error(`Layers for "${id}" not found. Run notebooks/01_feature_engineering.ipynb first.`);
  const meta: Meta = await res.json();
  const [d, e] = await Promise.all([pixels(`${base}/grid_data.png`), pixels(`${base}/grid_elev.png`)]);
  const w = d.width, h = d.height, n = w * h;
  if (w !== meta.grid.width || h !== meta.grid.height) throw new Error("Grid texture does not match meta.json");
  const slope = new Uint8Array(n), cost = new Uint8Array(n), cls = new Uint8Array(n), elev = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    slope[i] = d.data[i * 4]; cost[i] = d.data[i * 4 + 1]; cls[i] = d.data[i * 4 + 2];
    elev[i] = (e.data[i * 4] * 256 + e.data[i * 4 + 1]) / meta.elevEncoding.scale - meta.elevEncoding.offset;
  }
  const midLat = (meta.gridBounds[0] + meta.gridBounds[2]) / 2;
  return {
    meta, base, w, h, west: meta.gridBounds[1], north: meta.gridBounds[2], slope, cost, cls, elev,
    dxM: meta.grid.dlon * meta.grid.mPerDeg * Math.cos(midLat * Math.PI / 180), dyM: meta.grid.dlat * meta.grid.mPerDeg
  };
}

export type Probe = { lat: number; lon: number; elevationM: number; slopeDeg: number; terrainClass: number; costFactor: number };
export function probe(t: Terrain, gx: number, gy: number): Probe | null {
  const x = Math.floor(gx), y = Math.floor(gy);
  if (x < 0 || y < 0 || x >= t.w || y >= t.h) return null;
  const i = y * t.w + x;
  if (t.cls[i] === 255) return null;
  const [lon, lat] = lonLatOf(t, gx, gy);
  return { lat, lon, elevationM: t.elev[i], slopeDeg: t.slope[i] / 4, terrainClass: t.cls[i], costFactor: t.cost[i] / 40 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Vector overlays → Path2D in grid coordinates (built once, redrawn cheaply while panning)
type Geom = { type: string; coordinates?: unknown; geometries?: Geom[] };
type FC = { features: { properties: Record<string, string | number>; geometry: Geom }[] };
export type UnitGroup = { name: string; color: string; note: string; science: number; cost: number; path: Path2D };
export type Vectors = { units: UnitGroup[]; lines: { type: string; color: string; path: Path2D }[]; craters: [number, number][]; ellipse: Path2D };

export const LINE_COLORS: Record<string, string> = {
  "ridge crest (type 1), certain": "#e0b070", lineament: "#b8a0ff", "crest of crater rim": "#ff7b6b",
  "delta lobe front": "#5ec8ff", "channel (fluvial)": "#3d8bff", "crest of buried crater": "#9aa5b1"
};

function walk(g: Geom, fn: (type: string, coords: unknown) => void) {
  if (g.type === "GeometryCollection") g.geometries?.forEach((s) => walk(s, fn));
  else fn(g.type, g.coordinates);
}
type Ring = number[][];
function addRing(p: Path2D, t: Terrain, ring: Ring, close: boolean) {
  ring.forEach(([lon, lat], i) => { const [x, y] = cellOf(t, lon, lat); if (i) p.lineTo(x, y); else p.moveTo(x, y); });
  if (close) p.closePath();
}
function addPolygons(p: Path2D, t: Terrain, type: string, coords: unknown) {
  const polys = (type === "Polygon" ? [coords] : type === "MultiPolygon" ? coords : []) as Ring[][];
  polys.forEach((poly) => poly.forEach((ring) => addRing(p, t, ring, true)));
}
async function getFC(base: string, name: string): Promise<FC> {
  const r = await fetch(`${base}/${name}`);
  if (!r.ok) throw new Error(`${name} missing`);
  return r.json();
}

export async function loadVectors(t: Terrain): Promise<Vectors> {
  if (!t.meta.vectors.length) return { units: [], lines: [], craters: [], ellipse: new Path2D() }; // regional areas have no geologic map
  const [geo, lin, cr, el] = await Promise.all([getFC(t.base, "geology_units.geojson"), getFC(t.base, "linear_features.geojson"), getFC(t.base, "craters.geojson"), getFC(t.base, "landing_ellipse.geojson")]);
  const byName = new Map<string, UnitGroup>();
  for (const f of geo.features) {
    const name = String(f.properties.name);
    let grp = byName.get(name);
    if (!grp) { grp = { name, color: String(f.properties.color), note: String(f.properties.note), science: Number(f.properties.science), cost: Number(f.properties.cost), path: new Path2D() }; byName.set(name, grp); }
    walk(f.geometry, (type, c) => addPolygons(grp.path, t, type, c));
  }
  const byType = new Map<string, Path2D>();
  for (const f of lin.features) {
    const key = String(f.properties.TYPE);
    const p = byType.get(key) ?? new Path2D(); byType.set(key, p);
    walk(f.geometry, (type, c) => {
      const parts = (type === "LineString" ? [c] : type === "MultiLineString" ? c : []) as Ring[];
      parts.forEach((ln) => addRing(p, t, ln, false));
    });
  }
  const craters: [number, number][] = [];
  for (const f of cr.features) walk(f.geometry, (type, c) => {
    const pts = (type === "Point" ? [c] : type === "MultiPoint" ? c : []) as number[][];
    pts.forEach(([lon, lat]) => craters.push(cellOf(t, lon, lat)));
  });
  const ellipse = new Path2D();
  for (const f of el.features) walk(f.geometry, (type, c) => addPolygons(ellipse, t, type, c));
  return {
    units: [...byName.values()], ellipse, craters,
    lines: [...byType].map(([type, path]) => ({ type, path, color: LINE_COLORS[type] ?? "#ffffff" }))
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Terrain-aware route planning: A* over the engineered cost grid.
export type LonLat = { lon: number; lat: number };
export type Route = {
  points: LonLat[]; distM: number; timeMin: number; maxSlopeDeg: number; meanSlopeDeg: number; gainM: number; lossM: number;
  cautionPct: number; straightM: number; straightBlocked: boolean; detourPct: number;
  profile: { d: number; z: number; s: number; c: number }[];
};
export const WALK_SPEED_KMH = 3; // ASSUMPTION: nominal suited walking speed on easy ground

const passable = (t: Terrain, i: number) => t.cls[i] !== 0 && t.cls[i] !== 255;

function snap(t: Terrain, gx: number, gy: number, ok: (i: number) => boolean): number | null {
  const cx = Math.min(t.w - 1, Math.max(0, Math.floor(gx))), cy = Math.min(t.h - 1, Math.max(0, Math.floor(gy)));
  let best = -1, bd = Infinity;
  for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= t.w || y >= t.h) continue;
    const i = y * t.w + x;
    const d = dx * dx + dy * dy;
    if (ok(i) && d < bd) { bd = d; best = i; }
  }
  return best < 0 ? null : best;
}

class MinHeap {
  private k: number[] = []; private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    let i = this.k.length; this.k.push(key); this.v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop(): number {
    const top = this.v[0], lk = this.k.pop() as number, lv = this.v.pop() as number, n = this.k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && this.k[c + 1] < this.k[c]) c++;
        if (this.k[c] >= lk) break;
        this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
      }
      this.k[i] = lk; this.v[i] = lv;
    }
    return top;
  }
}

export type RouteOptions = { blockSlopeDeg?: number; speedKmh?: number };

export function planRoute(t: Terrain, a: LonLat, b: LonLat, opts: RouteOptions = {}): Route | { error: string } {
  const blockQ = (opts.blockSlopeDeg ?? 99) * 4;                     // slope is stored as degrees x 4
  const ok = (i: number) => passable(t, i) && t.slope[i] < blockQ;
  const [ax, ay] = cellOf(t, a.lon, a.lat), [bx, by] = cellOf(t, b.lon, b.lat);
  const s = snap(t, ax, ay, ok), g = snap(t, bx, by, ok);
  if (s === null || g === null) return { error: "Start or destination is outside the mapped area or surrounded by no-go terrain." };
  const { w, h } = t, n = w * h, minStep = Math.min(t.dxM, t.dyM), SQ2 = Math.SQRT2;
  const gs = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const gxT = g % w, gyT = (g / w) | 0;
  const hFn = (i: number) => { const dx = Math.abs((i % w) - gxT), dy = Math.abs(((i / w) | 0) - gyT); return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * minStep * 0.95; };
  const heap = new MinHeap(); gs[s] = 0; heap.push(hFn(s), s);
  while (heap.size) {
    const i = heap.pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === g) break;
    const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (done[j] || !ok(j)) continue;
      if (dx && dy && (!ok(y * w + nx) || !ok(ny * w + x))) continue; // no corner cutting through no-go cells
      const len = Math.hypot(dx * t.dxM, dy * t.dyM);
      const ng = gs[i] + len * (t.cost[i] + t.cost[j]) / 80;
      if (ng < gs[j]) { gs[j] = ng; prev[j] = i; heap.push(ng + hFn(j), j); }
    }
  }
  if (!done[g]) return { error: "No walkable route exists between these points under the current slope limits." };

  const cells: number[] = [];
  for (let i = g; i !== -1; i = prev[i]) cells.push(i);
  cells.reverse();
  let dist = 0, time = 0, gain = 0, loss = 0, slopeSum = 0, maxSlope = 0, caution = 0;
  const speedMperMin = (opts.speedKmh ?? WALK_SPEED_KMH) * 1000 / 60;
  const profile: Route["profile"] = [];
  cells.forEach((i, k) => {
    const sl = t.slope[i] / 4; slopeSum += sl; maxSlope = Math.max(maxSlope, sl); if (t.cls[i] === 1) caution++;
    if (k > 0) {
      const j = cells[k - 1], dx = (i % w) - (j % w), dy = ((i / w) | 0) - ((j / w) | 0);
      const len = Math.hypot(dx * t.dxM, dy * t.dyM);
      dist += len; time += len * (t.cost[i] + t.cost[j]) / 80 / speedMperMin;
      const dz = t.elev[i] - t.elev[j]; if (dz > 0) gain += dz; else loss -= dz;
    }
    profile.push({ d: dist, z: t.elev[i], s: sl, c: t.cls[i] });
  });
  const points = cells.map((i) => { const [lon, lat] = lonLatOf(t, (i % w) + 0.5, ((i / w) | 0) + 0.5); return { lon, lat }; });
  const straightM = Math.hypot((bx - ax) * t.dxM, (by - ay) * t.dyM);
  let blocked = false;
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
  for (let k = 0; k <= steps && !blocked; k++) {
    const x = Math.floor(ax + (bx - ax) * k / steps), y = Math.floor(ay + (by - ay) * k / steps);
    if (x >= 0 && y >= 0 && x < w && y < h && !ok(y * w + x)) blocked = true;
  }
  return {
    points, distM: dist, timeMin: time, maxSlopeDeg: maxSlope, meanSlopeDeg: slopeSum / cells.length, gainM: gain, lossM: loss,
    cautionPct: 100 * caution / cells.length, straightM, straightBlocked: blocked, detourPct: straightM > 0 ? 100 * (dist / straightM - 1) : 0, profile
  };
}
