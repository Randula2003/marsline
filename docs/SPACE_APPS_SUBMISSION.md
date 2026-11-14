# NASA Space Apps 2026 · Submission pack for Marsline

Challenge: **Interplanetary Survival Guide: Martian Map**
Official format source: the 2026 [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) and [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) (read on 14 Nov 2026; check them again before you submit, because NASA can update them).

> **Deadline:** submit on the Project tab by **Sunday 15 November, 11:59 p.m., local time of your Local Event** (Universal Event teams: local time of the Team Owner). Anything saved after that is not judged. You can edit and resubmit until then, and only the last saved version is reviewed.

---

## 1. How the submission works

You fill in the **Project tab** of your team page (profile icon → My Team → Project → Edit → Save Progress often). The form has these fields, in this order:

| # | Form field | What to put | Limit stated by NASA |
|---|---|---|---|
| 1 | Project Name | Short title (section 3) | none stated |
| 2 | High-Level Project Summary | What you built, how it addresses the challenge, why it matters | none stated |
| 3 | Link to Project Demo | **A 7-slide deck or a 30-second video**, hosted outside the site, public link | **7 slides (incl. title and intro) or 30 seconds**. Over the limit means not eligible for Global Judging |
| 4 | Link to Final Project | Public link to the live app and/or GitHub repository | link must need no login |
| 5 | Detailed Project Description | What it does, how it works, benefits, goals, tools used | none stated |
| 6 | Use of Super Intelligence (SI) | Whether and how AI tools were used (section 5) | not shown to judges |
| 7 | NASA Data | Specific NASA data and resources used (**at least one is required for a Global Award**) | none stated |
| 8 | Space Agency Partner Data and Other References | Every other dataset, tool, code, text and image used | none stated |

Then tick **both boxes** (Terms and Conditions; "Confirm All Work is Original") and press **Submit for Judging**. If a required field is empty, the button will not work. A banner confirms success.

**Practical rules from the guide**
- The page accepts pasted or uploaded **images only** (JPG, PNG or GIF, up to 10 MB each). **Videos and documents cannot be uploaded**: host them on YouTube, Google Drive, GitHub, OneDrive or Dropbox and paste a public link.
- Set every link to **public** and test it in a private browser window. If judges cannot open it, it cannot be judged.
- Everything must be in **English**. A video demo may be spoken in another language **only with English subtitles**. Slide decks must be English.
- **No images, video or audio of anyone under 18** in the demo or final project.
- All team members must be confirmed at the **same Local Event** (not waitlisted), 1 to 6 members.
- If you host a new website, the guide recommends sending it to the **FortiGuard Web Filter Classification** form (category "web-based application", company "N/A") so judge networks do not block it. Optional but sensible.
- Participants who submit receive a certificate (Profile → Participant Information → Download Participant Certificate, Letter size).

---

## 2. Paste-ready answers

Items in `[brackets]` are things only your team knows.

### Project Name
```
Marsline: a layered Marswalk map and route planner
```
Tagline for slides: *"Where can the first astronauts walk, and what will they face when they get there?"*

### High-Level Project Summary
```
Marsline is an interactive map and route planner that a Mars astronaut could use to plan a surface walk. It layers NASA and partner data for a chosen area (optical, thermal, topographic, geologic, atmospheric and radiation context) into one view, marks where it is safe to walk, and plans a terrain-aware route to science targets. Jezero Crater is covered in detail (75 m terrain, CTX imagery, THEMIS thermal, USGS geologic map, real Perseverance MEDA weather and rover photos), and three more areas (Nili Fossae, Syrtis Major and Isidis Planitia) are built from MOLA elevation. Slope, roughness and geology become no-go, caution and nominal terrain; an A* planner returns distance, walking time, climb and a warning when a walk exceeds the spacewalk limit. It matters because tools like Mars Trek show global and regional views, while a crew needs hyper-local, safety-first guidance for a single excursion.
```

### Link to Project Demo
`[URL of your 7-slide deck or 30-second video]` (outline and script in section 4).

### Link to Final Project
Use both if you can:
- Live app: `[your deployed URL]` (the app runs without any keys, so it deploys as-is; see section 6)
- Code: https://github.com/Randula2003/marsline (public)

