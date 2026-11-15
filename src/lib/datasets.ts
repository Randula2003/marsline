// Every dataset Marsline uses or was given, with where it comes from and exactly how it is used.
// Single source of truth for the Datasets page and for the dataset tests (tests check that every file listed here exists).
export type DatasetStatus = "used" | "reference" | "context" | "not-used";
export type Dataset = {
  id: string; name: string; agency: string; kind: string; resolution: string; coverage: string;
  provided: string;                       // how we got it
  status: DatasetStatus; usedFor: string[]; note?: string;
  files: string[];                        // paths below /data/ in this repository (public/data/...)
  preview?: string;                       // file name in /data/datasets/
  sources: { label: string; url: string }[]; credit: string;
};

const J = "regions/jezero";
export const DATASETS: Dataset[] = [
  {
    id: "hrsc", name: "Mars Express HRSC digital terrain model", agency: "ESA / DLR (via USGS)", kind: "TOPOGRAPHIC", resolution: "75 m", coverage: "Jezero and Nili Fossae window, 56 × 59 km",
    provided: "Supplied challenge data: USGS_Geology/sim3464_database.zip (Rasters/HRSC)", status: "used", preview: "hrsc.jpg",
    usedFor: ["Elevation and hillshade layers", "Slope and roughness (Horn method)", "Traversability map and walking cost", "Elevation profile along routes", "Atmospheric-depth (radiation shielding context) layer"],
    files: [`${J}/elevation.png`, `${J}/hillshade.png`, `${J}/slope.png`, `${J}/atmosphere.png`, `${J}/grid_data.png`, `${J}/grid_elev.png`],
    sources: [{ label: "USGS SIM 3464", url: "https://pubs.usgs.gov/sim/3464/" }, { label: "ESA Mars Express", url: "https://www.esa.int/Science_Exploration/Space_Science/Mars_Express" }], credit: "ESA/DLR/FU Berlin; USGS Astrogeology Science Center"
  },
  {
    id: "ctx", name: "MRO CTX mosaic (Caltech, 2018)", agency: "NASA / JPL · MRO", kind: "OPTICAL", resolution: "5 m (shown at 20 m)", coverage: "Same window as the HRSC model",
    provided: "Supplied challenge data: USGS_Geology/sim3464_database.zip (Rasters/Caltech_CTX_mosaic)", status: "used", preview: "ctx.jpg",
    usedFor: ["Optical base layer of the Jezero map", "Orbital preview of every science target (3 km wide)", "Base for the slope and safety overlays"],
    files: [`${J}/ctx.jpg`, `${J}/thumbs/T1.jpg`, `${J}/thumbs/T2.jpg`, `${J}/thumbs/T3.jpg`, `${J}/thumbs/T4.jpg`, `${J}/thumbs/T5.jpg`, `${J}/thumbs/T6.jpg`, `${J}/thumbs/T7.jpg`],
    sources: [{ label: "Mars Orbital Data Explorer", url: "https://ode.rsl.wustl.edu/mars/" }, { label: "USGS SIM 3464", url: "https://pubs.usgs.gov/sim/3464/" }], credit: "NASA/JPL-Caltech/MSSS; Caltech mosaic"
  },
  {
    id: "themis", name: "Mars Odyssey THEMIS day and night infrared mosaics (USGS, 2018)", agency: "NASA / JPL · Mars Odyssey", kind: "THERMAL", resolution: "100 m", coverage: "Same window as the HRSC model",
    provided: "Supplied challenge data: USGS_Geology/sim3464_database.zip (Rasters/USGS_THEMIS)", status: "used", preview: "themis.jpg",
    usedFor: ["Day and night thermal infrared layers (thermal inertia context)"], files: [`${J}/themis_day.png`, `${J}/themis_night.png`],
    sources: [{ label: "USGS SIM 3464", url: "https://pubs.usgs.gov/sim/3464/" }, { label: "ASU Mars data", url: "https://www.mars.asu.edu/data/" }], credit: "NASA/JPL-Caltech/ASU; USGS controlled mosaic"
  },
  {
    id: "usgs", name: "USGS geologic map of Jezero crater and Nili Fossae (SIM 3464) GIS database", agency: "USGS Astrogeology Science Center", kind: "GEOLOGIC", resolution: "1:75,000 map scale", coverage: "Jezero crater and Nili Fossae region",
    provided: "Supplied challenge data: USGS_Geology/sim3464_database.zip (file geodatabase, 350 MB)", status: "used", preview: "usgs.jpg",
    usedFor: ["Geologic unit overlay (14 units)", "Walking-cost and science-value score for every unit", "Choice of the 7 science targets", "Ridge, rim and delta-front lines as high-cost ground", "Craters and landing ellipse overlays"],
    files: [`${J}/geology_units.geojson`, `${J}/linear_features.geojson`, `${J}/craters.geojson`, `${J}/landing_ellipse.geojson`, `${J}/science.png`],
    sources: [{ label: "USGS SIM 3464", url: "https://pubs.usgs.gov/sim/3464/" }], credit: "USGS Astrogeology Science Center"
  },
  {
    id: "mola", name: "MGS MOLA topography (MEGDR 128 pixel/degree)", agency: "NASA / GSFC · Mars Global Surveyor", kind: "TOPOGRAPHIC", resolution: "463 m", coverage: "Longitude 0 to 90 °E, latitude 0 to 44 °N (tile megt44n000hb)",
    provided: "Supplied challenge data: MOLA/megt44n000hb.img (124 MB)", status: "used", preview: "mola.jpg",
    usedFor: ["The three regional areas (Nili Fossae, Syrtis Major, Isidis Planitia): hillshade, slope, traversability, targets, routes", "Independent check of the HRSC elevation (correlation 0.995, about 31 m RMS)"],
    files: ["regions/nili-fossae/elevation.png", "regions/syrtis-major/elevation.png", "regions/isidis-planitia/elevation.png", "regions/syrtis-major/grid_data.png"],
    sources: [{ label: "ASU Mars data", url: "https://www.mars.asu.edu/data/" }], credit: "NASA/MGS MOLA Science Team"
  },
  {
    id: "meda-index", name: "Perseverance MEDA product index (ancillary data)", agency: "NASA PDS Atmospheres Node", kind: "ATMOSPHERIC", resolution: "one row per sol", coverage: "Sols 1 to 1139",
    provided: "Supplied challenge data: MEDA/MARS2020_MEDA_ANC_Derived_Del10.csv", status: "used",
    usedFor: ["Solar longitude (Ls) and season of each sol: labels the weather charts and sets the sun position in the spacewalk window"],
    files: [`${J}/meda_timeseries.json`], sources: [{ label: "PDS MEDA", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" }], credit: "NASA/JPL-Caltech; NASA PDS"
  },
  {
    id: "meda", name: "Perseverance MEDA derived measurements (pressure, humidity and temperature, thermal infrared, wind)", agency: "NASA PDS Atmospheres Node", kind: "ATMOSPHERIC", resolution: "about 1 sample per second, reduced to hourly medians", coverage: "Four sols in Mars year 36: 51, 247, 410, 552",
    provided: "Downloaded from NASA PDS by scripts/download_meda.py (about 47 MB, not stored in git)", status: "used", preview: "meda.jpg",
    usedFor: ["Weather charts on the Current conditions page", "Coldest-temperature limit of the spacewalk window", "Equation of time (true minus mean solar time) for the sun maths"],
    files: [`${J}/meda_timeseries.json`], sources: [{ label: "PDS derived data", url: "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/" }], credit: "NASA/JPL-Caltech; NASA PDS Atmospheres Node"
  },
  {
    id: "rover-images", name: "Perseverance raw images (Mastcam-Z and Navcam)", agency: "NASA / JPL-Caltech", kind: "SURFACE IMAGERY", resolution: "800 px previews", coverage: "8 images from sols 51, 247, 410, 552",
    provided: "Downloaded from NASA by scripts/fetch_rover_images.py (0.4 MB, committed)", status: "used", preview: "rover.jpg",
    usedFor: ["Ground-level view of the terrain on the Current conditions page"], files: [`${J}/rover/rover.json`, `${J}/rover/sol0410_mcz_left_4.jpg`],
    sources: [{ label: "Mars 2020 raw images", url: "https://mars.nasa.gov/mars2020/multimedia/raw-images/" }], credit: "NASA/JPL-Caltech/ASU"
  },
  {
    id: "traverse", name: "Perseverance traverse and waypoints (every real drive)", agency: "NASA / JPL (public MMGIS layers)", kind: "TRAVERSE", resolution: "10 m sampling of 541 drive segments", coverage: "46 km driven, sol 14 to 2022",
    provided: "Downloaded from NASA by scripts/fetch_rover_traverse.py (2.3 MB, not stored in git)", status: "used", preview: "traverse.jpg",
    usedFor: ["Reality check of the safety map and the route planner (Surface map page)", "It found and fixed a flaw: ridge and rim lines had been marked impassable"],
    files: [`${J}/validation.json`, `${J}/validation.png`], sources: [{ label: "NASA MMGIS", url: "https://nasa-ammos.github.io/MMGIS/" }], credit: "NASA/JPL-Caltech"
  },
  {
    id: "rad", name: "Curiosity RAD and MSL cruise radiation measurements (published values)", agency: "NASA · MSL", kind: "RADIATION", resolution: "dose rates", coverage: "Gale Crater surface and Earth-Mars cruise",
    provided: "Published papers (cited, not downloaded)", status: "used",
    usedFor: ["Radiation context panel (about 0.64 mSv/day on the surface, about 1.8 mSv/day in cruise), shown as context only, never as a crew dose"], files: [],
    sources: [{ label: "Hassler et al. 2014, Science 343", url: "https://doi.org/10.1126/science.1244797" }, { label: "Zeitlin et al. 2013, Science 340", url: "https://doi.org/10.1126/science.1235989" }], credit: "Hassler et al. 2014; Zeitlin et al. 2013"
  },
  {
    id: "curiosity-route", name: "Curiosity's proposed path up Mount Sharp (PIA23179)", agency: "NASA / JPL · MRO", kind: "REFERENCE", resolution: "image", coverage: "Lower Mount Sharp, Gale Crater",
    provided: "Supplied challenge data: Curiosity_Route/PIA23179 (jpg, gif, tif)", status: "reference", preview: "curiosity_route.jpg",
    usedFor: ["The challenge's example of a route map: it guided how our map shows a route over orbital imagery with labelled targets"],
    note: "A picture without map coordinates, so it is shown here but not analysed.",
    files: [], sources: [{ label: "Photojournal PIA23179", url: "https://science.nasa.gov/photojournal/curiositys-proposed-path-up-mount-sharp/" }], credit: "NASA/JPL-Caltech/ESA/Univ. of Arizona/JHUAPL/MSSS/USGS Astrogeology Science Center"
  },
  {
    id: "mola-color", name: "MOLA colour shaded-relief mosaic (tile N00_060)", agency: "NASA / ASU", kind: "TOPOGRAPHIC", resolution: "about 463 m (7680 × 7680 px)", coverage: "A 60° × 60° tile in the northern hemisphere",
    provided: "Supplied challenge data: MOLA/mola_color_N00_060.png (43 MB)", status: "context", preview: "mola_color.jpg",
    usedFor: ["Shown here as regional context"], note: "It carries no map coordinates, and It could not be registered reliably, so it is not used in any analysis. The numeric MOLA elevation above is used instead.",
    files: [], sources: [{ label: "ASU Mars data", url: "https://www.mars.asu.edu/data/" }], credit: "NASA/GSFC MOLA; ASU Mars Space Flight Facility"
  },
  {
    id: "themis-mosaic", name: "THEMIS infrared mosaic (tile N00_060)", agency: "NASA / ASU · Mars Odyssey", kind: "THERMAL", resolution: "about 463 m (7680 × 7680 px)", coverage: "The same 60° × 60° tile",
    provided: "Supplied challenge data: THEMIS/thm_dir_N00_060.png (40 MB)", status: "context", preview: "themis_mosaic.jpg",
    usedFor: ["Shown here as regional context"], note: "No map coordinates, so it is not used in any analysis. The USGS THEMIS mosaics above (with coordinates) are used for the thermal layers.",
    files: [], sources: [{ label: "ASU Mars data", url: "https://www.mars.asu.edu/data/" }], credit: "NASA/JPL-Caltech/ASU"
  },
  {
    id: "meda-other", name: "Other MEDA index and SkyCam files (wind index, derived and raw indexes, SkyCam browse)", agency: "NASA PDS Atmospheres Node", kind: "ATMOSPHERIC", resolution: "indexes", coverage: "Mars 2020 MEDA products",
    provided: "Supplied challenge data: MEDA/*.zip and MEDA/MARS2020+MEDA_WIND_Derived_del-1-8.csv", status: "not-used",
    usedFor: [], note: "These list which products exist. The Current conditions page reads the live PDS indexes instead (ATS, WIND, PS, RDS, RHS, TIRS), and the SkyCam browse images are not used.",
    files: [], sources: [{ label: "PDS MEDA", url: "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" }], credit: "NASA/JPL-Caltech; NASA PDS"
  },
  {
    id: "sim3464-docs", name: "SIM 3464 printed map and pamphlet (PDF) and metadata", agency: "USGS Astrogeology Science Center", kind: "REFERENCE", resolution: "documents", coverage: "Jezero crater and Nili Fossae",
    provided: "Supplied challenge data: USGS_Geology/sim3464.pdf, sim3464_pamphlet.pdf, sim3464_metadata.xml", status: "reference",
    usedFor: ["Documentation of the geologic map. The app uses the GIS database above and does not parse these files."], files: [],
    sources: [{ label: "USGS SIM 3464", url: "https://pubs.usgs.gov/sim/3464/" }], credit: "USGS Astrogeology Science Center"
  }
];

export const STATUS_LABEL: Record<DatasetStatus, string> = { used: "USED IN THE APP", reference: "REFERENCE", context: "CONTEXT ONLY", "not-used": "NOT USED" };
