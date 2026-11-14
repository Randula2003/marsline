#!/usr/bin/env python3
"""Builds the 7-slide NASA Space Apps demo deck (editable PowerPoint) for Marsline.
Edit TEAM_NAME / MEMBERS / LIVE_URL below (or edit the .pptx directly), then:
    python docs/demo/prepare_images.py && python docs/demo/build_deck.py
Needs: pip install python-pptx pillow"""
import json
from pathlib import Path
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_MARKER_STYLE, XL_TICK_LABEL_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

TEAM_NAME = "[Team name]"
MEMBERS = "[Member names]"
LIVE_URL = "[Live app URL]"
REPO = "github.com/Randula2003/marsline"

HERE = Path(__file__).resolve().parent
IMG = HERE / "images"
ROOT = HERE.parent.parent
rgb = lambda h: RGBColor.from_string(h)
BG, PANEL, TEXT, MUTED = "0E1319", "18212B", "F2F4F7", "A5B1BD"
RUST, SAND, SKY, GREEN, RED, AMBER = "E8783A", "F5D3B2", "38BDF8", "4ADE80", "F87171", "F59E0B"
FONT = "Calibri"

prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]

def new_slide(notes):
    s = prs.slides.add_slide(BLANK); s.background.fill.solid(); s.background.fill.fore_color.rgb = rgb(BG)
    s.notes_slide.notes_text_frame.text = notes; return s

def text(slide, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP, name=None):
    """paras: list of dicts(text|runs, size, color, bold, align, space_after)"""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)); tf = tb.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0; tf.vertical_anchor = anchor
    if name: tb.name = name
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = p.get("align", PP_ALIGN.LEFT)
        if "space_after" in p: para.space_after = Pt(p["space_after"])
        for r in (p["runs"] if "runs" in p else [dict(text=p["text"])]):
            run = para.add_run(); run.text = r["text"]; f = run.font; f.name = FONT
            f.size = Pt(r.get("size", p.get("size", 16))); f.bold = r.get("bold", p.get("bold", False)); f.italic = r.get("italic", p.get("italic", False))
            f.color.rgb = rgb(r.get("color", p.get("color", TEXT)))
    return tb

def card(slide, x, y, w, h, fill=PANEL, name=None):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.adjustments[0] = 0.04; sh.fill.solid(); sh.fill.fore_color.rgb = rgb(fill); sh.line.fill.background(); sh.shadow.inherit = False
    if name: sh.name = name
    return sh

def picture(slide, path, x, y, w, h, alt):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h)); pic._element.nvPicPr.cNvPr.set("descr", alt); return pic

def title(slide, t):
    text(slide, 0.7, 0.45, 11.9, 1.1, [dict(text=t, size=38, bold=True)], anchor=MSO_ANCHOR.MIDDLE, name="Title")

# ---------------------------------------------------------------------------------------------------------------- 1
s = new_slide("Introduce yourself and your team. Say the challenge name: Interplanetary Survival Guide, Martian Map. One sentence: Marsline is a map and route planner for a single Mars walk, built on real NASA and ESA data.")
picture(s, IMG / "hero.jpg", 6.93, 0, 6.4, 7.5, "Map of Jezero Crater showing terrain safety classes, science targets and walking routes")
text(s, 0.7, 0.8, 6.0, 0.8, [dict(text="NASA SPACE APPS 2026  ·  INTERPLANETARY SURVIVAL GUIDE: MARTIAN MAP", size=13, bold=True, color=RUST)])
text(s, 0.7, 1.9, 6.0, 1.5, [dict(text="Marsline", size=80, bold=True)], name="Title")
text(s, 0.7, 3.5, 6.0, 1.2, [dict(text="A layered Marswalk map and route planner", size=28, bold=True, color=SAND)])
text(s, 0.7, 4.6, 6.0, 1.0, [dict(text="Where can the first astronauts walk, and what will they face when they get there?", size=18, color=MUTED)])
text(s, 0.7, 6.15, 6.0, 0.9, [dict(runs=[dict(text="Team  ", color=RUST, bold=True), dict(text=TEAM_NAME)], size=16, space_after=4),
                              dict(runs=[dict(text="Members  ", color=RUST, bold=True), dict(text=MEMBERS)], size=16)])

