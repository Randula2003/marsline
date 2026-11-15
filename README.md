# Marsline: a layered Marswalk map and route planner

Built for the **NASA Space Apps Challenge 2026: Interplanetary Survival Guide, Martian Map**. Marsline combines NASA, ESA and USGS data for a Mars study area into one view, marks where it is safe to walk, and plans a terrain-aware route to science targets, with real Perseverance weather and rover photos for context.

It is a Next.js + Firebase application. If Firebase is not configured it falls back to a browser demo mode, so every feature still works.

> This is a research prototype, not flight-certified mission software. Slope limits, geologic-unit costs, science scores and walking speed are concept-level assumptions, and resource models and mission-status values are not real crew safety advice.

## What the app does

| Page | What it shows |
|---|---|
| **Surface map** | Four study areas (Jezero in detail; Nili Fossae, Syrtis Major and Isidis Planitia regional). Switchable layers (imagery, thermal, elevation, slope, traversability, science value, atmospheric depth, geology), terrain readout on hover, an A* route planner (distance, walking time, climb, elevation profile, spacewalk-limit warning), adjustable assumptions, a **spacewalk window** (when a walk fits in daylight and above a temperature limit), a **reality check against every real Perseverance drive**, one-page map download |
| **Current conditions** | Real Perseverance MEDA measurements for four seasons (temperature, pressure, humidity, wind), real rover photos from the same sols, and live retrieval of NASA PDS index files |
| **Datasets used** | Every dataset behind the app (15 listed, 10 used): agency, resolution, coverage, how it is used, source links, credits, previews, and where the derived files are in the repository. Items from the supplied zip that the app does not use are marked, with the reason |
| **Science data layers**, **Route planner**, **Radiation context** | Layer catalogue, saved waypoints and route distances, published radiation measurements as context only (no crew dose) |
| **Life support**, **Mission communications**, **Mission log** | Simulated resource snapshots, a simulated station message log, mission notes |
| **Live mission** (tablet screen) | Simulated live crew position, weather at the crew (archived MEDA baseline plus a simulated dust storm), additional routes around storms and hazards, and a saved route and surface handoff for the next crew member |
| **Data & Firebase** | Connection status, a Firebase setup checklist, and demo-mode controls |

## Quick start

