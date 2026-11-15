"use client";
import { useEffect, useMemo, useState } from "react";
import { planWindow } from "@/lib/eva";

type Hour = { h: number; localTempK?: number; groundTempK?: number };
type Sol = { sol: number; ls: number; season: string; ltstOffsetH?: number; hours: Hour[] };
type Season = { label: string; ls: number; ltstOffsetH?: number; air?: (number | undefined)[]; ground?: (number | undefined)[] };
const DEFAULT_SEASONS: Season[] = [{ label: "Spring", ls: 30 }, { label: "Summer", ls: 120 }, { label: "Autumn", ls: 210 }, { label: "Winter", ls: 300 }];
const hhmm = (h: number) => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const toC = (k: number | undefined) => (k === undefined ? undefined : k - 273.15);

export default function EvaWindow({ latDeg, routeHours, weatherUrl }: { latDeg: number; routeHours: number; weatherUrl?: string }) {
  const [sols, setSols] = useState<Sol[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [roundTrip, setRoundTrip] = useState(true);
  const [minTempC, setMinTempC] = useState(-55);
  useEffect(() => {
    if (!weatherUrl) return;
    let alive = true;
    fetch(weatherUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing")))).then((d: { sols: Sol[] }) => alive && setSols(d.sols)).catch(() => alive && setSols(null));
    return () => { alive = false; };
  }, [weatherUrl]);

  const seasons: Season[] = useMemo(() => (sols ? sols.map((s) => ({
    label: s.season.replace("Northern ", "").replace(/^./, (c) => c.toUpperCase()), ls: s.ls, ltstOffsetH: s.ltstOffsetH,
    air: Array.from({ length: 24 }, (_, h) => toC(s.hours.find((x) => x.h === h)?.localTempK)), ground: Array.from({ length: 24 }, (_, h) => toC(s.hours.find((x) => x.h === h)?.groundTempK))
  })) : DEFAULT_SEASONS), [sols]);
  const season = seasons[Math.min(idx, seasons.length - 1)];
  const durationH = routeHours * (roundTrip ? 2 : 1);
  const hasTemp = Boolean(season.air && season.air.some((v) => v !== undefined));
  const result = useMemo(() => planWindow({ latDeg, lsDeg: season.ls, ltstOffsetH: season.ltstOffsetH, durationH, minTempC: hasTemp ? minTempC : undefined, tempHourlyC: season.air, groundHourlyC: season.ground }),
    [latDeg, season, durationH, minTempC, hasTemp]);

  const W = 320, H = 118, L = 26, R = 6, T = 8, B = 20, x = (h: number) => L + (h / 24) * (W - L - R);
  const airPts = hasTemp ? Array.from({ length: 24 }, (_, h) => [h + 0.5, season.air?.[h]] as const).filter((p): p is readonly [number, number] => p[1] !== undefined) : [];
  const yT = (c: number) => { const lo = -90, hi = 0; return T + (1 - (Math.min(hi, Math.max(lo, c)) - lo) / (hi - lo)) * (H - T - B); };
  const dl = result.daylight;
  return (
    <div className="eva">
      <div className="jz-group">SPACEWALK WINDOW · SUN AND MEASURED TEMPERATURE</div>
      <div className="eva-seasons" role="tablist" aria-label="Season">{seasons.map((s, i) => <button key={s.label} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => setIdx(i)}>{s.label}<small>Ls {Math.round(s.ls)}°</small></button>)}</div>
      <div className="jz-assume">
        <label className="eva-check"><input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} /> Include the walk back ({durationH.toFixed(1)} h in total)</label>
        {hasTemp && <label><span>Coldest air temperature accepted <b>{minTempC} °C</b></span><input type="range" min={-80} max={-20} step={1} value={minTempC} onChange={(e) => setMinTempC(Number(e.target.value))} /></label>}
      </div>
      {result.feasible && result.best ? <p className="jz-verdict"><b>Start between {hhmm(result.windows[0].from)} and {hhmm(result.windows[0].to)}</b> (local mean solar time). Best start <b>{hhmm(result.best.start)}</b>, back by {hhmm(result.best.end)}{result.best.coldestAirC !== undefined ? `, coldest air ${result.best.coldestAirC.toFixed(0)} °C` : ""}{result.best.coldestGroundC !== undefined ? `, coldest ground ${result.best.coldestGroundC.toFixed(0)} °C` : ""}, {result.best.daylightMarginH.toFixed(1)} h of daylight to spare.</p>
        : <p className="jz-verdict warn">{result.reason}</p>}
      <svg className="eva-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Day and night, measured temperature and the recommended walking window across the Martian day">
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#0c1117" />
        {dl && <rect x={x(Math.max(0, dl.sunrise))} y={T} width={x(Math.min(24, dl.sunset)) - x(Math.max(0, dl.sunrise))} height={H - T - B} fill="#f5d3b2" opacity="0.16" />}
        {[0, 6, 12, 18, 24].map((h) => <g key={h}><line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="#2e3944" strokeWidth="0.5" /><text x={x(h)} y={H - 6} textAnchor="middle" fontSize="8" fill="#929eaa">{h}</text></g>)}
        {hasTemp && <><line x1={L} x2={W - R} y1={yT(minTempC)} y2={yT(minTempC)} stroke="#f87171" strokeWidth="0.8" strokeDasharray="3 3" />
          <polyline fill="none" stroke="#38bdf8" strokeWidth="1.8" points={airPts.map(([h, v]) => `${x(h).toFixed(1)},${yT(v).toFixed(1)}`).join(" ")} />
          {[-80, -40, 0].map((c) => <text key={c} x={L - 3} y={yT(c) + 3} textAnchor="end" fontSize="8" fill="#929eaa">{c}</text>)}</>}
        {result.best && <rect x={x(result.best.start)} y={T} width={Math.max(1, x(Math.min(24, result.best.end)) - x(result.best.start))} height={H - T - B} fill="#4ade80" opacity="0.28" stroke="#4ade80" strokeWidth="0.8" />}
        {result.windows.map((w) => <rect key={w.from} x={x(w.from)} y={H - B - 4} width={Math.max(2, x(w.to) - x(w.from))} height={4} fill="#4ade80" />)}
      </svg>
      <p className="fineprint">Cream = daylight ({dl ? `${hhmm(dl.sunrise)} to ${hhmm(dl.sunset)}` : "none"}); blue = measured local air temperature{hasTemp ? "" : " (not available for this area)"}; green = the recommended walk; green bar = every allowed start time. Sun position is computed from latitude and season{season.ltstOffsetH !== undefined ? " with the equation of time measured from the MEDA files" : " (equation of time not applied, up to about 0.7 h of error)"}. The temperature limit is your own choice, not a real suit specification.</p>
    </div>
  );
}
