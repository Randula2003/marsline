# MARSLINE 4.0 — Next.js + Firebase Mission Intelligence

A single full-stack Next.js App Router application backed by Firebase Authentication and Cloud Firestore. This edition replaces PostgreSQL, PostGIS and Prisma completely. It retains the Mars mission console, NASA data catalogue, MEDA PDS index retrieval, route planning, life-support simulations, radiation context, mission logging and wearable interface.

## Stack

- Next.js 16 App Router + React 19 + TypeScript
- Firebase JavaScript SDK 13.3.0 for browser Authentication
- Firebase Admin SDK 14.5.1 for secure server-side Firestore operations and ID-token verification
- Cloud Firestore as the only application database
- Zod input validation
- NASA Mars Trek WMTS viewer and NASA PDS MEDA source indexes
- PWA manifest and service-worker shell cache

Node.js 22 or newer is required by the included Firebase Admin SDK. Next.js App Router uses server and client components and requires Node.js 20.9+; use Node 22 LTS for this project.

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

The first authenticated session creates the user's workspace, a demo Ares/Jezero mission, two clearly labelled example waypoints, a simulated life-support snapshot and the NASA dataset catalogue. Every API write verifies the Firebase ID token on the server before selecting the user's UID-scoped Firestore path. The browser does not receive privileged Admin credentials.

Firestore Security Rules deliberately deny direct browser reads/writes; the app uses authenticated Next.js API routes and Firebase Admin. Admin SDK calls bypass Firestore rules by design, so the API's token verification and UID-scoped paths are important.

## macOS / VS Code setup

### 1. Install Node.js

Install Node.js 22 LTS or newer from https://nodejs.org/en/download/. No Anaconda, PostgreSQL, PostGIS or Prisma is needed.

Confirm in VS Code Terminal:

```bash
node -v
npm -v
```

### Quick Firebase check

Not sure what is missing? Open **Data & Firebase** in the app for a checklist (it never shows your values), or run:

```bash
npm run check:firebase
```

It reads `.env.local`, tests a real Firestore write/read/delete and an anonymous sign-in, and prints the exact fix for anything that fails. Add `-- --no-auth-test` to skip the sign-in test (the test creates one anonymous user in your own Firebase project). No Firebase yet? The app runs in demo mode (see below).

### 2. Create Firebase project

In https://console.firebase.google.com/:

1. Create a Firebase project (or choose a dedicated project for Marsline).
2. Add a Web App from Project settings → General → Your apps.
3. Copy the Web App config values into `.env.local` as described below.
4. Go to Build → Authentication → Get started → Sign-in method and enable **Anonymous**.
5. Go to Build → Firestore Database → Create database. Choose a region and production mode.
6. In Project settings → Service accounts, generate a private key for local development. Store it securely; never place it in the source tree or commit it to Git.

### 3. Configure environment variables

Copy the example:

```bash
cp .env.local.example .env.local
```

Set the four `NEXT_PUBLIC_FIREBASE_*` values from your Firebase Web App configuration. Set the server-only Admin values using the service account JSON you downloaded:

- `FIREBASE_PROJECT_ID`: project ID
- `FIREBASE_CLIENT_EMAIL`: `client_email` from the service-account JSON
- `FIREBASE_PRIVATE_KEY`: `private_key` from that JSON, retaining `\n` sequences inside the quoted value
- `NASA_DATA_ENABLED=true`

Never prefix Admin credentials with `NEXT_PUBLIC_`. Never commit `.env.local` or the downloaded service-account JSON. `.gitignore` excludes both.

For local dev, an alternative is setting `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of your protected service-account JSON file and `FIREBASE_PROJECT_ID` to the project ID. The Admin SDK will use Application Default Credentials.

### 4. Install and run

```bash
npm install
npm run dev
```

`npm install` creates `package-lock.json`. Keep that lockfile in Git: Firebase App Hosting expects a lockfile when it builds a Next.js backend.

Open http://localhost:3000. The first page load automatically signs in anonymously, creates a UID-scoped Firestore workspace, seeds the mission catalogue, and loads waypoints/logs/resources. If Firebase is not configured, the interface stays in preview mode and displays the setup error in the connection status.

### 5. Deploy Firestore rules

Install the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
npm run firebase:deploy:rules
```

When asked, select your Firebase project. The checked-in rules deny direct client database access because all application database access is routed through Next.js API routes using Firebase Admin after token verification. The API paths use `users/{uid}` to prevent one signed-in UID from reading another UID's workspace.

### 6. Next.js deployment

For the full dynamic Next.js app, use **Firebase App Hosting**, not static Firebase Hosting. App Hosting has preconfigured Next.js support. It connects to a GitHub repository and builds/runs the app as a server application. See https://firebase.google.com/docs/app-hosting/get-started.

