// Live mission model: crew position along a route, a simulated dust storm and the conditions they imply.
// Pure functions (no browser, server or alias imports) so they can be tested with `npm test`.
//
// HONESTY NOTE: no live Mars weather feed exists for Jezero. Baseline temperature, pressure and wind come from archived MEDA
// sample sols (real measurements). The dust storm is a SIMULATED SCENARIO the operator switches on, so the app can show how
// routes react. Everything here is labelled "simulated" in the UI.

export type LonLat = { lon: number; lat: number };
export const MARS_RADIUS_M = 3389500;
/** Simulated minutes that pass per real second. */
export const SIM_MIN_PER_SEC = 1;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance on the Mars sphere, metres. */
export function distanceM(a: LonLat, b: LonLat): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** The point `distM` metres from `p` along a bearing. */
export function destination(p: LonLat, bearing: number, distM: number): LonLat {
  const d = distM / MARS_RADIUS_M, br = rad(bearing), lat1 = rad(p.lat), lon1 = rad(p.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lon: ((deg(lon2) % 360) + 360) % 360 };       // Marsline uses east longitude 0 to 360
}

/** Local mean solar time (0 to 24 h) at an east longitude, from a real clock. Mars24 algorithm (Allison and McEwen, 2000). */
export function marsLocalHour(date: Date, lonEast: number): number {
  const jdUt = date.getTime() / 86400000 + 2440587.5;
  const jdTt = jdUt + (37 + 32.184) / 86400;                       // TAI-UTC = 37 s since 2017
  const msd = (jdTt - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtc = 24 * (((msd % 1) + 1) % 1);
  return (((mtc + lonEast / 15) % 24) + 24) % 24;
}

// ---- route progress -----------------------------------------------------------------------------------------------
/** Cumulative distances (m) along a polyline. */
export function cumulative(points: LonLat[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + distanceM(points[i - 1], points[i]));
  return out;
}

/** Position after travelling `frac` (0 to 1) of the way along a polyline, plus the index of the last vertex passed. */
export function pointAlong(points: LonLat[], frac: number): { point: LonLat; index: number } {
  if (!points.length) throw new Error("Empty route");
  if (points.length === 1) return { point: points[0], index: 0 };
  const cum = cumulative(points), total = cum[cum.length - 1];
  const f = Math.min(1, Math.max(0, frac));
  if (total === 0 || f >= 1) return { point: points[points.length - 1], index: points.length - 1 };
  const target = f * total;
  let i = 1; while (i < cum.length - 1 && cum[i] < target) i++;
  const span = cum[i] - cum[i - 1] || 1, t = (target - cum[i - 1]) / span;
  const a = points[i - 1], b = points[i];
  return { point: { lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t }, index: i - 1 };
}

/** The part of a route still ahead after a position: the position itself, then every later vertex. */
export function remainingRoute(points: LonLat[], frac: number): LonLat[] {
  if (points.length < 2) return points;
  const { point, index } = pointAlong(points, frac);
  return [point, ...points.slice(index + 1)];
}

/** Evenly thin a polyline to at most `max` points, always keeping the first and last. */
export function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  if (max < 2) return items.slice(0, Math.max(max, 0));
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.round((i * (items.length - 1)) / (max - 1))]);
  return out;
}

// ---- storm --------------------------------------------------------------------------------------------------------
export type Scenario = "clear" | "approaching" | "storm";
export type StormZone = { id: string; label: string; lat: number; lon: number; radiusM: number };
export type Storm = { startLat: number; startLon: number; radiusM: number; headingDeg: number; speedKmh: number; startMin: number };

/**
 * Build the storm for a scenario. "approaching": a front starts a little outside the crew and moves toward them.
 * "storm": the crew is already inside it. Sized from the study-area extent so it always fits the map.
 */
export function makeStorm(scenario: Scenario, crew: LonLat, extentKm: number, simMin: number): Storm | null {
  if (scenario === "clear") return null;
  const radiusM = Math.max(1500, extentKm * 1000 * 0.14);
  if (scenario === "storm") return { startLat: crew.lat, startLon: crew.lon, radiusM, headingDeg: 90, speedKmh: 4, startMin: simMin };
  const dist = radiusM + extentKm * 1000 * 0.28;                  // front edge about 28 % of the area away
  const from = destination(crew, 300, dist);                       // starts to the north-west
  return { startLat: from.lat, startLon: from.lon, radiusM, headingDeg: bearingDeg(from, crew), speedKmh: Math.max(6, extentKm * 0.35), startMin: simMin };
}

export function stormZone(storm: Storm | null, simMin: number): StormZone | null {
  if (!storm) return null;
  const travelled = (Math.max(0, simMin - storm.startMin) / 60) * storm.speedKmh * 1000;
  const c = destination({ lat: storm.startLat, lon: storm.startLon }, storm.headingDeg, travelled);
  return { id: "storm", label: "Dust storm (simulated)", lat: c.lat, lon: c.lon, radiusM: storm.radiusM };
}

/** Distance from a point to the storm edge (negative when inside). */
export const edgeDistanceM = (p: LonLat, z: StormZone) => distanceM(p, z) - z.radiusM;

/** Do any of these points fall inside (or within `marginM` of) a zone? Returns the first such point. */
export function routeHits<Z extends LonLat & { radiusM: number }>(points: LonLat[], zones: Z[], marginM = 0): { hit: boolean; index: number; zone?: Z } {
  for (let i = 0; i < points.length; i++) for (const z of zones) if (distanceM(points[i], z) <= z.radiusM + marginM) return { hit: true, index: i, zone: z };
  return { hit: false, index: -1 };
}

