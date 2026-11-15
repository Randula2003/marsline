// Handoff record validation: run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { handoffSchema } from "../src/lib/validation.ts";

const base = {
  title: "Base to T1", regionId: "jezero", plannedRoute: [{ lat: 18.46, lon: 77.43 }], trail: [{ lat: 18.46, lon: 77.43, t: 0 }], distanceTraveledM: 120,
  lastPosition: { lat: 18.46, lon: 77.43 },
  conditions: { level: "NOMINAL", scenario: "clear", headline: "Conditions nominal", tempC: -40, windMs: 3, pressurePa: 750, dustTau: 0.5, visibilityKm: 25, localHour: 12 }
};

test("a real handoff record is accepted and gets defaults", () => {
  const ok = handoffSchema.parse(base);
  assert.equal(ok.callsign, "ASTRONAUT-01"); assert.equal(ok.reason, "manual"); assert.deepEqual(ok.hazards, []);
  assert.equal(ok.storm, null); assert.equal(ok.alternate, null); assert.equal(ok.start, null);
});

test("bad coordinates, oversize trails and unknown levels are rejected", () => {
  assert.ok(!handoffSchema.safeParse({ ...base, lastPosition: { lat: 18, lon: 400 } }).success);
  assert.ok(!handoffSchema.safeParse({ ...base, trail: Array.from({ length: 601 }, () => ({ lat: 1, lon: 1, t: 0 })) }).success);
  assert.ok(!handoffSchema.safeParse({ ...base, conditions: { ...base.conditions, level: "PANIC" } }).success);
  assert.ok(handoffSchema.safeParse({ ...base, hazards: [{ label: "Boulder field", lat: 18.4, lon: 77.4, radiusM: 300 }], storm: { lat: 18.4, lon: 77.4, radiusM: 8000 } }).success);
});
