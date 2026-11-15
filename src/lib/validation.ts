import { z } from "zod";
export const waypointSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["HABITAT", "SCIENCE_TARGET", "RESOURCE_CACHE", "OBSERVATION_POINT", "HAZARD", "ROVER_POSITION", "OTHER"]),
  latitudeDeg: z.number().min(-90).max(90),
  longitudeDeg: z.number().min(0).max(360),
  notes: z.string().max(1000).optional().default("")
});
export const logSchema = z.object({
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().min(2).max(3000),
  logType: z.enum(["SCIENCE_OBSERVATION", "ROUTE_UPDATE", "ENVIRONMENTAL_NOTE", "MISSION_STATUS", "RESOURCE_UPDATE", "GENERAL"]),
  marsSol: z.number().int().min(0).max(100000).optional()
});
export const lifeSupportSchema = z.object({
  oxygenReservePct: z.number().min(0).max(100),
  waterRemainingLiters: z.number().min(0).max(100000),
  waterCapacityLiters: z.number().positive().max(100000),
  waterUseLitersDay: z.number().min(0).max(10000),
  co2ScrubberPct: z.number().min(0).max(100),
  powerReservePct: z.number().min(0).max(100),
  notes: z.string().max(1000).optional()
});

export const messageSchema = z.object({
  senderCallsign: z.string().trim().min(2).max(60).default("ASTRONAUT-01"),
  subject: z.string().trim().min(3).max(120),
  messageBody: z.string().trim().min(3).max(4000),
  priority: z.enum(["ROUTINE", "PRIORITY", "URGENT"]).default("ROUTINE"),
  marsSol: z.number().int().min(0).max(100000).default(18),   // = MISSION_SOL in constants.ts (not imported so tests can load this file directly)
});

// ---- live mission handoff: what the next crew member needs (route walked, planned and alternate routes, surface conditions, hazards)
const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(0).max(360) });
const place = point.extend({ label: z.string().trim().min(1).max(120) });
export const handoffSchema = z.object({
  title: z.string().trim().min(2).max(120),
  callsign: z.string().trim().min(2).max(60).default("ASTRONAUT-01"),
  notes: z.string().max(2000).optional().default(""),
  reason: z.enum(["manual", "arrived", "stopped"]).default("manual"),
  regionId: z.string().trim().min(1).max(60),
  marsSol: z.number().int().min(0).max(100000).default(18),   // = MISSION_SOL in constants.ts
  start: place.nullable().default(null),
  end: place.nullable().default(null),
  plannedRoute: z.array(point).max(400),
  alternate: z.object({ label: z.string().trim().min(1).max(160), points: z.array(point).max(400) }).nullable().default(null),
  trail: z.array(point.extend({ t: z.number().min(0) })).max(600),
  distanceTraveledM: z.number().min(0).max(10_000_000),
  lastPosition: point,
  conditions: z.object({
    level: z.enum(["NOMINAL", "ADVISORY", "WARNING", "STORM"]), scenario: z.enum(["clear", "approaching", "storm"]), headline: z.string().max(160),
    tempC: z.number().min(-200).max(100), windMs: z.number().min(0).max(200), pressurePa: z.number().min(0).max(2000), dustTau: z.number().min(0).max(20),
    visibilityKm: z.number().min(0).max(1000), localHour: z.number().min(0).max(24)
  }),
  hazards: z.array(place.extend({ radiusM: z.number().positive().max(100000) })).max(40).default([]),
  storm: point.extend({ radiusM: z.number().positive().max(200000) }).nullable().default(null)
});
