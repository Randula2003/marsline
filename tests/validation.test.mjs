// The request schemas shared by the API routes and the browser demo store.
import test from "node:test";
import assert from "node:assert/strict";
import { waypointSchema, logSchema, lifeSupportSchema, messageSchema } from "../src/lib/validation.ts";

test("waypoint: valid Mars coordinates pass, defaults are filled, out-of-range values fail", () => {
  const ok = waypointSchema.parse({ name: " Delta ", type: "SCIENCE_TARGET", latitudeDeg: 18.4, longitudeDeg: 77.4 });
  assert.equal(ok.name, "Delta"); assert.equal(ok.notes, "");
  assert.throws(() => waypointSchema.parse({ name: "x", type: "HABITAT", latitudeDeg: 0, longitudeDeg: 0 }), "name too short");
  assert.throws(() => waypointSchema.parse({ name: "Base", type: "HABITAT", latitudeDeg: 91, longitudeDeg: 10 }), "latitude");
  assert.throws(() => waypointSchema.parse({ name: "Base", type: "HABITAT", latitudeDeg: 10, longitudeDeg: -5 }), "longitude is east-positive 0 to 360");
  assert.throws(() => waypointSchema.parse({ name: "Base", type: "MOON_BASE", latitudeDeg: 10, longitudeDeg: 10 }), "unknown type");
});

test("log: needs a title, a note and a known type", () => {
  assert.ok(logSchema.parse({ title: "Delta", note: "Layered rock seen.", logType: "SCIENCE_OBSERVATION" }));
  assert.throws(() => logSchema.parse({ title: "Delta", note: "Layered rock seen.", logType: "GOSSIP" }));
  assert.throws(() => logSchema.parse({ title: "D", note: "ok note", logType: "GENERAL" }));
});

test("life support: percentages stay within 0 to 100 and capacity must be positive", () => {
  const base = { oxygenReservePct: 78, waterRemainingLiters: 6.4, waterCapacityLiters: 10, waterUseLitersDay: 2.5, co2ScrubberPct: 92, powerReservePct: 86 };
  assert.ok(lifeSupportSchema.parse(base));
  assert.throws(() => lifeSupportSchema.parse({ ...base, oxygenReservePct: 101 }));
  assert.throws(() => lifeSupportSchema.parse({ ...base, waterCapacityLiters: 0 }));
  assert.throws(() => lifeSupportSchema.parse({ ...base, powerReservePct: -1 }));
});

test("message: defaults for callsign, priority and sol; subject and body are required", () => {
  const m = messageSchema.parse({ subject: "Status report", messageBody: "All nominal." });
  assert.equal(m.senderCallsign, "ASTRONAUT-01"); assert.equal(m.priority, "ROUTINE"); assert.equal(m.marsSol, 18);
  assert.throws(() => messageSchema.parse({ subject: "Hi", messageBody: "All nominal." }), "subject too short");
  assert.throws(() => messageSchema.parse({ subject: "Status report", messageBody: "All nominal.", priority: "PANIC" }));
});