### Detailed Project Description
```
WHAT IT DOES
Marsline is a "survival guide" map for a human Mars excursion. For each study area the crew sees one integrated view: orbital imagery, topography and hillshade, thermal infrared, geologic units, slope, a science-value layer, a traversability map (no-go / caution / nominal) and a radiation-shielding context layer. Hovering shows elevation, slope, terrain class and geologic unit. Choosing a start and destination gives a terrain-aware walking route with distance, estimated walking time, climb and descent, maximum slope, an elevation profile, and a comparison with the straight line. A spacewalk limit warns when a route is too long for one excursion, and the crew can tighten the no-go slope, change the walking speed and the spacewalk limit to see the effect immediately. For Jezero the Conditions page shows real Perseverance MEDA measurements (pressure, humidity, local and ground temperature, wind) for four seasons, plus ground-level rover photos from the same days. Each target shows a CTX orbital preview so the crew knows what the ground looks like from above.

HOW IT WORKS
A Python notebook (Jupyter) turns raw NASA, ESA and USGS data into small web-ready layers. For Jezero it computes slope (Horn method) and roughness from the 75 m HRSC elevation model, converts the USGS geologic map from its Mars MTM projection, scores each geologic unit for walking cost and science value, combines everything into traversability classes, and warps all layers to one longitude/latitude grid. The elevation was cross-checked against MGS MOLA (correlation 0.995, RMS 31 m). Other areas are built the same way from the 463 m MOLA tile. The web app (Next.js and React, a custom canvas map with no map library) runs an A* path search in the browser over the cost grid. Real MEDA files from NASA PDS are reduced to hourly medians per season. Every dataset is committed in the repository, so the app runs from a fresh clone with no downloads. Firebase (optional) saves waypoints, mission logs, a simulated communications log and routes; without Firebase the app runs in a browser demo mode. The project has 17 automated tests and continuous integration.

BENEFITS
It turns separate science datasets into a decision for a crew: where to walk, how long it takes, and what conditions to expect, with the assumptions visible and adjustable. Anyone can add a new area by adding one line to the notebook.

HONEST LIMITS
Slope limits, geologic-unit costs, science scores and the 3 km/h walking speed are concept-level assumptions, not NASA-validated mobility limits. The regional areas use 463 m cells, so local slopes are smoothed and their targets are relief-derived candidates. The MEDA data are four sample days measured at the rover's location. The radiation panel gives published context numbers and an atmospheric-depth proxy, not a crew dose.

TOOLS
Python (numpy, scipy, pandas, geopandas, shapely, pyproj, pyogrio, tifffile, scikit-image, Pillow, matplotlib), Jupyter, TypeScript, Next.js 16, React 19, Firebase Authentication and Firestore (optional), Zod, HTML canvas, Node test runner, GitHub Actions.

WHAT WE HOPE TO ACHIEVE
[Add one sentence in your own words about what the team hopes this leads to.]
```

### NASA Data
```
- MRO CTX (Context Camera) mosaic of Jezero/Nili Fossae (Caltech mosaic, 2018): optical base layer and target previews.
- Mars Odyssey THEMIS day and night infrared controlled mosaics (USGS, 2018): thermal layers.
- MGS MOLA (MEGDR 128 pixel/degree topography): elevation for the regional areas, slope, and cross-check of the HRSC elevation.
- Mars 2020 Perseverance MEDA derived data from the NASA PDS Atmospheres Node (PS pressure, RHS humidity and temperature, TIRS thermal infrared, WS wind; sols 51, 247, 410, 552) and the MEDA product indexes.
- Mars 2020 raw images (NASA/JPL-Caltech, Mastcam-Z and Navcam), 8 images.
- USGS Astrogeology Science Center, Scientific Investigations Map 3464: geologic map of the Jezero crater and Nili Fossae region (GIS database).
- Published Curiosity RAD and MSL cruise radiation measurements (Hassler et al., 2014, Science 343; Zeitlin et al., 2013, Science 340), used as cited context only.
- NASA Mars Trek and the challenge resources page were used for orientation.
```

### Space Agency Partner Data and Other References
```
Space agency partner data
- ESA (European Space Agency) Mars Express HRSC digital terrain model and hillshade for Jezero/Nili Fossae, distributed in the USGS SIM 3464 database.

Software and libraries (open source)
- Next.js, React, TypeScript, Zod, Firebase JS and Admin SDKs, ESLint.
- Python: NumPy, SciPy, pandas, GeoPandas, Shapely, pyproj, pyogrio, tifffile, imagecodecs, scikit-image, Pillow, Matplotlib, Jupyter.
- GitHub Actions for testing.

Other
- UNSCEAR average natural background dose, used as a published reference value.
- All code, text and layout were written by the team (see the AI disclosure); no third-party images or music are used other than the NASA images listed above, whose credit lines are saved in public/data/regions/jezero/rover/rover.json.
- Source code and data: https://github.com/Randula2003/marsline
```

---

## 3. How each judging criterion is addressed

Each is scored 1 to 5 at every judging level. Use these points in the description and in the demo.

| Criterion | What judges look for | Evidence in Marsline |
|---|---|---|
| **Impact** | A real problem, reach, quality | Crew safety and mission efficiency: the walk is planned around slope, geology, time and conditions instead of straight lines |
| **Creativity** | Original or meaningfully improved idea | Hyper-local, layered view for a single excursion; science targets chosen automatically; adjustable assumptions; one line adds a new area |
| **Validity** | Sound science, technically feasible, usable | Elevation cross-checked against MOLA (r = 0.995); a tested A* planner; real MEDA data; assumptions stated; works offline from the repo; 17 tests |
| **Relevance** | Answers the challenge; NASA data is core, not decoration | Uses more than three data types (optical, thermal, topographic, geologic, atmospheric, radiation context), a route that avoids obstacles, rover point-of-view photos, safety first |
| **Presentation** | Clear story, good demo | Use the 7-slide outline or 30-second script below |

