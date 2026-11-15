#!/usr/bin/env python3
"""Make the small preview pictures shown on the app's Datasets page (about 1 MB in total, committed).
Built only from the repository's own data plus three pictures from the supplied zip (Curiosity route image and the two global mosaics).
Usage: python scripts/make_dataset_previews.py   (needs Pillow, matplotlib; set MARSLINE_ZIP if the zip is not in ~/Downloads)"""
import json, os, zipfile
from pathlib import Path
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PatchCollection, LineCollection
from matplotlib.patches import Polygon

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "public" / "data" / "regions"
OUT = ROOT / "public" / "data" / "datasets"; OUT.mkdir(parents=True, exist_ok=True)
ZIP = Path(os.environ.get("MARSLINE_ZIP", Path.home() / "Downloads" / "Marsline_NASA_Resources.zip"))
W = 640

def save(im, name):
    im = im.convert("RGB"); im.thumbnail((W, W)); im.save(OUT / f"{name}.jpg", quality=80); print("saved", name, im.size)

def over(base, layer): return Image.alpha_composite(base.convert("RGBA"), layer.convert("RGBA").resize(base.size, Image.NEAREST)).convert("RGB")

j = R / "jezero"
save(over(Image.open(j / "hillshade.png").convert("RGB"), Image.open(j / "elevation.png")), "hrsc")
save(Image.open(j / "thumbs" / "T2.jpg"), "ctx")
save(Image.open(j / "themis_night.png"), "themis")
save(over(Image.open(R / "syrtis-major" / "hillshade.png").convert("RGB"), Image.open(R / "syrtis-major" / "elevation.png")).resize((780, 772), Image.NEAREST), "mola")
save(Image.open(j / "rover" / "sol0410_mcz_left_4.jpg"), "rover")
v = Image.open(j / "validation.png"); save(v.crop((0, 0, int(v.width * 0.56), v.height)), "traverse")

# geology: coloured units + linear features drawn from the real GeoJSON
fig, ax = plt.subplots(figsize=(6.4, 6.4), dpi=100); fig.patch.set_facecolor("#0c1117"); ax.set_facecolor("#0c1117")
gj = json.loads((j / "geology_units.geojson").read_text()); patches, cols = [], []
for f in gj["features"]:
    g = f["geometry"]; polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
    for poly in polys:
        patches.append(Polygon(np.array(poly[0]), closed=True)); cols.append(f["properties"]["color"])
ax.add_collection(PatchCollection(patches, facecolors=cols, edgecolors="none", alpha=.85))
lines = json.loads((j / "linear_features.geojson").read_text()); segs = []
for f in lines["features"]:
    g = f["geometry"]; parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"] if g["type"] == "MultiLineString" else []
    segs += [np.array(p) for p in parts]
ax.add_collection(LineCollection(segs, colors="white", linewidths=.6, alpha=.8))
m = json.loads((j / "meta.json").read_text())["gridBounds"]; ax.set_xlim(m[1], m[3]); ax.set_ylim(m[0], m[2]); ax.set_aspect(1 / np.cos(np.radians((m[0] + m[2]) / 2))); ax.axis("off")
fig.savefig(OUT / "usgs.jpg", dpi=100, facecolor=fig.get_facecolor(), bbox_inches="tight", pad_inches=0.05); plt.close(fig); print("saved usgs")

# weather: the four measured temperature curves
ts = json.loads((j / "meda_timeseries.json").read_text()); fig, ax = plt.subplots(figsize=(6.4, 4.2), dpi=100)
fig.patch.set_facecolor("#18212b"); ax.set_facecolor("#18212b")
for s, c in zip(ts["sols"], ["#38bdf8", "#f59e0b", "#c4b5fd", "#34d399"]):
    h = [x["h"] + .5 for x in s["hours"] if "localTempK" in x]; t = [x["localTempK"] - 273.15 for x in s["hours"] if "localTempK" in x]
    ax.plot(h, t, color=c, lw=2, label=f"sol {s['sol']}")
ax.set_xlabel("local mean solar time (h)", color="#c9d1d9"); ax.set_ylabel("local temperature (°C)", color="#c9d1d9"); ax.tick_params(colors="#c9d1d9")
ax.legend(facecolor="#18212b", edgecolor="#3b4650", labelcolor="white", fontsize=8); [sp.set_color("#3b4650") for sp in ax.spines.values()]; ax.grid(color="white", alpha=.1)
fig.tight_layout(); fig.savefig(OUT / "meda.jpg", dpi=100, facecolor=fig.get_facecolor()); plt.close(fig); print("saved meda")

# pictures from the supplied zip
if ZIP.exists():
    with zipfile.ZipFile(ZIP) as z:
        for member, name in [("Curiosity_Route/PIA23179.jpg", "curiosity_route"), ("MOLA/mola_color_N00_060.png", "mola_color"), ("THEMIS/thm_dir_N00_060.png", "themis_mosaic")]:
            with z.open(f"Marsline_NASA_Resources/{member}") as f:
                im = Image.open(f); im.load() if member.endswith(".jpg") else None; save(im, name)
else:
    print("zip not found: skipped curiosity_route, mola_color and themis_mosaic")
print("total KB:", sum(p.stat().st_size for p in OUT.iterdir()) // 1024)
