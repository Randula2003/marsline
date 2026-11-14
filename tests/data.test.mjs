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