**Challenge requirements checklist**

| Challenge asks for | Where it is |
|---|---|
| At least three kinds of data layered together | CTX (optical), THEMIS (thermal), HRSC/MOLA (topography), USGS (geology), MEDA (atmosphere), atmospheric-depth (radiation context) |
| Safety information | No-go / caution / nominal terrain, scarps, spacewalk limit warning, radiation context |
| A route that avoids obstacles and accounts for mobility | A* planner on slope, roughness, geology and scarps with walking-time estimate |
| Point-of-view imagery so the crew knows what to expect | 8 Perseverance surface photos and CTX previews at each target |
| A tool that can show different locations | Four areas now, and a one-line way to add more |

---

## 4. The Project Demo (pick one)

### Option A: 7-slide deck (max 7 including title). Required content: team name, member names, the challenge you chose.

1. **Title.** Marsline, tagline, team name, member names, "Interplanetary Survival Guide: Martian Map". Background: the one-page Jezero map (`public/data/regions/jezero/jezero_mission_map.png`).
2. **The problem.** The first Mars astronauts need a map for a single walk, not a whole planet. Global tools do not show safe routes, conditions and what the ground looks like.
3. **Our solution.** Screenshot of the layered map with the traversability layer and a route.
4. **How it works.** Raw NASA/ESA/USGS data, then features (slope, roughness, geology cost, science value), then the A* planner. One simple diagram.
5. **Safety and the route.** Screenshot of the route panel: distance, walking time, elevation profile, spacewalk warning, sliders.
6. **What the crew will face.** MEDA day-and-night temperature chart, a rover photo, the radiation-context panel.
7. **NASA data, impact, links.** The data list, the honest limits, the repository link and live link.

### Option B: 30-second video (follow the guide's timing)
```
[0:00] "Hi, I'm [name] from team [team name]."
[0:02] "The first astronauts on Mars will need a map for one walk, not the whole planet."
[0:05] "Marsline: a layered Marswalk map and route planner." (show title)
[0:10] "It combines NASA imagery, thermal, elevation and geology to mark where it's safe to walk, plans a route to science targets, and shows the real weather and rover photos from the same place." (screen recording: switch layers, pick a target, route appears, chart, photo)
[0:20] "Built on open NASA and ESA data, it works for four areas today and one line adds more. One day it could sit on a crew tablet or helmet display."
[0:28] "Marsline." (end)
```
Tips: keep text large, record the screen at 1080p, English subtitles if you speak another language, no one under 18 on camera, host on YouTube (unlisted works if the link needs no login) or Google Drive set to "Anyone with the link".

---

## 5. Use of Super Intelligence (SI): be accurate

The form asks whether you used AI and how. The answer is **not shown to judges**, but the guide says you must identify AI use in descriptive text and metadata for **code and data**, and judges can see any AI indicators in the project. The guide also says AI "should not be used to come up with your idea of how to solve the challenge", so describe honestly who decided what.

Suggested answer (edit it so it matches what really happened):
```
Yes. We used Claude (Anthropic) through Claude Code to help write and debug code: the Next.js web app, the Python feature-engineering notebook, automated tests and documentation. [The team decided the idea and approach: a layered, safety-first Marswalk route planner for the Jezero area, and chose the data and the study areas.] [Describe any part where the AI suggested the approach.] We reviewed and ran the code, checked the outputs against the source data, and tested the application. No AI-generated images, audio or video were used. The repository records the AI assistance in the README and in the commit messages.
```
The repository README now has an "AI assistance" section and commit messages carry a co-author line, which covers the "descriptive text and metadata" rule.

---

## 6. Before you press Submit

- [ ] Every team member is registered for the same Local Event and shows on the Members tab.
- [ ] All eight fields filled in, in English; `[brackets]` above replaced.
- [ ] Demo is within **7 slides or 30 seconds**, link public, tested in a private window.
- [ ] Final project link opens with no login. The GitHub repository is public (verified on 14 Nov 2026). A live link is stronger: the app needs no keys, so deploying the GitHub repository to Vercel (New Project, import the repository, keep defaults) or Firebase App Hosting works, then paste the URL.
- [ ] Optional: FortiGuard classification for the live site.
- [ ] Paste 3 to 5 images into the description (JPG/PNG/GIF, up to 10 MB each): the Jezero mission map, a route screenshot, the MEDA chart, a rover photo.
- [ ] Both boxes ticked, then **Submit for Judging**. Look for the confirmation banner.
- [ ] Download your certificate from your profile.
