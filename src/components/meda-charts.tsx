"use client";
import { useEffect, useMemo, useState } from "react";

type Hour = { h: number; pressurePa?: number; localTempK?: number; humidityPct?: number; groundTempK?: number; windMs?: number; windDirDeg?: number };
type SolSeries = { sol: number; ls: number; season: string; hours: Hour[]; summary: Record<string, [number, number] | null> };
type MedaData = { source: string; location: string; notes: string[]; sols: SolSeries[] };
type Line = { label: string; color: string; values: (number | undefined)[] };

const COLORS = ["#38bdf8", "#f59e0b", "#c4b5fd", "#34d399"];
const K = (v: number | undefined) => (v === undefined ? undefined : v - 273.15);

function path(values: (number | undefined)[], x: (h: number) => number, y: (v: number) => number) {
  let d = "", pen = false;
  values.forEach((v, h) => { if (v === undefined) { pen = false; return; } d += `${pen ? "L" : "M"}${x(h + 0.5).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; });
  return d;
}

function LineChart({ title, unit, lines, digits = 0 }: { title: string; unit: string; lines: Line[]; digits?: number }) {
  const W = 380, H = 205, L = 46, R = 10, T = 12, B = 30;
  const all = lines.flatMap((l) => l.values.filter((v): v is number => v !== undefined));
  if (!all.length) return <div className="meda-chart"><b>{title}</b><div className="empty-state">No data for the selected seasons.</div></div>;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (h: number) => L + (h / 24) * (W - L - R), y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const yTicks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  return (
    <div className="meda-chart">
      <div className="meda-chart-head"><b>{title}</b><small>{unit}</small></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${lines.map((l) => l.label).join(", ")} by local solar hour`}>
        {yTicks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#2e3944" strokeWidth="0.6" /><text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#929eaa">{t.toFixed(digits)}</text></g>)}
        {[0, 6, 12, 18, 24].map((h) => <g key={h}><line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="#2e3944" strokeWidth="0.6" /><text x={x(h)} y={H - B + 14} textAnchor="middle" fontSize="9" fill="#929eaa">{h}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#929eaa">Local mean solar time (hour)</text>
        {lines.map((l) => <path key={l.label} d={path(l.values, x, y)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" />)}
      </svg>
    </div>
  );
}

const range = (r: [number, number] | null | undefined, f: (v: number) => string) => (r ? `${f(r[0])} to ${f(r[1])}` : "no data");

export default function MedaCharts() {
  const [data, setData] = useState<MedaData | null>(null);
  const [error, setError] = useState("");
  const [off, setOff] = useState<Record<number, boolean>>({});
  useEffect(() => {
    let alive = true;
    fetch("/data/regions/jezero/meda_timeseries.json").then((r) => { if (!r.ok) throw new Error("MEDA time series not found. Run notebooks/01_feature_engineering.ipynb."); return r.json(); })
      .then((d: MedaData) => alive && setData(d)).catch((e) => alive && setError(e instanceof Error ? e.message : "Unable to load MEDA time series"));
    return () => { alive = false; };
  }, []);
  const shown = useMemo(() => (data?.sols ?? []).map((s, i) => ({ s, color: COLORS[i % COLORS.length] })).filter(({ s }) => !off[s.sol]), [data, off]);
  const make = (pick: (h: Hour) => number | undefined, label: (s: SolSeries) => string): Line[] =>
    shown.map(({ s, color }) => ({ label: label(s), color, values: Array.from({ length: 24 }, (_, h) => pick(s.hours.find((x) => x.h === h) ?? { h })) }));
  const lbl = (s: SolSeries) => `Sol ${s.sol} · Ls ${s.ls}°`;

  if (error) return <article className="panel"><div className="empty-state">{error}</div></article>;
  if (!data) return <article className="panel"><div className="empty-state">Loading measured conditions…</div></article>;
  return (
    <article className="panel meda-panel">
      <div className="panel-top"><span>MEASURED BY PERSEVERANCE · A TYPICAL DAY PER SEASON</span><span className="tag green">NASA PDS · MEDA</span></div>
      <div className="meda-legend">{data.sols.map((s, i) => <button key={s.sol} className={off[s.sol] ? "off" : ""} onClick={() => setOff((o) => ({ ...o, [s.sol]: !o[s.sol] }))} aria-pressed={!off[s.sol]}>
        <i style={{ background: COLORS[i % COLORS.length] }} />Sol {s.sol}<small>Ls {s.ls}° · {s.season}</small></button>)}</div>
      <div className="meda-grid">
        <LineChart title="Local temperature (humidity sensor)" unit="°C" lines={make((h) => K(h.localTempK), lbl)} />
        <LineChart title="Ground brightness temperature (TIRS)" unit="°C" lines={make((h) => K(h.groundTempK), lbl)} />
        <LineChart title="Air pressure" unit="Pa" lines={make((h) => h.pressurePa, lbl)} />
        <LineChart title="Relative humidity" unit="%" lines={make((h) => h.humidityPct, lbl)} digits={1} />
        <LineChart title="Wind speed (sols with wind data)" unit="m/s" lines={make((h) => h.windMs, lbl)} digits={1} />
      </div>
      <div className="table-wrap"><table><thead><tr><th>SOL</th><th>SEASON (Ls)</th><th>LOCAL TEMP</th><th>GROUND TEMP</th><th>PRESSURE</th><th>WIND</th></tr></thead><tbody>
        {data.sols.map((s) => <tr key={s.sol}><td>{s.sol}</td><td>{s.season} ({s.ls}°)</td><td>{range(s.summary.localTempK, (v) => `${(v - 273.15).toFixed(0)} °C`)}</td><td>{range(s.summary.groundTempK, (v) => `${(v - 273.15).toFixed(0)} °C`)}</td><td>{range(s.summary.pressurePa, (v) => `${v.toFixed(0)} Pa`)}</td><td>{s.summary.windMs ? range(s.summary.windMs, (v) => `${v.toFixed(1)} m/s`) : "no wind file"}</td></tr>)}
      </tbody></table></div>
      <p className="fineprint">{data.location}. {data.notes.join(" ")} Source: {data.source}.</p>
    </article>
  );
}
