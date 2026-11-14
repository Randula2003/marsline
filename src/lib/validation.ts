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
  marsSol: z.number().int().min(0).max(100000).default(18),
});
