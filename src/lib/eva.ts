// Spacewalk-window maths: when can a walk of a given length be done in daylight and above a minimum temperature?
// Pure functions (no browser or server APIs) so they can be tested with `npm test`.
//
// Time convention: everything is in Local Mean Solar Time (LMST) hours, 0 to 24, the clock the Perseverance team and our weather
// charts use. The sun's position depends on Local TRUE Solar Time (LTST); `ltstOffsetH` is LTST minus LMST (the equation of time,
// measured from the MEDA files for the Jezero sols; 0 is used where it is unknown, an error of up to about 0.7 h).

export const MARS_OBLIQUITY_DEG = 25.19;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Solar declination (degrees) for a solar longitude Ls (degrees). Standard approximation, good to about 1 degree. */
export const declinationDeg = (lsDeg: number) => deg(Math.asin(Math.sin(rad(MARS_OBLIQUITY_DEG)) * Math.sin(rad(lsDeg))));

/** Sun elevation above the horizon (degrees) at latitude `latDeg`, solar longitude `lsDeg`, local true solar time `ltstHour` (12 = noon). */
export function sunElevationDeg(latDeg: number, lsDeg: number, ltstHour: number): number {
  const phi = rad(latDeg), dec = rad(declinationDeg(lsDeg)), h = rad((ltstHour - 12) * 15);
  return deg(Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)));
}

/** Sunrise and sunset in true solar time for a minimum sun elevation. Returns null when the sun never gets that high (polar night). */
export function daylightLtst(latDeg: number, lsDeg: number, minElevDeg = 0): { sunrise: number; sunset: number } | null {
  const phi = rad(latDeg), dec = rad(declinationDeg(lsDeg));
  const c = (Math.sin(rad(minElevDeg)) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (c > 1) return null;
  if (c < -1) return { sunrise: 0, sunset: 24 };
  const half = deg(Math.acos(c)) / 15;
  return { sunrise: 12 - half, sunset: 12 + half };
}

/** Linear interpolation of 24 hourly values (bin centres at h + 0.5), wrapping around midnight. Missing bins are skipped. */
export function interpHourly(values: (number | undefined)[], hour: number): number | undefined {
  const known = values.map((v, i) => (v === undefined ? null : [i + 0.5, v] as [number, number])).filter((x): x is [number, number] => x !== null);
  if (known.length < 2) return undefined;
  const t = ((hour % 24) + 24) % 24;
  let before = known[known.length - 1], after = known[0];
  for (let i = 0; i < known.length; i++) if (known[i][0] <= t) { before = known[i]; after = known[(i + 1) % known.length]; }
  const span = (((after[0] - before[0]) % 24) + 24) % 24 || 24, pos = (((t - before[0]) % 24) + 24) % 24;
  return before[1] + ((after[1] - before[1]) * pos) / span;
}

export type WindowInput = {
  latDeg: number; lsDeg: number; ltstOffsetH?: number; durationH: number; minSunElevDeg?: number;
  minTempC?: number; tempHourlyC?: (number | undefined)[]; groundHourlyC?: (number | undefined)[]; stepH?: number;
};
export type WindowResult = {
  feasible: boolean; reason: string;
  daylight: { sunrise: number; sunset: number; hours: number } | null;   // LMST
  windows: { from: number; to: number }[];                                // feasible START times (LMST hours)
  best?: { start: number; end: number; coldestAirC?: number; coldestGroundC?: number; daylightMarginH: number };
};

export function planWindow(inp: WindowInput): WindowResult {
  const off = inp.ltstOffsetH ?? 0, step = inp.stepH ?? 0.25, minSun = inp.minSunElevDeg ?? 0;
  const dl = daylightLtst(inp.latDeg, inp.lsDeg, minSun);
  const daylight = dl ? { sunrise: dl.sunrise - off, sunset: dl.sunset - off, hours: dl.sunset - dl.sunrise } : null;
  if (!daylight) return { feasible: false, reason: "The sun does not rise above the minimum elevation at this latitude and season.", daylight, windows: [] };
  if (inp.durationH > daylight.hours) return { feasible: false, reason: `The walk (${inp.durationH.toFixed(1)} h) is longer than the daylight (${daylight.hours.toFixed(1)} h). Split it into several excursions.`, daylight, windows: [] };

  const starts: number[] = [];
  let bestScore = -Infinity, best: WindowResult["best"];
  let warmestPossible = -Infinity;
  for (let s = 0; s < 24; s += step) {
    let ok = true, coldAir = Infinity, coldGround = Infinity;
    const n = Math.max(1, Math.ceil(inp.durationH / step));
    for (let k = 0; k <= n; k++) {
      const t = s + Math.min(k * step, inp.durationH);
      if (sunElevationDeg(inp.latDeg, inp.lsDeg, t + off) < minSun) { ok = false; break; }
      const air = inp.tempHourlyC ? interpHourly(inp.tempHourlyC, t) : undefined, gnd = inp.groundHourlyC ? interpHourly(inp.groundHourlyC, t) : undefined;
      if (air !== undefined) coldAir = Math.min(coldAir, air);
      if (gnd !== undefined) coldGround = Math.min(coldGround, gnd);
    }
    if (!ok) continue;
    if (Number.isFinite(coldAir)) warmestPossible = Math.max(warmestPossible, coldAir);
    if (inp.minTempC !== undefined && Number.isFinite(coldAir) && coldAir < inp.minTempC) continue;
    starts.push(s);
    const margin = daylight.sunset - (s + inp.durationH);
    const score = (Number.isFinite(coldAir) ? coldAir : 0) + 0.01 * margin;       // warmest coldest-point first, then more daylight margin
    if (score > bestScore) { bestScore = score; best = { start: s, end: s + inp.durationH, coldestAirC: Number.isFinite(coldAir) ? coldAir : undefined, coldestGroundC: Number.isFinite(coldGround) ? coldGround : undefined, daylightMarginH: margin }; }
  }
  const windows: { from: number; to: number }[] = [];
  for (const s of starts) {
    const last = windows[windows.length - 1];
    if (last && s - last.to <= step + 1e-9) last.to = s; else windows.push({ from: s, to: s });
  }
  if (!starts.length) {
    const tempNote = inp.minTempC !== undefined && Number.isFinite(warmestPossible) ? ` Even the best daylight start is never warmer than ${warmestPossible.toFixed(0)} °C at its coldest point (your limit is ${inp.minTempC} °C).` : "";
    return { feasible: false, reason: `No start time keeps the whole walk in daylight and warm enough.${tempNote}`, daylight, windows };
  }
  return { feasible: true, reason: "", daylight, windows, best };
}
