#!/usr/bin/env python3
"""Download NASA's public Perseverance traverse (every real drive) and waypoints, used to check Marsline's hazard map.

Source : NASA/JPL Mars 2020 MMGIS public layers (mars.nasa.gov/mmgis-maps/M20/Layers/json/), about 2.3 MB in total
Target : data/raw/m20/   (git-ignored; the notebook reduces it to a small validation.json that IS committed)
Usage  : python scripts/fetch_rover_traverse.py
"""
import urllib.request
from pathlib import Path

BASE = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json"
FILES = ["M20_traverse.json", "M20_waypoints.json"]
OUT = Path(__file__).resolve().parent.parent / "data" / "raw" / "m20"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        data = urllib.request.urlopen(f"{BASE}/{name}", timeout=90).read()
        (OUT / name).write_bytes(data)
        print(f"saved {name} ({len(data) / 1e6:.1f} MB)")
