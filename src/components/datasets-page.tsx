"use client";
import { useState } from "react";
import NextImage from "next/image";
import { DATASETS, STATUS_LABEL, type DatasetStatus } from "@/lib/datasets";

const FILTERS: [string, (s: DatasetStatus) => boolean][] = [["All", () => true], ["Used in the app", (s) => s === "used"], ["Reference and context", (s) => s === "reference" || s === "context"], ["Not used", (s) => s === "not-used"]];
const TAG: Record<DatasetStatus, string> = { used: "green", reference: "", context: "", "not-used": "orange" };

export default function DatasetsPage({ onOpenMap }: { onOpenMap: () => void }) {
  const [filter, setFilter] = useState(0);
  const used = DATASETS.filter((d) => d.status === "used").length;
  const shown = DATASETS.filter((d) => FILTERS[filter][1](d.status));
  const fileCount = new Set(DATASETS.flatMap((d) => d.files)).size;
  return (
    <>
      <div className="metric-grid four">
        <article className="metric-card"><small>DATASETS LISTED</small><b>{DATASETS.length}</b></article>
        <article className="metric-card"><small>USED IN THE APP</small><b>{used}</b></article>
        <article className="metric-card"><small>FILES IN THE REPOSITORY</small><b>{fileCount}</b></article>
        <article className="metric-card"><small>AGENCIES: NASA, ESA, USGS</small><b>3</b></article>
      </div>
      <p className="muted" style={{ margin: "14px 0" }}>Every dataset from your supplied zip and every dataset fetched from NASA is listed here with where it comes from, how it is used, and where the derived files are in the repository. Items that the app does not use are marked, with the reason.</p>
      <div className="jz-tabs" role="tablist" aria-label="Filter datasets">{FILTERS.map(([label], i) => <button key={label} role="tab" aria-selected={i === filter} className={`jz-tab ${i === filter ? "on" : ""}`} onClick={() => setFilter(i)}>{label}</button>)}</div>
      <div className="ds-grid">{shown.map((d) => (
        <article className="panel ds-card" key={d.id}>
          {d.preview && <NextImage className="ds-preview" src={`/data/datasets/${d.preview}`} alt={`Preview of ${d.name}`} width={640} height={420} loading="eager" unoptimized />}
          <div className="ds-body">
            <div className="ds-tags"><span className={`tag ${TAG[d.status]}`}>{STATUS_LABEL[d.status]}</span><span className="tag">{d.kind}</span></div>
            <h3>{d.name}</h3>
            <small className="ds-meta">{d.agency} · {d.resolution} · {d.coverage}</small>
            <small className="ds-meta">{d.provided}</small>
            {d.usedFor.length > 0 && <><div className="jz-group">HOW MARSLINE USES IT</div><ul>{d.usedFor.map((u) => <li key={u}>{u}</li>)}</ul></>}
            {d.note && <p className="fineprint">{d.note}</p>}
            {d.files.length > 0 && <p className="ds-files"><b>Files:</b> {d.files.slice(0, 4).map((f) => <a key={f} href={`/data/${f}`} target="_blank" rel="noreferrer">{f.split("/").pop()}</a>)}{d.files.length > 4 ? ` and ${d.files.length - 4} more` : ""}</p>}
            <p className="ds-links">{d.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</p>
            <small className="ds-credit">Credit: {d.credit}</small>
          </div>
        </article>))}</div>
      <button className="button primary" onClick={onOpenMap}>SEE THE DATA ON THE SURFACE MAP →</button>
    </>
  );
}