1. Push the project to a GitHub repository.
2. Firebase Console → App Hosting → Get started → connect repository.
3. Choose the app root (the directory with `package.json`) and a backend region.
4. Add the `NEXT_PUBLIC_FIREBASE_*` values as App Hosting environment variables.
5. For server-side Firebase Admin in App Hosting, use the platform's Application Default Credentials. Set `FIREBASE_PROJECT_ID` as an environment variable; do not upload a local service-account key into the repository.
6. Deploy Firestore rules using the Firebase CLI.

App Hosting may require the Firebase project's Blaze billing plan. Review current pricing and quotas before enabling it. Local development does not require App Hosting.

## Firebase API routes

All routes except static UI resources require `Authorization: Bearer <Firebase ID token>`:

- `POST /api/workspace` — initializes the UID's mission workspace and starter catalogue.
- `GET /api/health` — verifies caller token and checks Firestore connectivity.
- `GET /api/waypoints` / `POST /api/waypoints` — list/create Mars route waypoints.
- `DELETE /api/waypoints/:id` — delete a waypoint only from the authenticated user's workspace.
- `GET /api/logs` / `POST /api/logs` — list/create mission notes.
- `GET /api/life-support` / `POST /api/life-support` — get/save clearly simulated resource snapshots.
- `GET /api/nasa/catalog` — load the user's Firestore dataset catalogue.
- `GET /api/nasa/meda/:sensor` — fetch an allowlisted MEDA PDS CSV product index (`ATS`, `WIND`, `PS`, `RDS`, `RHS`, `TIRS`) and save retrieval metadata in Firestore.
- `GET /api/messages` / `POST /api/messages` — list or save simulated astronaut-to-station messages in the authenticated user's workspace.

Mission communications are a Firestore simulator only. Messages are not transmitted over a spacecraft radio link and are not delivered to a separate station account.

## NASA data scope

- Mars Trek viewer and WMTS docs: https://trek.nasa.gov/mars/ and https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- Perseverance MEDA archive: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html
- NASA PDS: https://pds.nasa.gov/
- HiRISE: https://www.uahirise.org/
- CRISM: https://pds-geosciences.wustl.edu/missions/mro/crism.htm
- SHARAD: https://pds-geosciences.wustl.edu/missions/mro/sharad.htm

The MEDA endpoint retrieves PDS CSV product indexes and records row count, byte count, source Last-Modified header and retrieval time. These files are indexes of archived data products; they are not real-time weather feeds and row counts are not sensor measurements. This release does not yet fetch and decode all underlying calibrated data products into plotted observation series. All sample environmental/life-support values are clearly identified as simulated or demonstration values.

NASA Mars Trek is embedded as an external interactive viewer. Waypoint coordinates are stored with the Mars IAU2000:49900 coordinate-system label; the app does not yet transform route geometries into a georeferenced HiRISE/CTX raster overlay.

## Security and deployment notes

- Firebase Admin credentials are server-only and never bundled into the browser.
- Anonymous Firebase Authentication creates a stable UID for that browser installation. If a user clears browser storage or uses another device, anonymous accounts are not automatically linked; enable and implement an account-linking provider before relying on cross-device identity.
- Firestore Rules deny all direct client reads and writes. API routes verify Firebase ID tokens and scope all application data by UID.
- The MEDA index proxy is limited to 12 requests per Firebase UID per minute and 2 MiB per upstream response. Add Firebase App Check, broader API throttling, monitoring and account linking before public production deployment.
- NASA endpoints can change availability or impose rate limits. Check the official source metadata and terms before a public challenge submission.

## Project structure

```text
src/app/                  Next.js App Router, UI and API routes
src/components/           Mission control UI
src/lib/firebase-client.ts Firebase browser auth and token-aware fetch
src/lib/firebase-admin.ts  Firebase Admin/Firestore server initialization
src/lib/server-auth.ts     Firebase ID-token verification
src/lib/firestore-workspace.ts User-scoped workspace bootstrap
firestore.rules            Deny-by-default Firestore rules
firestore.indexes.json     Firestore composite index config
firebase.json              Firebase CLI config for Firestore
apphosting.yaml            Firebase App Hosting runtime config
.env.local.example         Firebase config template
```

This is a research prototype and is not flight-certified mission software. Resource models, mission-status values and distance estimates are not real crew safety advice.

## Firebase is the storage; demo mode is the fallback

Marsline stores each user's waypoints, mission log, communications simulator, life-support snapshots and saved routes in **Cloud Firestore**, under their own anonymous **Firebase Authentication** account (see "Firebase setup" above, and run `npm run check:firebase` to test the connection).

