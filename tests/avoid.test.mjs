// Route planning around storm and hazard zones (the `avoid` option), on a synthetic open grid: run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { cellOf, lonLatOf, planRoute } from "../src/lib/terrain.ts";

function grid(w, h) {
  const n = w * h;
  return {
    meta: { grid: { dlon: 0.001, dlat: 0.001, mPerDeg: 59274, width: w, height: h, stepM: 59 }, gridBounds: [0, 0, 1, 1], thresholds: {} },
    w, h, west: 0, north: 1, slope: new Uint8Array(n), cost: new Uint8Array(n).fill(40), cls: new Uint8Array(n).fill(2), elev: new Float32Array(n), dxM: 59, dyM: 59, base: ""
  };
}
const at = (t, x, y) => { const [lon, lat] = lonLatOf(t, x + 0.5, y + 0.5); return { lon, lat }; };

test("the route goes around a storm, and a destination inside one is reported unreachable", () => {
  const t = grid(30, 20);
  const a = at(t, 2, 10), b = at(t, 27, 10), zone = { ...at(t, 15, 10), radiusM: 5 * 59 };     // 5-cell storm in the middle
  const direct = planRoute(t, a, b), around = planRoute(t, a, b, { avoid: [zone] });
  assert.ok(!("error" in direct) && !("error" in around));
  assert.ok(around.distM > direct.distM * 1.05, "detour is longer");
  for (const p of around.points) { const [gx, gy] = cellOf(t, p.lon, p.lat); assert.ok(Math.hypot((gx - 15.5) * 59, (gy - 10.5) * 59) > zone.radiusM - 1, "no point inside the zone"); }
  assert.equal(around.straightBlocked, false, "a storm is not reported as no-go terrain");
  const inside = planRoute(t, a, at(t, 15, 10), { avoid: [zone] });
  assert.ok("error" in inside && /inside a hazard/.test(inside.error));
});

test("a wall of zones leaves no route, and a start inside a zone can still walk out", () => {
  const t = grid(30, 20);
  const wall = Array.from({ length: 9 }, (_, i) => ({ ...at(t, 15, i * 2.5), radiusM: 2 * 59 }));
  const blocked = planRoute(t, at(t, 3, 10), at(t, 27, 10), { avoid: wall });
  assert.ok("error" in blocked && /avoids/.test(blocked.error));
  const trapped = planRoute(t, at(t, 3, 10), at(t, 27, 3), { avoid: [{ ...at(t, 3, 10), radiusM: 4 * 59 }] });
  assert.ok(!("error" in trapped), "leaving a storm must stay possible");
});