# ---------------------------------------------------------------------------------------------------------------- 2
s = new_slide("The challenge asks for a map a Mars astronaut can use on a surface walk. Existing tools show the planet or whole regions. A crew needs hyper-local, safety-first guidance for one excursion: which ground is safe, how long it takes, what it looks like.")
title(s, "A crew needs a map for one walk, not a whole planet")
for x, img, head, sub, alt in [(0.7, "regional.jpg", "Regional view", "178 km wide · one pixel = 463 m", "Coarse elevation map of the Syrtis Major region"),
                               (6.95, "detail.jpg", "Crew-scale view", "11 km wide · one pixel = 20 m, with imagery and geology", "High-resolution orbital image of the Jezero delta")]:
    picture(s, IMG / img, x, 1.8, 5.7, 3.97, alt)
    text(s, x, 5.9, 5.7, 0.4, [dict(text=head, size=20, bold=True, color=SAND)])
    text(s, x, 6.3, 5.7, 0.4, [dict(text=sub, size=14, color=MUTED)])
text(s, 0.7, 6.85, 12, 0.4, [dict(text="Global tools show the planet. A spacewalk covers a few kilometres.", size=16, italic=True)])

# ---------------------------------------------------------------------------------------------------------------- 3
s = new_slide("Same place, four layers: optical, thermal, slope and the safety map that combines slope, roughness and geology. The crew can switch layers, hover for elevation, slope, class and rock unit, and click a target to plan a route.")
title(s, "One integrated view of one location")
tiles = [("layer_ctx.jpg", "Optical", "MRO CTX imagery", "CTX orbital image of the Jezero delta"), ("layer_thermal.jpg", "Thermal", "Odyssey THEMIS night infrared", "Night-time thermal infrared image of the same window"),
         ("layer_slope.jpg", "Slope", "Derived from HRSC elevation", "Slope layer of the same window"), ("layer_traversability.jpg", "Safety map", "Slope + roughness + geology", "Traversability map: green nominal, amber caution, red no-go")]
for i, (f, head, sub, alt) in enumerate(tiles):
    x = 0.7 + i * 3.1
    picture(s, IMG / f, x, 1.75, 2.9, 2.9, alt)
    text(s, x, 4.75, 2.9, 0.4, [dict(text=head, size=20, bold=True, color=SAND)])
    text(s, x, 5.15, 2.9, 0.6, [dict(text=sub, size=14, color=MUTED)])
for i, (big, small) in enumerate([("8 + 4", "map layers and geology overlays"), ("Hover", "elevation, slope, terrain class, rock unit"), ("Click", "a target and the route appears")]):
    x = 0.7 + i * 4.1
    card(s, x, 6.0, 3.9, 1.05)
    text(s, x + 0.25, 6.0, 1.5, 1.05, [dict(text=big, size=26, bold=True, color=RUST)], anchor=MSO_ANCHOR.MIDDLE)
    text(s, x + 1.75, 6.0, 2.0, 1.05, [dict(text=small, size=14, color=TEXT)], anchor=MSO_ANCHOR.MIDDLE)

# ---------------------------------------------------------------------------------------------------------------- 4
s = new_slide("Raw NASA, ESA and USGS files go into a notebook that engineers features. Slope and roughness come from the 75 metre HRSC elevation model; the USGS geologic map gives walking cost and science value. They combine into a safety grid, and an A-star search plans the route in the browser. Elevation was cross-checked against MOLA with a correlation of 0.995. Everything is committed so the app runs from a fresh clone.")
title(s, "From raw NASA data to a walking route")
cols = [("1  DATA IN", ["HRSC elevation (ESA)", "CTX imagery", "THEMIS thermal", "MOLA elevation", "USGS geologic map", "MEDA weather"]),
        ("2  FEATURES", ["Slope and roughness", "Geology walking cost", "Science value", "Atmospheric depth", "Checked vs MOLA: r = 0.995"]),
        ("3  SAFETY GRID", ["No-go: slope 25° or more, or a scarp", "Caution: 15° or more, rough, costly rock", "Nominal: the rest", "A cost for every 75 m cell"]),
        ("4  ROUTE", ["A* search in the browser", "Distance, time, climb, slope", "Spacewalk-limit warning", "Adjustable assumptions"])]
for i, (head, items) in enumerate(cols):
    x = 0.7 + i * 3.1
    card(s, x, 1.85, 2.8, 4.1)
    text(s, x + 0.25, 2.05, 2.4, 0.5, [dict(text=head, size=16, bold=True, color=RUST)])
    text(s, x + 0.25, 2.65, 2.35, 3.2, [dict(text=t, size=15, space_after=7) for t in items])
    if i < 3:
        ar = s.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x + 2.83), Inches(3.65), Inches(0.24), Inches(0.5)); ar.fill.solid(); ar.fill.fore_color.rgb = rgb(RUST); ar.line.fill.background(); ar.name = "Arrow"
