import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import { DEFAULT_MISSION_CODE, NASA_DATASETS, MEDA_INDEXES } from "@/lib/constants";
import { missionRef } from "@/lib/server-auth";

export async function ensureWorkspace(uid: string) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const mRef = missionRef(uid);
  const [userSnap, missionSnap] = await Promise.all([userRef.get(), mRef.get()]);
  const batch = db.batch();
  if (!userSnap.exists) batch.set(userRef, { uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), authProvider: "anonymous" });
  if (!missionSnap.exists) batch.set(mRef, {
    code: DEFAULT_MISSION_CODE,
    name: "Ares · Jezero Field Study",
    targetRegion: "Jezero Crater, western Isidis Planitia",
    description: "Research concept mission for a human exploration traverse and integrated science observations.",
    status: "PLANNING",
    startSol: 1,
    targetCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const datasetsRef = mRef.collection("nasaDatasets");
  const datasetSnap = await datasetsRef.limit(1).get();
  if (datasetSnap.empty) {
    for (const item of NASA_DATASETS) {
      batch.set(datasetsRef.doc(item.productCode), {
        ...item,
        processingLevel: "CATALOGUE",
        documentationUrl: item.sourceUrl,
        coordinateSystem: "IAU2000:49900",
        createdAt: new Date().toISOString()
      });
    }
    for (const [sensor, meta] of Object.entries(MEDA_INDEXES)) {
      batch.set(datasetsRef.doc(`MEDA-${sensor}`), {
        instrument: "MEDA", productCode: `MEDA-${sensor}`, title: meta.title,
        dataType: "IN_SITU", processingLevel: "PDS_INDEX",
        coverage: "Perseverance rover site · Jezero", sourceUrl: meta.url,
        documentationUrl: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html",
        description: "PDS product index only; it is not a live weather feed or decoded observation series.",
        coordinateSystem: "IAU2000:49900", createdAt: new Date().toISOString()
      });
    }
  }
  // Demo waypoints and the life-support snapshot are seeded only when the mission
  // is first created, so deleting them later does not bring them back.
  const firstRun = !missionSnap.exists;
  const resourcesRef = mRef.collection("lifeSupport");
  if (firstRun) {
    batch.set(resourcesRef.doc("demo-initial"), {
      oxygenReservePct: 78, waterRemainingLiters: 6.4, waterCapacityLiters: 10,
      waterUseLitersDay: 2.5, co2ScrubberPct: 92, powerReservePct: 86,
      isSimulated: true, notes: "Seed demonstration values only; not real crew telemetry.",
      recordedAt: new Date().toISOString()
    });
  }
  const waypointsRef = mRef.collection("waypoints");
  if (firstRun) {
    const seedWaypoints = [
      { name: "Jezero habitat reference", type: "HABITAT", latitudeDeg: 18.4447, longitudeDeg: 77.4508, notes: "Concept reference point near Perseverance landing region.", sequence: 1, isDemo: true },
      { name: "Delta science target", type: "SCIENCE_TARGET", latitudeDeg: 18.4300, longitudeDeg: 77.4800, notes: "Illustrative target only; inspect actual orbital image footprints before scientific use.", sequence: 2, isDemo: true }
    ];
    for (const [index, wp] of seedWaypoints.entries()) {
      const id = index === 0 ? "demo-habitat" : "demo-delta";
      batch.set(waypointsRef.doc(id), { ...wp, coordinateSystem: "IAU2000:49900", createdAt: new Date().toISOString() });
    }
  }
  await batch.commit();
  return { userRef, missionRef: mRef };
}

