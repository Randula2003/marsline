import MissionConsole from "@/components/mission-console";
import { DEFAULT_MISSION_CODE } from "@/lib/constants";
export const dynamic = "force-dynamic";
export default function Home() {
  const initial = {
    databaseReady: false,
    mission: {
      id: DEFAULT_MISSION_CODE,
      code: DEFAULT_MISSION_CODE,
      name: "Ares · Jezero Field Study",
      targetRegion: "Jezero Crater, western Isidis Planitia",
      status: "PLANNING",
      counts: { waypoints: 2, logs: 0, targets: 1, datasets: 16 },
      waypoints: [
        { id: "demo-habitat", name: "Jezero habitat reference", type: "HABITAT", latitudeDeg: 18.4447, longitudeDeg: 77.4508, notes: "Demo reference", sequence: 1 },
        { id: "demo-delta", name: "Delta science target", type: "SCIENCE_TARGET", latitudeDeg: 18.43, longitudeDeg: 77.48, notes: "Illustrative target", sequence: 2 }
      ],
      logs: [],
      latestResources: { oxygenReservePct: 78, waterRemainingLiters: 6.4, waterCapacityLiters: 10, waterUseLitersDay: 2.5, co2ScrubberPct: 92, powerReservePct: 86 }
    }
  };
  return <MissionConsole initial={initial} />;
}