text(s, 0.7, 6.3, 12, 0.7, [dict(runs=[dict(text="All data is committed to the repository: ", bold=True, color=SAND), dict(text="the app runs from a fresh clone with no downloads, and 17 automated tests check it.")], size=16)])

# ---------------------------------------------------------------------------------------------------------------- 5
s = new_slide("In the Jezero area, 68 percent of the ground is nominal, 30 percent needs caution and 2 percent is no-go. Route A goes from the landing site to the delta fan 1 target: almost 14 kilometres, about 7 hours at 3 kilometres per hour, maximum slope 8 degrees. Route B to the nearer fan 2 target is 1.8 kilometres. The crew can tighten the slope limit, change walking speed and set a spacewalk limit; the route and warnings update instantly.")
title(s, "Safety first: where it is safe to walk")
card(s, 0.7, 1.75, 5.0, 4.5)
text(s, 0.95, 1.9, 4.5, 0.4, [dict(text="Jezero terrain classes", size=16, bold=True, color=SAND)])
cd = CategoryChartData(); cd.categories = ["Nominal", "Caution", "No-go"]; cd.add_series("Share of area", (0.677, 0.300, 0.023))
gf = s.shapes.add_chart(XL_CHART_TYPE.DOUGHNUT, Inches(0.95), Inches(2.3), Inches(4.5), Inches(3.8), cd); gf.name = "Terrain class chart"
ch = gf.chart; ch.has_title = False; ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False; ch.legend.font.size = Pt(14); ch.legend.font.color.rgb = rgb(TEXT); ch.legend.font.name = FONT
pl = ch.plots[0]; pl.has_data_labels = True; dl = pl.data_labels; dl.number_format = "0%"; dl.number_format_is_linked = False; dl.font.size = Pt(14); dl.font.bold = True; dl.font.color.rgb = rgb(BG); dl.font.name = FONT
for i, c in enumerate([GREEN, AMBER, RED]):
    pt = pl.series[0].points[i]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(c); pt.format.line.color.rgb = rgb(PANEL)
picture(s, IMG / "route.jpg", 6.0, 1.75, 6.63, 2.66, "Map of the delta area with two planned walking routes from the landing site to science targets")
for i, (lab, km, tm, sl) in enumerate([("Route A · landing site to delta fan 1", "13.9 km", "7 h 11 min", "max slope 8.0°"), ("Route B · landing site to delta fan 2", "1.8 km", "1 h 07 min", "max slope 6.5°")]):
    x = 6.0 + i * 3.4
    card(s, x, 4.6, 3.23, 1.65)
    text(s, x + 0.2, 4.68, 2.9, 0.4, [dict(text=lab, size=12, bold=True, color=SKY if i == 0 else "F472B6")])
    text(s, x + 0.2, 5.05, 2.9, 0.7, [dict(text=km, size=32, bold=True)])
    text(s, x + 0.2, 5.75, 2.9, 0.4, [dict(text=f"{tm}  ·  {sl}", size=14, color=MUTED)])
text(s, 0.7, 6.55, 12, 0.7, [dict(runs=[dict(text="Adjustable: ", bold=True, color=SAND), dict(text="no-go slope, walking speed and spacewalk limit. The route and warnings update instantly. Times are concept estimates at 3 km/h.")], size=16)])

# ---------------------------------------------------------------------------------------------------------------- 6
s = new_slide("For Jezero we used real Perseverance MEDA measurements from four sample days, one per season. A typical day swings from about minus 70 at night to about minus 10 degrees Celsius by day. The photo is a real Perseverance image from sol 410. Radiation is shown as published context only, not a crew dose.")
title(s, "What the crew will face at Jezero")
ts = json.loads((ROOT / "public" / "data" / "regions" / "jezero" / "meda_timeseries.json").read_text())
cd = CategoryChartData(); cd.categories = [f"{h}" for h in range(24)]
for sol in ts["sols"]:
    by = {h["h"]: h.get("localTempK") for h in sol["hours"]}
    cd.add_series(f"Sol {sol['sol']} · {sol['season'].replace('Northern ', '').capitalize()}", [round(by[h] - 273.15, 1) if by.get(h) is not None else None for h in range(24)])
