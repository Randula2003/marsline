export const DEFAULT_MISSION_CODE = "ARES-FS-01";
export const MARS_MEAN_RADIUS_KM = 3389.5;
export const APP_VERSION = "4.0.1";                // keep in step with package.json
// Concept mission clock shown in the console (a demonstration timeline, not real mission data).
export const MISSION_SOL = 18;
export const MISSION_PLAN_SOLS = 50;
export const MISSION_SOL_LABEL = String(MISSION_SOL).padStart(3, "0");

export const MEDA_INDEXES = {
  ATS: { title: "Air Temperature Sensor", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/mars2020_meda_calibrated_ATS.csv" },
  WIND: { title: "Wind Sensor", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/mars2020_meda_calibrated-WIND.csv" },
  PS: { title: "Pressure Sensor", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/mars2020_meda_derived_PS.csv" },
  RDS: { title: "Radiation and Dust Sensor", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/mars2020_meda_calibrated_RDS.csv" },
  RHS: { title: "Relative Humidity Sensor", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/mars2020_meda_calibrated-RHS.csv" },
  TIRS: { title: "Thermal Infrared Sensor", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/logs/mars2020_meda_calibrated-TIRS.csv" }
} as const;
export type MedaSensor = keyof typeof MEDA_INDEXES;

export const NASA_DATASETS = [
  { instrument: "MOLA / HRSC", productCode: "MOLA-HRSC", title: "Global elevation and hillshade", dataType: "TOPOGRAPHIC", coverage: "Global", sourceUrl: "https://trek.nasa.gov/mars/", description: "Global elevation and color hillshade context from MGS MOLA and Mars Express HRSC." },
  { instrument: "THEMIS", productCode: "THEMIS-IR", title: "Day/night thermal infrared mosaics", dataType: "THERMAL", coverage: "Global mosaics", sourceUrl: "https://trek.nasa.gov/mars/", description: "Mars Odyssey thermal infrared surface context." },
  { instrument: "TES", productCode: "TES-DUST", title: "Atmospheric dust products", dataType: "ATMOSPHERIC", coverage: "Global products", sourceUrl: "https://trek.nasa.gov/mars/", description: "MGS TES dust and thermal emission products." },
  { instrument: "HiRISE", productCode: "HiRISE-JEZ", title: "High-resolution Jezero imagery", dataType: "OPTICAL", coverage: "Targeted footprint", sourceUrl: "https://www.uahirise.org/", description: "MRO high-resolution optical imagery; inspect individual footprint coverage." },
  { instrument: "CTX", productCode: "CTX", title: "Context Camera imagery", dataType: "OPTICAL", coverage: "Regional / targeted", sourceUrl: "https://trek.nasa.gov/mars/", description: "MRO regional optical imagery." },
  { instrument: "CRISM", productCode: "CRISM", title: "Mineral spectroscopy", dataType: "SPECTRAL", coverage: "Targeted footprints", sourceUrl: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm", description: "Visible and near-infrared spectral observations." },
  { instrument: "SHARAD", productCode: "SHARAD", title: "Shallow subsurface radar", dataType: "RADAR", coverage: "Orbital tracks", sourceUrl: "https://pds-geosciences.wustl.edu/missions/mro/sharad.htm", description: "MRO radar sounding products." },
  { instrument: "REMS", productCode: "REMS", title: "Curiosity environmental station", dataType: "IN_SITU", coverage: "Gale Crater", sourceUrl: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/ATMOSPHERES/MARS/REMS.html", description: "Historical rover-local environmental observations." },
  { instrument: "RAD", productCode: "RAD", title: "Curiosity radiation detector", dataType: "RADIATION", coverage: "Gale Crater", sourceUrl: "https://pds.nasa.gov/", description: "Surface radiation archive from Curiosity." },
  { instrument: "MCS", productCode: "MCS", title: "Mars Climate Sounder", dataType: "ATMOSPHERIC", coverage: "Orbital profiles", sourceUrl: "https://pds-atmospheres.nmsu.edu/", description: "Orbital atmospheric temperature, dust and cloud profile products." }
] as const;
