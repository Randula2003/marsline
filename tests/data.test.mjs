// Checks that the generated study-area files are complete and consistent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const base = path.resolve("public/data/regions");
const index = JSON.parse(fs.readFileSync(path.join(base, "index.json"), "utf8"));
const png = (file) => { const b = fs.readFileSync(file); assert.equal(b.toString("ascii", 1, 4), "PNG"); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test("index lists at least the detailed Jezero area and the regional areas", () => {
  assert.ok(index.length >= 4);
  assert.ok(index.some((r) => r.id === "jezero" && r.detail === "detailed"));
});

for (const r of index) {
  test(`area ${r.id}: files, dimensions and targets are consistent`, () => {
    const dir = path.join(base, r.id), meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    for (const f of ["grid_data.png", "grid_elev.png", meta.missionMap]) assert.ok(fs.existsSync(path.join(dir, f)), `${f} missing`);
    for (const l of meta.layers) assert.ok(fs.existsSync(path.join(dir, l.file)), `${l.file} missing`);
    for (const f of ["grid_data.png", "grid_elev.png"]) { const d = png(path.join(dir, f)); assert.equal(d.w, meta.grid.width); assert.equal(d.h, meta.grid.height); }
    const [s, w, n, e] = meta.gridBounds; assert.ok(s < n && w < e);
    for (const t of meta.targets) assert.ok(t.lat > s && t.lat < n && t.lon > w && t.lon < e, `${t.id} outside bounds`);
    assert.ok(meta.targets.length >= 3);
    const sh = meta.traversabilityShare; assert.ok(Math.abs(sh.nogo + sh.caution + sh.nominal - 1) < 0.02);
    assert.ok(meta.elevEncoding.scale > 0);
    assert.ok(meta.defaultLayers.every((id) => meta.layers.some((l) => l.id === id) || meta.vectors.includes(id)), "default layer unknown");
  });
}

test("MEDA time series: four seasons, 24 hours each, physically plausible values", () => {
  const d = JSON.parse(fs.readFileSync(path.join(base, "jezero", "meda_timeseries.json"), "utf8"));
  assert.equal(d.sols.length, 4);
  assert.deepEqual(d.sols.map((s) => s.sol), [51, 247, 410, 552]);
  for (const s of d.sols) {
    assert.equal(s.hours.length, 24);
    for (const h of s.hours) {
      if (h.pressurePa !== undefined) assert.ok(h.pressurePa > 400 && h.pressurePa < 1100, `pressure ${h.pressurePa}`);
      for (const k of ["localTempK", "groundTempK"]) if (h[k] !== undefined) assert.ok(h[k] > 140 && h[k] < 320, `${k} ${h[k]}`);
      if (h.humidityPct !== undefined) assert.ok(h.humidityPct >= 0 && h.humidityPct <= 110);
      if (h.windMs !== undefined) assert.ok(h.windMs >= 0 && h.windMs < 60);
    }
    assert.ok(s.hours.filter((h) => h.pressurePa !== undefined).length >= 20, "pressure covers most of the day");
    assert.ok(s.summary.groundTempK, "ground temperature present");
  }
  assert.ok(d.sols[0].summary.windMs && d.sols[1].summary.windMs, "wind exists for the first two sols");
});

test("rover photos: every listed file exists and carries a credit", () => {
  const dir = path.join(base, "jezero", "rover"), d = JSON.parse(fs.readFileSync(path.join(dir, "rover.json"), "utf8"));
  assert.ok(d.images.length >= 8);
  for (const im of d.images) { assert.ok(fs.existsSync(path.join(dir, im.file)), im.file); assert.ok(/NASA/.test(im.credit)); assert.ok(im.source.startsWith("https://")); }
});

for (const r of index) {
  test(`area ${r.id}: has the atmospheric-depth (radiation context) layer`, () => {
    const meta = JSON.parse(fs.readFileSync(path.join(base, r.id, "meta.json"), "utf8"));
    const l = meta.layers.find((x) => x.id === "atmosphere");
    assert.ok(l && l.note && /Context only/.test(l.note), "atmosphere layer with caveat missing");
    assert.ok(fs.existsSync(path.join(base, r.id, l.file)));
  });
}
