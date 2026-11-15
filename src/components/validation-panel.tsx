"use client";
import { useEffect, useState } from "react";
import NextImage from "next/image";

type Validation = {
  source: string; throughSol: number; driveSegmentsInArea: number; drivenKmInArea: number; finding?: string; caveats: string[];
  pathShare: { nogo: number; caution: number; nominal: number }; areaShare: { nogo: number; caution: number; nominal: number };
  slopeDeg: { median: number; p95: number; max: number; overCautionPct: number; overNoGoPct: number }; areaSlopeMedianDeg: number;
  plannerComparison: { drives: number; medianLengthRatio: number; iqrLengthRatio: [number, number]; within25pctOfRealLength: number; medianCorridorPct: number };
};
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export default function ValidationPanel({ base, file, image }: { base: string; file: string; image?: string }) {
  const [v, setV] = useState<Validation | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${base}/${file}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing")))).then((d: Validation) => alive && setV(d)).catch(() => alive && setV(null));
    return () => { alive = false; };
  }, [base, file]);
  if (!v) return null;
  const p = v.plannerComparison;
  return (
    <article className="panel">
      <div className="panel-top"><span>REALITY CHECK · REAL PERSEVERANCE DRIVES</span><span className="tag green">VALIDATION</span></div>
      <p className="jz-why" style={{ marginTop: 0 }}>We tested our safety map and route planner against every real drive of the rover (sol 14 to {v.throughSol}), published by NASA/JPL.</p>
      <div className="jz-stats">
        <div><small>REAL DRIVING CHECKED</small><b>{v.drivenKmInArea} km</b></div>
        <div><small>ROVER PATH ON OUR NO-GO</small><b>{pct(v.pathShare.nogo, 1)}</b></div>
        <div><small>STEEPEST SLOPE CROSSED</small><b>{v.slopeDeg.max}° (limit 25°)</b></div>
        <div><small>MEDIAN SLOPE: ROVER / AREA</small><b>{v.slopeDeg.median}° / {v.areaSlopeMedianDeg}°</b></div>
        <div><small>OUR ROUTE vs REAL LENGTH</small><b>{p.medianLengthRatio}× median</b></div>
        <div><small>WITHIN ±25% OF REAL LENGTH</small><b>{p.within25pctOfRealLength}% of {p.drives}</b></div>
      </div>
      <p className="jz-verdict">The rover spent {pct(v.pathShare.nominal)} of its path on ground we call nominal and {pct(v.pathShare.caution)} on caution ground. It did not avoid slopes (its median is close to the area&apos;s), but it never crossed our no-go limit: its steepest slope was {v.slopeDeg.max}°. For {p.drives} real drives, our planner between the same start and end stayed within 100 m of the real path for a median {p.medianCorridorPct}% of its length.</p>
      {v.finding && <p className="jz-verdict warn"><b>What the check found:</b> {v.finding}</p>}
      {image && <NextImage className="jz-thumb" src={`${base}/${image}`} alt="Every real Perseverance drive drawn over the safety map, and a histogram of the slopes the rover crossed" width={1540} height={704} loading="eager" unoptimized />}
      <p className="fineprint">{v.caveats.join(" ")} Source: {v.source}.</p>
    </article>
  );
}