If Firebase is not configured (the web settings are missing or still contain the `YOUR_...` placeholders), Marsline starts in **demo mode** instead, so anyone can still run every feature: the same data is kept in the browser (localStorage). The sidebar shows **DEMO MODE** or **FIREBASE CONNECTED**, and **Data & Firebase** has buttons to switch to demo mode or reset the demo data. The NASA PDS index fetches call NASA through the server in both modes.

To force demo mode even when Firebase is configured, set `NEXT_PUBLIC_DEMO_MODE=true`.

## Study-area data pipeline (feature engineering)

The map, slope/traversability layers and route planner are driven by files in `public/data/regions/<area>/`, which are **generated** from the NASA/USGS raw data by a notebook:

1. Put `Marsline_NASA_Resources.zip` in `~/Downloads` (or set the `MARSLINE_ZIP` environment variable).
2. Open `notebooks/01_feature_engineering.ipynb` in Jupyter (Anaconda) and run all cells. It needs `geopandas pyogrio pyproj shapely tifffile imagecodecs` in addition to the usual numpy/scipy/pandas/Pillow/matplotlib; the first cell tells you what to install if something is missing.
3. Raw extracts go to `data/raw/` (git-ignored, about 230 MB). Outputs (about 20 MB) go to `public/data/regions/`.
4. Run `npm run dev` and open **Surface map**. Pick an area from the tabs above the map.

**Areas included**

| Area | Scale | Data |
|---|---|---|
| Jezero Crater & delta | detailed, 75 m | HRSC elevation, CTX imagery, THEMIS day/night IR, USGS geologic map, MOLA cross-check, MEDA index coverage |
| Nili Fossae, Syrtis Major (Nili Patera), Isidis Planitia | regional, 463 m | MGS MOLA elevation only: hillshade, slope, traversability, relief-derived targets, routes |

**Real Perseverance weather (Jezero):** `python scripts/download_meda.py` downloads about 47 MB of MEDA data (one sol per season) from NASA PDS into `data/raw/meda/` (git-ignored). The notebook (section 11b) reduces it to `public/data/regions/jezero/meda_timeseries.json` (about 50 KB), which is **committed**, so the Conditions charts work on a fresh clone with no download.

**Rover photos:** `python scripts/fetch_rover_images.py` saves 8 NASA/JPL-Caltech surface photos (about 0.4 MB, committed) from the same sols as the weather charts. **Radiation context:** every area has an "Atmospheric depth" layer (more atmosphere overhead = slightly more shielding; context only, not a dose).

**Adjustable assumptions:** in the route panel you can tighten the no-go slope, change the walking speed and set a spacewalk limit; the route, time and warnings update immediately.

**What is in git and what is regenerated**

| In git (the app runs from these) | Not in git (only needed to regenerate) |
|---|---|
| `public/data/regions/*` (maps, grids, GeoJSON, thumbnails, MEDA JSON, rover photos), `notebooks/`, `scripts/`, `tests/`, `.github/workflows/ci.yml` | `data/raw/` (zip extracts and MEDA downloads, about 280 MB), `.env.local` (your Firebase keys) |

Run `npm test` to check the data files and the route planner. GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the production build on every pull request.

**Add another area:** append one line to `REGIONS` in notebook section 14 (id, name, centre lat/lon, half-size in degrees, a short description), then run all cells. The area must lie inside the MOLA tile you have (longitude 0 to 90 °E, latitude 0 to 44 °N). For areas outside that window (for example Gale Crater) you need the matching MOLA tile from https://www.mars.asu.edu/data/ . New areas appear in the app automatically through `public/data/regions/index.json`.

The colour and THEMIS PNG mosaics in the zip carry no map coordinates, so they are not used. Jezero's thermal layers come from the USGS database instead.

Slope limits (Jezero 15° caution / 25° no-go; regional 8° / 15° because 463 m cells smooth steep ground), geologic-unit cost multipliers, science scores and the 3 km/h walking speed are concept-level assumptions, not NASA-certified values. Edit them in the notebook and re-run.

## AI assistance (NASA Space Apps disclosure)

This project was built with the help of an AI coding assistant (Claude, by Anthropic, used through Claude Code). The assistant helped write and debug code (the Next.js web app, the Python feature-engineering notebook, scripts and automated tests) and documentation, and its work is recorded in the commit history (`Co-Authored-By` lines). Humans chose the challenge and the goals, and reviewed, ran and tested the results. No AI-generated images, audio or video are used: all images are NASA/JPL-Caltech, ESA, USGS or derived from those data. See `docs/SPACE_APPS_SUBMISSION.md` for the Space Apps submission text.

The Space Apps demo deck (7 slides, PowerPoint and PDF) and the scripts that build it are in `docs/demo/`.
