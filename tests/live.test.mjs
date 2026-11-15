// Live mission model tests: run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  appendTrail, bearingDeg, conditionsFor, cumulative, destination, distanceM, edgeDistanceM, hourly, makeStorm, marsLocalHour, pointAlong,
  remainingRoute, routeHits, stormZone, thin, trailLengthM
} from "../src/lib/live.ts";

const here = { lat: 18.4663, lon: 77.4298 };

test("distance, bearing and destination agree with each other", () => {
  assert.ok(Math.abs(distanceM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 59158) < 100, "1 degree of latitude is about 59.16 km on Mars");
  const p = destination(here, 90, 10000);
  assert.ok(Math.abs(distanceM(here, p) - 10000) < 1);
  assert.ok(Math.abs(bearingDeg(here, p) - 90) < 0.5);
  assert.ok(p.lon >= 0 && p.lon < 360);
});

test("position along a route, what remains, and thinning keep the ends", () => {
  const line = [{ lat: 0, lon: 10 }, { lat: 0, lon: 10.1 }, { lat: 0, lon: 10.2 }];
  assert.deepEqual(pointAlong(line, 0).point, line[0]);
  assert.deepEqual(pointAlong(line, 1).point, line[2]);
  assert.ok(Math.abs(pointAlong(line, 0.5).point.lon - 10.1) < 1e-9);
  assert.ok(Math.abs(pointAlong(line, 0.25).point.lon - 10.05) < 1e-9);
  const rest = remainingRoute(line, 0.75);
  assert.equal(rest.length, 2); assert.deepEqual(rest[1], line[2]);
  assert.ok(Math.abs(cumulative(line)[2] - distanceM(line[0], line[2])) < 1);
  const many = Array.from({ length: 1000 }, (_, i) => i), small = thin(many, 50);
  assert.equal(small.length, 50); assert.equal(small[0], 0); assert.equal(small[49], 999);
  assert.equal(thin([1, 2, 3], 10).length, 3);
});

test("an approaching storm closes in on the crew and conditions worsen step by step", () => {
  const storm = makeStorm("approaching", here, 57, 0);
  assert.ok(storm);
  const edge = (min) => edgeDistanceM(here, stormZone(storm, min));
  assert.ok(edge(0) > 10000, "starts well away");
  assert.ok(edge(20) < edge(0) && edge(40) < edge(20), "moves toward the crew");
  const levels = [0, 25, 40, 90].map((min) => conditionsFor({ sol: null, localHour: 12, stormEdgeM: edge(min), stormSpeedKmh: storm.speedKmh }));
  const order = ["NOMINAL", "ADVISORY", "WARNING", "STORM"];
  const ranks = levels.map((c) => order.indexOf(c.level));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "level never improves as the storm closes in");
  assert.equal(levels[levels.length - 1].level, "STORM");
  assert.ok(levels[3].dustTau > levels[0].dustTau && levels[3].visibilityKm < levels[0].visibilityKm && levels[3].windMs > levels[0].windMs);
  assert.equal(makeStorm("clear", here, 57, 0), null);
  assert.ok(edgeDistanceM(here, stormZone(makeStorm("storm", here, 57, 0), 0)) < 0, "the storm scenario starts with the crew inside");
});

test("conditions thresholds and the MEDA baseline", () => {
  const level = (edge) => conditionsFor({ sol: null, localHour: 12, stormEdgeM: edge }).level;
  assert.equal(level(null), "NOMINAL"); assert.equal(level(50000), "NOMINAL"); assert.equal(level(20000), "ADVISORY"); assert.equal(level(5000), "WARNING"); assert.equal(level(-1), "STORM");
  const sol = { sol: 51, ls: 30, season: "x", hours: Array.from({ length: 24 }, (_, h) => ({ h, localTempK: 200 + h, pressurePa: 750, windMs: 3 })) };
  const c = conditionsFor({ sol, localHour: 12.5, stormEdgeM: null });
  assert.ok(Math.abs(c.tempC - (212 - 273.15)) < 0.01, "temperature follows the MEDA hours (bin h is centred at h + 0.5)");
  assert.ok(c.daylight); assert.equal(conditionsFor({ sol, localHour: 2, stormEdgeM: null }).daylight, false);
});

test("hourly interpolation wraps around midnight and skips missing hours", () => {
  const hours = [{ h: 0, v: 20 }, { h: 23, v: 10 }];        // bins are ordered by hour, as in the MEDA files
  assert.equal(hourly(hours, (x) => x.v, 0), 15);               // midway between the 23:30 and 00:30 bins
  assert.equal(hourly([{ h: 5 }], (x) => x.v, 3), undefined);
});

test("route hits, local solar time and the recorded trail", () => {
  const zone = { id: "z", label: "z", ...destination(here, 0, 1000), radiusM: 300 };
  const path = [here, destination(here, 0, 500), destination(here, 0, 800), destination(here, 0, 2000)];
  const hit = routeHits(path, [zone]);
  assert.ok(hit.hit && hit.index === 2, "third point is within 300 m of the zone centre");
  assert.equal(routeHits([here], [zone]).hit, false);
  assert.equal(routeHits([here], [zone], 800).hit, true, "a safety margin widens the zone");
  const d = new Date("2026-11-15T12:00:00Z"), h0 = marsLocalHour(d, 0), h15 = marsLocalHour(d, 15);
  assert.ok(h0 >= 0 && h0 < 24);
  assert.ok(Math.abs(((h15 - h0 + 24) % 24) - 1) < 1e-6, "15 degrees east is one hour later");
  let trail = [];
  trail = appendTrail(trail, { ...here, t: 0 }); trail = appendTrail(trail, { ...here, t: 1 });
  assert.equal(trail.length, 1, "a point that has not moved is not recorded again");
  trail = appendTrail(trail, { ...destination(here, 0, 100), t: 2 });
  assert.equal(trail.length, 2); assert.ok(Math.abs(trailLengthM(trail) - 100) < 1);
});

test("a storm that has passed is reported as moving away, with no arrival time", () => {
  const away = conditionsFor({ sol: null, localHour: 12, stormEdgeM: 5000, stormSpeedKmh: 12, departing: true });
  assert.equal(away.level, "ADVISORY"); assert.equal(away.headline, "Storm moving away"); assert.equal(away.stormEtaMin, null);
  const coming = conditionsFor({ sol: null, localHour: 12, stormEdgeM: 5000, stormSpeedKmh: 12 });
  assert.equal(coming.level, "WARNING"); assert.equal(coming.stormEtaMin, 25);
  assert.equal(conditionsFor({ sol: null, localHour: 12, stormEdgeM: -100, departing: true }).level, "STORM", "still inside is still a storm");
});