card(s, 0.7, 1.75, 7.2, 4.35)
text(s, 0.95, 1.88, 6.7, 0.4, [dict(text="Local temperature by hour of the Martian day (°C)", size=16, bold=True, color=SAND)])
gf = s.shapes.add_chart(XL_CHART_TYPE.LINE, Inches(0.9), Inches(2.3), Inches(6.85), Inches(3.75), cd); gf.name = "Temperature chart"
ch = gf.chart; ch.has_title = False; ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
ch.legend.font.size = Pt(12); ch.legend.font.color.rgb = rgb(TEXT); ch.legend.font.name = FONT
for ax in (ch.category_axis, ch.value_axis):
    ax.tick_labels.font.size = Pt(12); ax.tick_labels.font.color.rgb = rgb(MUTED); ax.tick_labels.font.name = FONT; ax.format.line.color.rgb = rgb("3B4650")
ch.value_axis.major_gridlines.format.line.color.rgb = rgb("2E3944"); ch.value_axis.has_title = False
ch.category_axis.tick_label_position = XL_TICK_LABEL_POSITION.LOW          # hour labels at the bottom, not on the 0 °C line
ch.category_axis.has_title = True; ch.category_axis.axis_title.text_frame.text = "Local mean solar time (hour)"
r = ch.category_axis.axis_title.text_frame.paragraphs[0].runs[0]; r.font.size = Pt(12); r.font.color.rgb = rgb(MUTED); r.font.bold = False; r.font.name = FONT
for ser, c in zip(ch.plots[0].series, [SKY, AMBER, "C4B5FD", GREEN]):
    ser.format.line.color.rgb = rgb(c); ser.format.line.width = Pt(2.5); ser.smooth = False
    ser.marker.style = XL_MARKER_STYLE.NONE
picture(s, IMG / "rover.jpg", 8.2, 1.75, 4.43, 3.32, "Perseverance Mastcam-Z view of a flat-topped butte in Jezero Crater, sol 410")
text(s, 8.2, 5.15, 4.43, 0.95, [dict(text="Perseverance, sol 410 · NASA/JPL-Caltech/ASU", size=12, color=MUTED, space_after=3), dict(text="Real ground-level view of the terrain ahead", size=14)])
for i, (big, small) in enumerate([("−70 to −10 °C", "typical day, measured by MEDA"), ("650–776 Pa", "air pressure over the four seasons"), ("0.64 mSv/day", "Mars surface cosmic rays (Curiosity), context only")]):
    x = 0.7 + i * 4.1
    card(s, x, 6.3, 3.9, 0.95)
    text(s, x + 0.2, 6.3, 3.5, 0.95, [dict(text=big, size=20, bold=True, color=RUST, space_after=2), dict(text=small, size=12, color=MUTED)], anchor=MSO_ANCHOR.MIDDLE)

# ---------------------------------------------------------------------------------------------------------------- 7
s = new_slide("Everything is open NASA, ESA and USGS data, with credits in the repository. Be honest about limits: slope limits and walking speed are concept assumptions, regional areas are coarse, and weather is four sample days. Next steps: a helmet or tablet display and more areas. Show the repository and live app links.")
title(s, "Built on open NASA and ESA data")
card(s, 0.7, 1.75, 6.0, 3.65)
text(s, 0.95, 1.9, 5.5, 0.4, [dict(text="Data and resources used", size=16, bold=True, color=SAND)])
text(s, 0.95, 2.4, 5.5, 3.0, [dict(text=t, size=16, space_after=7) for t in [
    "ESA Mars Express HRSC elevation (via USGS)", "MRO CTX imagery · Odyssey THEMIS thermal", "MGS MOLA elevation", "USGS SIM 3464 geologic map",
    "Mars 2020 MEDA weather · NASA PDS", "Perseverance raw images · NASA/JPL-Caltech", "Curiosity RAD published values (context)"]])
card(s, 6.95, 1.75, 5.68, 3.65)
text(s, 7.2, 1.9, 5.2, 0.4, [dict(text="Impact and what is next", size=16, bold=True, color=SAND)])
text(s, 7.2, 2.4, 5.2, 3.0, [dict(text=t, size=16, space_after=7) for t in [
    "Safer, faster excursion planning for a crew", "Four areas today; one line adds more", "Next: tablet and helmet display, live space weather",
    "Honest limits: concept slope limits and walking speed, coarse regional cells, four sample weather days"]])
card(s, 0.7, 5.65, 11.93, 1.35, fill="23140C")
text(s, 1.0, 5.65, 11.3, 1.35, [dict(runs=[dict(text="Code  ", bold=True, color=RUST), dict(text=REPO)], size=20, space_after=6),
                                dict(runs=[dict(text="Live app  ", bold=True, color=RUST), dict(text=LIVE_URL)], size=20)], anchor=MSO_ANCHOR.MIDDLE)

out = HERE / "Marsline_SpaceApps_Demo.pptx"; prs.save(out); print("saved", out, len(prs.slides), "slides")
