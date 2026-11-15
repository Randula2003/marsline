#!/usr/bin/env python3
"""Cut the pictures used in the demo deck out of the repository's own data (no downloads).
Usage: python docs/demo/prepare_images.py   (needs Pillow)"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
R = ROOT / "public" / "data" / "regions"
OUT = Path(__file__).resolve().parent / "images"; OUT.mkdir(exist_ok=True)

def frac_crop(im, x0, y0, w, h):                      # crop by fractions of the image (all Jezero layers share one extent)
    W, H = im.size; return im.crop((int(x0 * W), int(y0 * H), int((x0 + w) * W), int((y0 + h) * H)))

def over(base, layer):                                # layer (RGBA) on top of base, resized to the base
    return Image.alpha_composite(base.convert("RGBA"), layer.convert("RGBA").resize(base.size, Image.NEAREST)).convert("RGB")

# 1. hero: the one-page Jezero map (plot area only), portrait crop for the right half of the title slide
m = Image.open(R / "jezero" / "mission_map.png").convert("RGB"); W, H = m.size
plot = (int(.1005 * W), int(.076 * H), int(.9398 * W), int(.715 * H)); ph = plot[3] - plot[1]; pw = int(ph * 6.4 / 7.5)   # stops above the legend box
x0 = plot[0] + int(.06 * (plot[2] - plot[0]))
frac = m.crop((x0, plot[1], x0 + pw, plot[3])); frac.thumbnail((1200, 1400)); frac.save(OUT / "hero.jpg", quality=86)
# 2. route detail from the same map
rc = m.crop((int(.44 * W), int(.108 * H), int(.94 * W), int(.279 * H))); rc.thumbnail((1600, 700)); rc.save(OUT / "route.jpg", quality=88)   # 2.49 : 1, the shape of its slide frame

# 3. regional (463 m) versus crew-scale (20 m) pictures
reg = R / "syrtis-major"
h = Image.open(reg / "hillshade.png").convert("RGB"); e = Image.open(reg / "elevation.png")
regional = over(h, e); w_, h_ = regional.size; hh = int(w_ / 1.436); y_ = (h_ - hh) // 2
regional = regional.crop((0, y_, w_, y_ + hh)).resize((1148, 800), Image.NEAREST); regional.save(OUT / "regional.jpg", quality=88)   # same shape as its slide frame
ctx = Image.open(R / "jezero" / "ctx.jpg").convert("RGB")
detail = frac_crop(ctx, .52, .16, .20, .1327).resize((1148, 800), Image.LANCZOS); detail.save(OUT / "detail.jpg", quality=88)

# 4. four layers of the same window
win = (.47, .10, .36, .36)
j = R / "jezero"
base = frac_crop(ctx, *win).resize((700, 700), Image.LANCZOS)
tiles = {
    "layer_ctx": base,
    "layer_thermal": frac_crop(Image.open(j / "themis_night.png").convert("RGB"), *win).resize((700, 700), Image.BICUBIC),
    "layer_slope": over(base, frac_crop(Image.open(j / "slope.png"), *win)),
    "layer_traversability": over(base, frac_crop(Image.open(j / "traversability.png"), *win)),
}
for k, v in tiles.items(): v.save(OUT / f"{k}.jpg", quality=88)

# 5. rover photo used on the weather slide
Image.open(j / "rover" / "sol0410_mcz_left_4.jpg").convert("RGB").save(OUT / "rover.jpg", quality=90)
print("images:", sorted(p.name for p in OUT.iterdir()), round(sum(p.stat().st_size for p in OUT.iterdir()) / 1024), "KB")
