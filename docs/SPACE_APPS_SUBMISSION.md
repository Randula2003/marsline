# NASA Space Apps 2026 · Submission pack for Marsline

Challenge: **Interplanetary Survival Guide: Martian Map**
Official format source: the 2026 [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) and [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) (read on 14 Nov 2026; check them again before you submit, because NASA can update them).

> **Deadline:** submit on the Project tab by **Sunday 15 November, 11:59 p.m., local time of your Local Event** (Universal Event teams: local time of the Team Owner). Anything saved after that is not judged. You can edit and resubmit until then, and only the last saved version is reviewed.

---

## 0. Colombo 2026 local event: what applies to you

From the *Colombo 2026 Contestant Guide to Judging & Awards* and the *Components of Project* sheet.

| Topic | Rule |
|---|---|
| **Live pitch** | **Sunday 15 November, 10:00 AM.** In person at SLIIT Malabe, or online (Google Meet / Zoom). **5 minutes presentation + 5 minutes Q&A and feedback.** Slots follow the alphabetical order of team names. Judges take notes only; scores are given afterwards from the recording. "No need for complex presentations." |
| **Judges** | 6 judges (3 in-person, 3 virtual), same rubric for both tracks. Each gives up to **50 marks** (5 criteria × 10); the average of the 6 decides Global Nominees. |
| **What judges verify on the project page** | 50–200 word summary; demo link (max 7 slides **or** 30-second video with English subtitles) with public access; no voices or pictures of anyone under 18; at least one official NASA resource; AI/SI disclosure (cite AI tools, never generate or alter NASA logos). |
| **One link** | The *Components of Project* sheet says to include **only ONE demo link** (slides **or** video). Put the deck link in the demo field. If the form also asks for a project link, give one link (the live app if you have it, otherwise the GitHub repository). The deck's last slide already shows both the repository and the live app. |
| **Local awards** | 10 sub-category awards, each scored 0 to 10 by every judge; highest average wins; one team can win several. See section 7. |

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
(Limit: **50 to 200 words**. This one is 145 words.)
```
Marsline is an interactive map and route planner that a Mars astronaut could use to plan a surface walk. It layers NASA and partner data for a chosen area (optical, thermal, topographic, geologic, atmospheric and radiation context) into one view, marks where it is safe to walk, and plans a terrain-aware route to science targets. Jezero Crater is covered in detail (75 m terrain, CTX imagery, THEMIS thermal, USGS geologic map, real Perseverance MEDA weather and rover photos), and three more areas (Nili Fossae, Syrtis Major and Isidis Planitia) are built from MOLA elevation. Slope, roughness and geology become no-go, caution and nominal terrain; an A* planner returns distance, walking time, climb and a warning when a walk exceeds the spacewalk limit. It matters because tools like Mars Trek show global and regional views, while a crew needs hyper-local, safety-first guidance for a single excursion.
```

### Link to Project Demo
The 7-slide deck is already built (it is in this repository, as an editable PowerPoint and a PDF). Paste this public link, which opens the PDF in the browser with no login:
```
https://github.com/Randula2003/marsline/blob/main/docs/demo/Marsline_SpaceApps_Demo.pdf
```
- This link works **after the pull request is merged into `main`**. Until then use the branch link: https://github.com/Randula2003/marsline/blob/feature/jezero-data-layers/docs/demo/Marsline_SpaceApps_Demo.pdf
- Safest: also upload the PDF to Google Drive (Share, "Anyone with the link") and use that link, because it does not depend on the repository.
- Before submitting, **put your team name and member names on slide 1** (the guide requires them): edit `Marsline_SpaceApps_Demo.pptx` in PowerPoint (or change `TEAM_NAME` and `MEMBERS` at the top of `docs/demo/build_deck.py` and rebuild), export a new PDF, and replace the file.

### Link to Final Project
Paste both lines:
```
Live app: [your deployed URL]
Code: https://github.com/Randula2003/marsline
```
The code link is public and ready. The live app needs a one-time deploy from your own account (section 6); the app needs no keys, so it works as-is. Also type the live URL on slide 7 of the deck.

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
The form asks for **links to all resources used**. Paste this block:
```
Challenge page and resources: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources
- NASA Mars Trek (orientation): https://trek.nasa.gov/mars/
- MRO CTX (Context Camera) mosaic and Mars Odyssey THEMIS day/night infrared mosaics, distributed in the USGS SIM 3464 database: https://pubs.usgs.gov/sim/3464/ (database: https://pubs.usgs.gov/sim/3464/sim3464_database.zip)
- Mars Orbital Data Explorer (CTX and other orbital products): https://ode.rsl.wustl.edu/mars/
- MGS MOLA topography (MEGDR 128 pixel/degree) and THEMIS mosaics: https://www.mars.asu.edu/data/
- Mars 2020 Perseverance MEDA derived data (pressure, humidity/temperature, thermal infrared, wind), NASA PDS Atmospheres Node: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html (files: https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/)
- Mars 2020 Perseverance raw images (NASA/JPL-Caltech, 8 images used; credits in the repository): https://mars.nasa.gov/mars2020/multimedia/raw-images/
- Mars 2020 PDS archive: https://pds-geosciences.wustl.edu/missions/mars2020/
- Curiosity RAD / MSL radiation measurements, used as cited context only: Hassler et al. 2014, Science 343, https://doi.org/10.1126/science.1244797 ; Zeitlin et al. 2013, Science 340, https://doi.org/10.1126/science.1235989
```
(Link check on 14 Nov 2026: the two DOIs were confirmed through Crossref as the right papers; USGS SIM 3464, mars.asu.edu, Mars Trek and the Mars 2020 PDS archive opened. Five links could not be reached from the machine that wrote this pack: the Mars Orbital Data Explorer, UNSCEAR, the ESA Mars Express page, the NASA raw-images page and the challenge resources page. **Click each of them once yourself before you submit.**)