// ---- conditions ---------------------------------------------------------------------------------------------------
export type MedaHour = { h: number; pressurePa?: number; localTempK?: number; groundTempK?: number; windMs?: number; windDirDeg?: number };
export type MedaSol = { sol: number; ls: number; season: string; hours: MedaHour[] };
export type Level = "NOMINAL" | "ADVISORY" | "WARNING" | "STORM";
export type Conditions = {
  level: Level; tempC: number; groundTempC: number; pressurePa: number; windMs: number; gustMs: number; dustTau: number;
  visibilityKm: number; localHour: number; daylight: boolean; stormEdgeKm: number | null; stormEtaMin: number | null; headline: string; advice: string;
};

/** Linear interpolation of hourly bins (centres at h + 0.5), wrapping at midnight; undefined when fewer than two bins have data. */
export function hourly(hours: MedaHour[], pick: (h: MedaHour) => number | undefined, at: number): number | undefined {
  const pts = hours.map((x) => [x.h + 0.5, pick(x)] as const).filter((p): p is readonly [number, number] => p[1] !== undefined && Number.isFinite(p[1]));
  if (pts.length < 2) return pts[0]?.[1];
  const t = ((at % 24) + 24) % 24;
  let before = pts[pts.length - 1], after = pts[0];
  for (let i = 0; i < pts.length; i++) if (pts[i][0] <= t) { before = pts[i]; after = pts[(i + 1) % pts.length]; }
  const span = (((after[0] - before[0]) % 24) + 24) % 24 || 24, pos = (((t - before[0]) % 24) + 24) % 24;
  return before[1] + ((after[1] - before[1]) * pos) / span;
}

const LEVEL_ORDER: Level[] = ["NOMINAL", "ADVISORY", "WARNING", "STORM"];
export const levelRank = (l: Level) => LEVEL_ORDER.indexOf(l);
const CLEAR_TAU = 0.5;                       // ASSUMPTION: typical clear-sky dust optical depth at Jezero
const STORM_TAU = 3.5;                       // ASSUMPTION: a regional dust storm

export function conditionsFor(a: { sol: MedaSol | null; localHour: number; stormEdgeM: number | null; stormSpeedKmh?: number; departing?: boolean }): Conditions {
  const hours = a.sol?.hours ?? [];
  const airK = hourly(hours, (h) => h.localTempK, a.localHour) ?? (a.localHour > 6 && a.localHour < 18 ? 230 : 195);
  const gndK = hourly(hours, (h) => h.groundTempK, a.localHour) ?? airK;
  const baseP = hourly(hours, (h) => h.pressurePa, a.localHour) ?? 750;
  const baseW = hourly(hours, (h) => h.windMs, a.localHour) ?? 3;
  const edge = a.stormEdgeM;
  const inside = edge !== null && edge <= 0;
  // 0 = far away, 1 = on the crew: ramps up over 30 km so conditions worsen smoothly as the front approaches.
  const closeness = edge === null ? 0 : inside ? 1 : Math.max(0, 1 - edge / 30000);
  const tau = CLEAR_TAU + (STORM_TAU - CLEAR_TAU) * closeness;
  const wind = baseW + 14 * closeness, gust = wind * (1.6 + closeness * 0.4);
  const cooling = 18 * closeness * (a.localHour > 7 && a.localHour < 17 ? 1 : 0.3);          // dust blocks the sun: colder days
  const away = !!a.departing && !inside;                   // the storm has passed and is moving off: improving, not a warning
  const level: Level = inside ? "STORM" : edge !== null && edge < 10000 ? (away ? "ADVISORY" : "WARNING") : edge !== null && edge < 30000 ? "ADVISORY" : "NOMINAL";
  const etaMin = edge !== null && edge > 0 && a.stormSpeedKmh && !away ? Math.round((edge / 1000 / a.stormSpeedKmh) * 60) : null;
  const copy: Record<Level, [string, string]> = {
    NOMINAL: ["Conditions nominal", "No hazard detected. Continue the planned traverse."],
    ADVISORY: ["Dust front detected", "A dust front is in range. Keep the alternate route ready and watch the trend."],
    WARNING: ["Dust storm approaching", "Visibility will drop soon. Take the detour or shelter route now."],
    STORM: ["Inside the dust storm", "Visibility is poor. Move to shelter along the shelter route and report your position."]
  };
  if (away && level === "ADVISORY") copy.ADVISORY = ["Storm moving away", "The storm has passed the crew. Conditions are improving; keep the alternate route in mind."];
  return {
    level, tempC: airK - 273.15 - cooling, groundTempC: gndK - 273.15 - cooling, pressurePa: baseP, windMs: wind, gustMs: gust,
    dustTau: tau, visibilityKm: Math.max(0.5, 12.5 / tau), localHour: a.localHour, daylight: a.localHour >= 6 && a.localHour < 18,
    stormEdgeKm: edge === null ? null : edge / 1000, stormEtaMin: etaMin, headline: copy[level][0], advice: copy[level][1]
  };
}

// ---- trail ---------------------------------------------------------------------------------------------------------
export type TrailPoint = LonLat & { t: number };       // t = simulated minute
/** Append a position when it has moved at least `minGapM` from the last one (keeps the saved trail small). */
export function appendTrail(trail: TrailPoint[], p: TrailPoint, minGapM = 30): TrailPoint[] {
  const last = trail[trail.length - 1];
  return last && distanceM(last, p) < minGapM ? trail : [...trail, p];
}
export const trailLengthM = (trail: LonLat[]) => cumulative(trail).at(-1) ?? 0;
