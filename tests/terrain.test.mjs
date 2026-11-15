// Route planner tests on a synthetic grid: run with `npm test` (Node 22.6+).
import test from "node:test";
import assert from "node:assert/strict";
import { cellOf, lonLatOf, planRoute, probe } from "../src/lib/terrain.ts";

function grid(w, h, blocked) {
  const n = w * h, cls = new Uint8Array(n).fill(2), cost = new Uint8Array(n).fill(40);
  blocked.forEach(([x, y]) => { cls[y * w + x] = 0; });
  return {
    meta: { grid: { dlon: 0.001, dlat: 0.001, mPerDeg: 59274, width: w, height: h, stepM: 59 }, gridBounds: [0, 0, 1, 1], thresholds: {} },
    w, h, west: 0, north: 1, slope: new Uint8Array(n), cost, cls, elev: new Float32Array(n), dxM: 59, dyM: 59, base: ""
  };
}
const at = (t, x, y) => { const [lon, lat] = lonLatOf(t, x + 0.5, y + 0.5); return { lon, lat }; };

test("cell and lon/lat conversion are inverse", () => {
  const t = grid(10, 10, []);
  const [lon, lat] = lonLatOf(t, 3.25, 7.5), [gx, gy] = cellOf(t, lon, lat);
  assert.ok(Math.abs(gx - 3.25) < 1e-9 && Math.abs(gy - 7.5) < 1e-9);
});

test("route goes around a wall through the gap and never enters blocked cells", () => {
  const wall = Array.from({ length: 18 }, (_, y) => [10, y]);            // wall at x=10, gap at y=18..19
  const t = grid(20, 20, wall);
  const r = planRoute(t, at(t, 2, 2), at(t, 18, 2));
  assert.ok(!("error" in r), "route should exist");
  assert.ok(r.straightBlocked, "straight line crosses the wall");
  assert.ok(r.distM > r.straightM * 1.5, "route detours");
  for (const p of r.points) { const [gx, gy] = cellOf(t, p.lon, p.lat); assert.notEqual(t.cls[Math.floor(gy) * t.w + Math.floor(gx)], 0); }
});

test("a straight open route is about as long as the straight line", () => {
  const t = grid(20, 20, []);
  const r = planRoute(t, at(t, 2, 5), at(t, 17, 5));
  assert.ok(!("error" in r));
  assert.ok(Math.abs(r.distM - r.straightM) / r.straightM < 0.05);
  assert.equal(r.straightBlocked, false);
});

test("a fully blocked wall gives an error, not a crash", () => {
  const wall = Array.from({ length: 20 }, (_, y) => [10, y]);
  const t = grid(20, 20, wall);
  const r = planRoute(t, at(t, 2, 2), at(t, 18, 2));
  assert.ok("error" in r);
});

test("probe returns null outside the grid and reports slope inside", () => {
  const t = grid(10, 10, []); t.slope[0] = 20;                             // 5 degrees (slope*4 encoding)
  assert.equal(probe(t, -1, 3), null);
  assert.equal(probe(t, 0.5, 0.5).slopeDeg, 5);
});

test("a stricter no-go slope blocks steep cells and a slower speed lengthens the walk time", () => {
  const t = grid(20, 20, []);
  for (let y = 0; y < 20; y++) t.slope[y * 20 + 10] = 20 * 4;                 // a 20 degree ridge across x=10
  const open = planRoute(t, at(t, 2, 5), at(t, 17, 5));
  assert.ok(!("error" in open) && open.straightBlocked === false);
  const strict = planRoute(t, at(t, 2, 5), at(t, 17, 5), { blockSlopeDeg: 15 });
  assert.ok("error" in strict, "ridge spans the whole grid, so no route under a 15 degree limit");
  const slow = planRoute(t, at(t, 2, 5), at(t, 8, 5), { speedKmh: 1.5 }), fast = planRoute(t, at(t, 2, 5), at(t, 8, 5), { speedKmh: 3 });
  assert.ok(Math.abs(slow.timeMin / fast.timeMin - 2) < 0.01);
});