### Space Agency Partner Data and Other References
```
Space Agency Partner data
- ESA Mars Express HRSC digital terrain model and hillshade for Jezero/Nili Fossae, distributed in the USGS SIM 3464 database: https://pubs.usgs.gov/sim/3464/ (mission: https://www.esa.int/Science_Exploration/Space_Science/Mars_Express)

Other data
- USGS Astrogeology Science Center, SIM 3464 geologic map of the Jezero crater and Nili Fossae region: https://pubs.usgs.gov/sim/3464/
- UNSCEAR (average natural background radiation, reference value): https://www.unscear.org/

Software and libraries (open source)
- Next.js https://nextjs.org/ · React https://react.dev/ · TypeScript https://www.typescriptlang.org/ · Zod https://zod.dev/ · Firebase https://firebase.google.com/ · ESLint https://eslint.org/
- Python: NumPy https://numpy.org/ · SciPy https://scipy.org/ · pandas https://pandas.pydata.org/ · GeoPandas https://geopandas.org/ · Shapely https://shapely.readthedocs.io/ · pyproj https://pyproj4.github.io/pyproj/ · scikit-image https://scikit-image.org/ · Pillow https://python-pillow.org/ · Matplotlib https://matplotlib.org/ · Jupyter https://jupyter.org/ · python-pptx https://python-pptx.readthedocs.io/

Our own work
- Source code, notebook, data pipeline and tests: https://github.com/Randula2003/marsline
- All code, text and layout were written by the team with the AI assistance disclosed above. No third-party images other than the NASA images listed; their credit lines are in public/data/regions/jezero/rover/rover.json.
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

**Built and ready:** `docs/demo/Marsline_SpaceApps_Demo.pptx` (editable, with speaker notes) and `docs/demo/Marsline_SpaceApps_Demo.pdf`. Rebuild with `python docs/demo/prepare_images.py && python docs/demo/build_deck.py` (needs `pip install python-pptx pillow`). The outline it follows:

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

The form also has a **drop-down: select every tool you used**. For this project that means a large language model / chatbot and a code-generation tool (Claude, through Claude Code). Do **not** select image, video or audio generation: none was used. Do not use or alter NASA logos, flags or mission identifiers anywhere (the deck and app only use the plain words "NASA" and real NASA images with credits).

Suggested answer (edit it so it matches what really happened):
```
Yes. We used Claude (Anthropic) through Claude Code to help write and debug code: the Next.js web app, the Python feature-engineering notebook, automated tests and documentation. [The team decided the idea and approach: a layered, safety-first Marswalk route planner for the Jezero area, and chose the data and the study areas.] [Describe any part where the AI suggested the approach.] We reviewed and ran the code, checked the outputs against the source data, and tested the application. No AI-generated images, audio or video were used. The repository records the AI assistance in the README and in the commit messages.
```
The repository README now has an "AI assistance" section and commit messages carry a co-author line, which covers the "descriptive text and metadata" rule.

---

## 6. Before you press Submit

- [ ] Every team member is registered for the same Local Event and shows on the Members tab.
- [ ] All eight fields filled in, in English; `[brackets]` above replaced.
- [ ] Demo is within **7 slides or 30 seconds**, link public, tested in a private window. Team name and members are on slide 1; the live URL is on slide 7.
- [ ] Final project link opens with no login. The GitHub repository is public (verified on 14 Nov 2026). A live link is stronger: the app needs no keys, so deploying the GitHub repository to Vercel (New Project, import the repository, keep defaults) or Firebase App Hosting works, then paste the URL.
- [ ] Optional: FortiGuard classification for the live site.
- [ ] Paste 3 to 5 images into the description (JPG/PNG/GIF, up to 10 MB each): the Jezero mission map, a route screenshot, the MEDA chart, a rover photo.
- [ ] Both boxes ticked, then **Submit for Judging**. Look for the confirmation banner.
- [ ] Download your certificate from your profile.

---

## 7. Live pitch on 15 November, 10:00 AM (5 minutes + 5 minutes Q&A)

Use the 7-slide deck. Keep it simple: judges said they want feedback, not a complex show. About 700 words in 5 minutes. Practise once with a timer.

| Slide | Time | What to say |
|---|---|---|
| 1 Title | 0:20 | "We are team [name]. Our challenge is the Interplanetary Survival Guide, the Martian Map. Our project is Marsline, a layered map and route planner for one Mars walk." |
| 2 Problem | 0:40 | "The first astronauts will walk a few kilometres, not across a planet. Global and regional tools show broad layers. On the left, one pixel is 463 metres. On the right, one pixel is 20 metres and you can see the delta. A crew needs the second kind of view, and it needs to know where it is safe to walk." |
| 3 Layers | 0:40 | "For one place we combine optical imagery, thermal infrared, slope, and a safety map that adds roughness and geology. The crew can hover to read elevation, slope and rock type, and click a target to get a route." |
| 4 How it works | 0:45 | "Raw NASA, ESA and USGS data goes into a notebook. It computes slope and roughness from elevation, scores the geologic units, and builds a safety grid. We checked our elevation against a second NASA dataset, MOLA, and it agrees with a correlation of 0.995. Then A*, a standard pathfinding algorithm, plans the route. Everything is in the repository, so it runs from a fresh clone." |
| 5 Safety and route | 0:55 | "In Jezero, 68 percent of the ground is nominal, 30 percent needs caution and 2 percent is no-go. This route to the delta is almost 14 kilometres, about 7 hours, maximum slope 8 degrees. The nearer target is 1.8 kilometres. The crew can tighten the slope limit, change walking speed and set a spacewalk limit, and the route and the warning update instantly." |
| 6 Conditions | 0:50 | "For Jezero we used real Perseverance weather data for four seasons. A typical day swings from about minus 70 at night to minus 10 degrees by day. This is a real photo from the rover on sol 410. We show radiation as published context only, not as a crew dose." |
| 7 Data and next | 0:40 | "We used NASA and ESA data throughout. We are honest about limits: the slope limits and walking speed are concept assumptions, and the regional areas are coarse. Next we would add a tablet or helmet display and live space weather. The code and the live app are linked here. Thank you." |

### Likely questions, with honest short answers
- **Where do the slope limits come from?** "They are concept assumptions (25 degrees no-go, 15 degrees caution at 75 metre resolution), not NASA-certified limits. That is why the crew can change them in the app."
- **How accurate is the terrain?** "Jezero uses the 75 metre HRSC elevation model; we cross-checked it against MOLA: correlation 0.995, about 31 metres RMS."
- **What is real and what is simulated?** "Real: terrain, imagery, geology, Perseverance weather and rover photos. Estimated: walking time at 3 km/h. Simulated: the life-support values and the communications log, which are labelled as such."
- **Why A*?** "It is a standard, fast algorithm that finds the cheapest walkable route over a cost grid, so we can run it in the browser and change the assumptions live."
- **Why only Jezero in detail?** "It is where the supplied data is richest: imagery, geology and weather. The three regional areas show the method works elsewhere with elevation alone; one line in the notebook adds a new area."
- **How did you use AI?** Answer exactly as in your SI disclosure. State clearly what the team decided and what the AI helped write.
- **What would a crew actually use it on?** "A tablet or habitat display for planning, and later a helmet display. Right now it is a planning concept."
- **Local impact for Sri Lanka?** Only as a clearly stated idea, not a built feature: "The same method (open elevation data, slope, safe-route search) could be tried on Earth terrain, for example to plan routes through landslide-prone hills. We have not built that yet."

---

## 8. Local sub-category awards: where Marsline honestly fits

Each award is scored 0 to 10 by every judge. Do not claim all ten; lean on the ones the evidence supports.

| Award | Fit | Evidence to mention |
|---|---|---|
| Best Use of Data | **Strong** | Six NASA/ESA/USGS datasets turned into one working tool; real MEDA and rover data |
| Best Use of Science | **Strong** | Slope, roughness, geology, atmospheric depth; MOLA cross-check; assumptions stated |
| Best Use of Technology | **Strong** | Data pipeline, A* planner in the browser, custom map, tests and CI, demo mode |
| Best Mission Concept | **Good** | Base, targets, routes, spacewalk limit, conditions: a plausible excursion plan |
| Best Storytelling | Possible | A clear problem-to-route story in the deck and pitch |
| Most Inspirational | Possible | Real rover photos and a walkable Mars |
| Galactic Impact | Moderate | Safer excursion planning for future crews |
| Art & Technology | Moderate | Designed dark interface, one-page maps, deck |
| Local Impact (Sri Lanka) | Weak | Only as a future idea; say so |
| Global Connection | Weak | Open data and open code, shared on GitHub |