Requires **Node.js 22 or newer** (https://nodejs.org/en/download/).

```bash
git clone https://github.com/Randula2003/marsline.git
cd marsline
npm install
npm run dev
```

Open http://localhost:3000 and choose **Surface map**. With no Firebase settings the app starts in **demo mode** (see below). Every map layer, chart and photo is already in the repository, so nothing needs to be downloaded.

```bash
npm test          # route-planner and data-consistency tests
npm run lint
npm run typecheck
npm run build
```

## Firebase setup

Marsline stores each user's waypoints, mission log, communications simulator, life-support snapshots and saved routes in **Cloud Firestore**, under their own anonymous **Firebase Authentication** account.

### 1. Create the Firebase project

In https://console.firebase.google.com/:

1. Create a Firebase project (or choose a dedicated project for Marsline).
2. Add a Web App from Project settings → General → Your apps.
3. Go to Build → Authentication → Get started → Sign-in method and enable **Anonymous**.
4. Go to Build → Firestore Database → Create database. Choose a region and production mode.
5. In Project settings → Service accounts, generate a private key for local development. Store it securely; never place it in the source tree or commit it to Git.

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Set the four `NEXT_PUBLIC_FIREBASE_*` values from your Firebase Web App configuration. Set the server-only Admin values from the service-account JSON:

- `FIREBASE_PROJECT_ID`: project ID
- `FIREBASE_CLIENT_EMAIL`: `client_email` from the JSON
- `FIREBASE_PRIVATE_KEY`: `private_key` from the JSON, keeping the `\n` sequences inside the quoted value
- `NASA_DATA_ENABLED=true`

Never prefix Admin credentials with `NEXT_PUBLIC_`. Never commit `.env.local` or the service-account JSON (`.gitignore` excludes both). As an alternative for local development, set `GOOGLE_APPLICATION_CREDENTIALS` to the path of the JSON file and `FIREBASE_PROJECT_ID`; the Admin SDK then uses Application Default Credentials.

### 3. Check the connection

Open **Data & Firebase** in the app for a checklist (it never shows your values), or run:

```bash
npm run check:firebase
```

It reads `.env.local`, tests a real Firestore write/read/delete and an anonymous sign-in, and prints the exact fix for anything that fails. Add `-- --no-auth-test` to skip the sign-in test (the test creates one anonymous user in your own Firebase project).

Then restart `npm run dev`. The first page load signs in anonymously, creates a UID-scoped Firestore workspace with a demo mission and example waypoints, and the sidebar shows **FIREBASE CONNECTED**.

### 4. Deploy the Firestore rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add
npm run firebase:deploy:rules
```

The checked-in rules deny direct client database access, because all database access goes through Next.js API routes that use Firebase Admin after verifying the caller's ID token. The API paths use `users/{uid}`, so one signed-in user cannot read another's workspace.

### 5. Deploy the app

Use **Firebase App Hosting** (not static Firebase Hosting) for this dynamic Next.js app: https://firebase.google.com/docs/app-hosting/get-started.

1. Push the project to a GitHub repository.
2. Firebase Console → App Hosting → Get started → connect the repository.
3. Choose the app root (the directory with `package.json`) and a backend region.
4. Add the `NEXT_PUBLIC_FIREBASE_*` values as App Hosting environment variables.
5. For server-side Firebase Admin, use the platform's Application Default Credentials and set `FIREBASE_PROJECT_ID`; do not upload a service-account key to the repository.
6. In Firebase Console → Authentication → Settings → **Authorized domains**, add your deployed domain, or anonymous sign-in fails on the live site.
7. Deploy the Firestore rules (step 4).

App Hosting may require the Blaze billing plan; check current pricing first. Keep `package-lock.json` in Git, because App Hosting expects a lockfile. Any other Node host (for example Vercel) also works: set the same environment variables.

### Demo mode (the fallback)

If the Firebase web settings are missing or still contain the `YOUR_...` placeholders, Marsline starts in **demo mode**: waypoints, logs, messages, life-support snapshots and saved routes all work and are kept in the browser (localStorage). The sidebar shows **DEMO MODE** or **FIREBASE CONNECTED**, and **Data & Firebase** has buttons to switch to demo mode or reset the demo data. NASA PDS index fetches call NASA through the server in both modes. Set `NEXT_PUBLIC_DEMO_MODE=true` to force demo mode even when Firebase is configured.

## Firestore data model

All user data is isolated below the authenticated Firebase UID:

```text
users/{uid}
  missions/ARES-FS-01
    waypoints/{waypointId}
    logs/{logId}
    messages/{messageId}
    lifeSupport/{snapshotId}
    nasaDatasets/{productCode}
    scienceTargets/{targetId}
    dataFetches/{fetchId}
```

## API routes

All routes except `GET /api/firebase-status` require `Authorization: Bearer <Firebase ID token>`:

- `GET /api/firebase-status`: public; reports which Firebase settings exist (never their values).
- `POST /api/workspace`: initializes the UID's mission workspace and starter catalogue.
- `GET /api/health`: verifies the caller's token and checks Firestore connectivity.
- `GET`/`POST /api/waypoints`, `DELETE /api/waypoints/:id`: list, create and delete route waypoints in the caller's workspace.
- `GET`/`POST /api/logs`: list and create mission notes.
- `GET`/`POST /api/life-support`: get and save clearly simulated resource snapshots.
- `GET`/`POST /api/messages`: list and save simulated astronaut-to-station messages (a simulator only; nothing is transmitted over a radio link).
- `GET /api/nasa/catalog`: the user's dataset catalogue.
- `GET /api/nasa/meda/:sensor`: fetch an allow-listed MEDA PDS index (`ATS`, `WIND`, `PS`, `RDS`, `RHS`, `TIRS`) and record the retrieval. Limited to 12 requests per UID per minute and 2 MiB per upstream response. In demo mode, and only when the server has no Firebase credentials, the fetch works without sign-in and stores nothing.

## Datasets

The **Datasets used** page in the app lists every dataset (the list lives in `src/lib/datasets.ts`, and `npm test` checks that every file it names exists). Summary:

| Used in the app | What for |
|---|---|
| Mars Express HRSC elevation (ESA) | elevation, slope, roughness, traversability, atmospheric depth, route profiles |
| MRO CTX mosaic | optical layer, target previews |
| Mars Odyssey THEMIS day/night mosaics | thermal layers |
| USGS SIM 3464 geologic map | geology overlay, walking cost, science value, targets |
| MGS MOLA topography | three regional areas, check of the HRSC elevation |
| Perseverance MEDA index and measurements | weather charts, spacewalk window |
| Perseverance raw images | rover photos |
| Perseverance real traverse | reality check of the map and planner |
| Curiosity RAD published values | radiation context (cited, never a crew dose) |

Also shown, with the reason they are not analysed: the Curiosity route image (reference), the two global MOLA/THEMIS mosaics (no map coordinates), the other MEDA indexes and the SIM 3464 PDFs. Preview pictures are built by `scripts/make_dataset_previews.py` from the repository's own data.

## Study-area data pipeline

The map, layers and route planner are driven by files in `public/data/regions/<area>/`, **generated** from the NASA/ESA/USGS data and **committed**, so the app runs from a fresh clone. To regenerate or change them:

1. Put `Marsline_NASA_Resources.zip` in `~/Downloads` (or set `MARSLINE_ZIP`).
2. Open `notebooks/01_feature_engineering.ipynb` in Jupyter and run all cells. It needs `geopandas pyogrio pyproj shapely tifffile imagecodecs` besides the usual numpy/scipy/pandas/Pillow/matplotlib; the first cell says what to install if something is missing.
3. Raw extracts go to `data/raw/` (git-ignored, about 280 MB); outputs (about 20 MB) go to `public/data/regions/`.

| Area | Scale | Data |
|---|---|---|
| Jezero Crater & delta | detailed, 75 m | HRSC elevation, CTX imagery, THEMIS day/night IR, USGS geologic map, MOLA cross-check, MEDA weather, rover photos |
| Nili Fossae, Syrtis Major (Nili Patera), Isidis Planitia | regional, 463 m | MGS MOLA elevation only: hillshade, slope, traversability, relief-derived targets, routes |

Helper scripts (all outputs are committed, so you only run these to refresh them):

- `python scripts/download_meda.py`: downloads about 47 MB of Perseverance MEDA files (one sol per season) into `data/raw/meda/`; the notebook (step 11b) reduces them to `meda_timeseries.json` (about 10 KB).
- `python scripts/fetch_rover_images.py`: saves 8 NASA/JPL-Caltech surface photos (about 0.4 MB).
- `python scripts/fetch_rover_traverse.py`: downloads NASA's public Perseverance traverse (every real drive, about 2.3 MB) into `data/raw/m20/`; notebook step 13c reduces it to `validation.json` and `validation.png`.
- `python notebooks/strip_outputs.py`: removes chart images from the notebook to keep it small in git.

**Add another area:** append one line to `REGIONS` in notebook section 14 (id, name, centre latitude/longitude, half-size in degrees, a short description) and run all cells. The area must lie inside the MOLA tile supplied (longitude 0 to 90 °E, latitude 0 to 44 °N). Areas outside it (for example Gale Crater) need the matching MOLA tile from https://www.mars.asu.edu/data/. New areas appear in the app through `public/data/regions/index.json`. The colour and THEMIS PNG mosaics in the zip carry no map coordinates, so they are not used.

**Assumptions** (edit in the notebook, or adjust live in the route panel): slope limits (Jezero 15° caution / 25° no-go; regional 8° / 15° because 463 m cells smooth steep ground), geologic-unit cost multipliers, science scores, and a 3 km/h walking speed. They are concept-level, not NASA-certified.

## What is new here: reality check and spacewalk window

- **Reality check (Jezero).** We compare our safety map and route planner with NASA's record of every real Perseverance drive (46 km, sol 14 to 2022). Result: 0% of the rover's path lies on ground we call no-go, its steepest slope was 19.7° against our 25° limit, and our planner's routes are a median 0.91× the real drive length (80% within ±25%). The check also found a flaw in our first map: ridge, rim and delta-front lines had been treated as impassable, yet 12% of the real path crossed them, so they are now high-cost caution ground. Limits: the rover has different mobility limits than an astronaut, and its drives were chosen by JPL planners, so this shows consistency with real drive planning, not proof of crew safety.
- **Spacewalk window.** For a planned route the app finds the start times at which the whole walk (optionally with the walk back) is in daylight and never colder than a limit the crew chooses. The sun's position is computed from latitude and season (Mars obliquity 25.19°), with the equation of time measured from the MEDA files for the Jezero sols; the temperature is the measured local air temperature of one sample sol per season (Jezero only; other areas get a daylight-only window). The temperature limit is an adjustable assumption, not a real suit specification. The maths is in `src/lib/eva.ts` and is tested.

## Tests and CI

`npm test` runs the route-planner tests (a synthetic grid), the sun-geometry and spacewalk-window tests, and checks every generated study-area folder (files present, image sizes match, targets inside bounds, MEDA values plausible, credits present). GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the production build on every pull request.

## Project structure

```text
src/app/                   Next.js App Router: page, layout, API routes
src/components/            mission-console (all pages), mars-map (canvas map + route planner),
                           meda-charts, rover-gallery, firebase-setup, eva-window, validation-panel, datasets-page
src/lib/                   terrain.ts (layers + A* planner), eva.ts (sun and window maths), demo-store.ts (browser demo backend),
                           firebase-*.ts, server-auth.ts, firestore-workspace.ts, nasa.ts, validation.ts, constants.ts
public/data/regions/       generated study-area data (committed) + index.json
public/data/datasets/      small preview pictures for the Datasets page
notebooks/                 01_feature_engineering.ipynb, strip_outputs.py
scripts/                   download_meda.py, fetch_rover_images.py, fetch_rover_traverse.py, make_dataset_previews.py, check-firebase.mjs
tests/                     route-planner and data tests
docs/demo/                 7-slide Space Apps demo deck (PowerPoint + PDF) and its build scripts
.github/workflows/         CI
firestore.rules, firestore.indexes.json, firebase.json, apphosting.yaml, .env.local.example
```

## Data sources and credits

- NASA Mars Trek: https://trek.nasa.gov/mars/
- MRO CTX and Mars Odyssey THEMIS mosaics, and the geologic map of Jezero crater and Nili Fossae (USGS SIM 3464): https://pubs.usgs.gov/sim/3464/
- ESA Mars Express HRSC digital terrain model (distributed in SIM 3464)
- MGS MOLA topography and THEMIS mosaics: https://www.mars.asu.edu/data/
- Mars 2020 Perseverance MEDA (NASA PDS Atmospheres Node): https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html
- Mars 2020 raw images (NASA/JPL-Caltech; credit lines in `public/data/regions/jezero/rover/rover.json`): https://mars.nasa.gov/mars2020/multimedia/raw-images/
- Radiation context: Hassler et al. 2014, Science 343 (https://doi.org/10.1126/science.1244797); Zeitlin et al. 2013, Science 340 (https://doi.org/10.1126/science.1235989)
- Other NASA sources linked in the app: NASA PDS (https://pds.nasa.gov/), HiRISE (https://www.uahirise.org/), CRISM (https://pds-geosciences.wustl.edu/missions/mro/crism.htm), SHARAD (https://pds-geosciences.wustl.edu/missions/mro/sharad.htm)

The MEDA index endpoint returns row counts of archived product indexes; those are not measurements or a live weather feed. NASA endpoints can change availability or impose rate limits.

## Security notes

- Firebase Admin credentials are server-only and never bundled into the browser.
- Anonymous authentication creates a stable UID per browser installation. If a user clears browser storage or uses another device, anonymous accounts are not linked; add an account-linking provider before relying on cross-device identity.
- Firestore rules deny all direct client reads and writes; API routes verify ID tokens and scope all data by UID.
- Before a public production deployment, add Firebase App Check, broader API throttling, monitoring and account linking.

## AI assistance (NASA Space Apps disclosure)

This project was built with the help of an AI coding assistant (Claude, by Anthropic, used through Claude Code). The assistant helped write and debug code (the Next.js web app, the Python feature-engineering notebook, scripts and automated tests) and documentation, and its work is recorded in the commit history (`Co-Authored-By` lines). Humans chose the challenge and the goals, and reviewed, ran and tested the results. No AI-generated images, audio or video are used: all images are NASA/JPL-Caltech, ESA, USGS or derived from those data.
