// Additional routes for when a dust storm or hazard threatens the planned route, or the destination cannot be reached.
import { planRoute, type AvoidZone, type LonLat, type Route, type Terrain } from "@/lib/terrain";

export type Place = LonLat & { label: string };
export type Alternate = { kind: "detour" | "shelter" | "retarget"; title: string; to: Place; route: Route };
export type Contingency = {
  unreachable: boolean;            // the chosen destination cannot be reached while the zones are in force
  reason: string;                  // why (empty when nothing is wrong)
  alternates: Alternate[];
};

type Inputs = {
  terrain: Terrain; from: LonLat; dest: Place; zones: AvoidZone[];
  shelters: Place[]; targets: Place[]; blockSlopeDeg: number; speedKmh: number;
};

const near = (a: LonLat, b: LonLat) => Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
const fastest = (list: { place: Place; route: Route }[]) => list.sort((a, b) => a.route.timeMin - b.route.timeMin)[0];

/** Plans up to three extra routes from the crew's position, all of which keep out of the storm and hazard zones:
 *  a detour to the same destination, the quickest way to shelter, and (only if the destination is unreachable) the nearest other target. */
export function planContingency({ terrain, from, dest, zones, shelters, targets, blockSlopeDeg, speedKmh }: Inputs): Contingency {
  const opts = { blockSlopeDeg, speedKmh, avoid: zones };
  const alternates: Alternate[] = [];
  let unreachable = false, reason = "";

  const detour = planRoute(terrain, from, dest, opts);
  if ("error" in detour) { unreachable = true; reason = detour.error; }
  else alternates.push({ kind: "detour", title: `Detour to ${dest.label}`, to: dest, route: detour });

  const toShelter = shelters.filter((p) => !near(p, from) && !near(p, dest)).flatMap((place) => {
    const r = planRoute(terrain, from, place, opts);
    return "error" in r ? [] : [{ place, route: r }];
  });
  const shelter = fastest(toShelter);
  if (shelter) alternates.push({ kind: "shelter", title: `Shelter at ${shelter.place.label}`, to: shelter.place, route: shelter.route });

  if (unreachable) {
    const others = targets.filter((p) => !near(p, dest)).flatMap((place) => {
      const r = planRoute(terrain, from, place, opts);
      return "error" in r ? [] : [{ place, route: r }];
    });
    const alt = fastest(others);
    if (alt) alternates.push({ kind: "retarget", title: `Switch target to ${alt.place.label}`, to: alt.place, route: alt.route });
  }
  return { unreachable, reason, alternates };
}
