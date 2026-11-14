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
- Add App Check, request throttling, monitoring and account linking before public production deployment.
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

## Jezero data pipeline (feature engineering)

The map, slope/traversability layers and route planner are driven by files in `public/data/jezero/`, which are **generated** from the NASA/USGS raw data by a notebook:

1. Put `Marsline_NASA_Resources.zip` in `~/Downloads` (or set the `MARSLINE_ZIP` environment variable).
2. Open `notebooks/01_feature_engineering.ipynb` in Jupyter (Anaconda) and run all cells. It needs `geopandas pyogrio pyproj shapely tifffile imagecodecs` in addition to the usual numpy/scipy/pandas/Pillow/matplotlib; the first cell tells you what to install if something is missing.
3. Raw extracts go to `data/raw/` (git-ignored, about 230 MB). Outputs (about 8 MB) go to `public/data/jezero/`.
4. Run `npm run dev` and open **Surface map**.

Outputs: CTX, THEMIS day/night, hillshade, elevation, slope, science-value and traversability images; geology, linear-feature, crater and landing-ellipse GeoJSON; `grid_data.png` / `grid_elev.png` (data textures the A* planner decodes in the browser); `science targets` and layer metadata in `meta.json`; MEDA sol/season coverage in `meda_coverage.json`.

Slope limits (15° caution, 25° no-go), geologic-unit cost multipliers, science scores and the 3 km/h walking speed are concept-level assumptions, not NASA-certified values. Edit them at the top of the notebook (`UNIT_RULES`, `SLOPE_*`) and re-run.
