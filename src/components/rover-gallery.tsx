"use client";
import { useEffect, useState } from "react";
import NextImage from "next/image";

type RoverImage = { file: string; sol: number; camera: string; imageId: string; dateUtc: string; credit: string; caption: string; source: string };
type RoverData = { mission: string; note: string; images: RoverImage[] };
const BASE = "/data/regions/jezero/rover";
const SEASON: Record<number, string> = { 51: "Ls 30° · northern spring", 247: "Ls 120° · northern summer", 410: "Ls 209° · northern autumn", 552: "Ls 300° · northern winter" };
const CAMERA: Record<string, string> = { MCZ_LEFT: "Mastcam-Z (left)", NAVCAM_LEFT: "Navcam (left)" };

export default function RoverGallery() {
  const [data, setData] = useState<RoverData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/rover.json`).then((r) => { if (!r.ok) throw new Error("Rover photos not found. Run scripts/fetch_rover_images.py."); return r.json(); })
      .then((d: RoverData) => alive && setData(d)).catch((e) => alive && setError(e instanceof Error ? e.message : "Unable to load rover photos"));
    return () => { alive = false; };
  }, []);
  if (error) return <article className="panel"><div className="empty-state">{error}</div></article>;
  if (!data) return null;
  return (
    <article className="panel rover-panel">
      <div className="panel-top"><span>WHAT THE ROVER SAW · SAME SOLS AS THE CHARTS</span><span className="tag green">NASA/JPL-CALTECH</span></div>
      <p className="fineprint" style={{ marginTop: 0 }}>Ground-level views from Perseverance in Jezero Crater, so a crew knows what the terrain looks like. {data.note}</p>
      <div className="rover-grid">{data.images.map((im) => (
        <figure key={im.file} className="rover-card">
          <NextImage src={`${BASE}/${im.file}`} alt={`Perseverance ${CAMERA[im.camera] ?? im.camera} view on sol ${im.sol}`} width={800} height={600} loading="eager" unoptimized />
          <figcaption><b>Sol {im.sol} · {CAMERA[im.camera] ?? im.camera}</b><small>{SEASON[im.sol] ?? ""}</small><small>{new Date(im.dateUtc).toISOString().slice(0, 10)} · {im.credit}</small>
            <a href={im.source} target="_blank" rel="noreferrer">Original image ↗</a></figcaption>
        </figure>))}</div>
    </article>
  );
}
