import type { LonLat, TrailPoint } from "@/lib/live";
import type { Inherited } from "@/lib/use-live-session";

type Place = LonLat & { label: string };
/** A handoff record as stored (Firestore or browser demo storage). */
export type HandoffRecord = {
  id: string; title: string; callsign: string; notes?: string; reason: string; regionId: string; marsSol: number; savedAt: string;
  start: Place | null; end: Place | null; plannedRoute: LonLat[]; alternate: { label: string; points: LonLat[] } | null; trail: TrailPoint[];
  distanceTraveledM: number; lastPosition: LonLat;
  conditions: { level: string; scenario: string; headline: string; tempC: number; windMs: number; pressurePa: number; dustTau: number; visibilityKm: number; localHour: number };
  hazards: (Place & { radiusM: number })[]; storm: (LonLat & { radiusM: number }) | null;
};

/** What the next crew member sees after loading a record. */
export const toInherited = (r: HandoffRecord): Inherited => ({
  key: r.id, title: r.title, callsign: r.callsign, savedAt: r.savedAt, notes: r.notes ?? "", regionId: r.regionId, start: r.start, end: r.end,
  plannedRoute: r.plannedRoute, alternate: r.alternate, trail: r.trail, hazards: r.hazards ?? [], storm: r.storm, lastPosition: r.lastPosition, headline: r.conditions.headline
});
