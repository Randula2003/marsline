#!/usr/bin/env python3
"""Download the 8 Perseverance surface photos shown on the Conditions page (about 0.4 MB) into the repository.

Source : NASA/JPL-Caltech Mars 2020 raw images (https://mars.nasa.gov/mars2020/multimedia/raw-images/), "medium" 800 px JPEGs.
         NASA media are free to use with credit; the credit line of each image is saved in rover.json.
Target : public/data/regions/jezero/rover/  (COMMITTED, so the app needs no network for these)
Selection: two views on each of the four sols used for the MEDA weather charts (51, 247, 410, 552): ground-level terrain (Mastcam-Z or
         Navcam), chosen by eye from the raw-image feed, skipping calibration targets and noise frames.
Usage  : python scripts/fetch_rover_images.py
"""
import json, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "regions" / "jezero" / "rover"
IMAGES = [
  {
    "sol": 51,
    "camera": "MCZ_LEFT",
    "imageId": "ZL4_0051_0671470606_064ECM_N0031950ZCAM03111_0340LUJ",
    "dateUtc": "2021-04-12T03:38:58.061",
    "credit": "NASA/JPL-Caltech/ASU",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00051/ids/edr/browse/zcam/ZL4_0051_0671470606_064ECM_N0031950ZCAM03111_0340LUJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its Left Mastcam-Z camera. Mastcam-Z is a pair of cameras located high on the rover's mast. This image was acquired on April 12, 2021 (Sol 51) at the local mean solar time of 13:13:55."
  },
  {
    "sol": 51,
    "camera": "NAVCAM_LEFT",
    "imageId": "NLE_0051_0671466170_380ECM_N0031950NCAM00408_00_0LLJ",
    "dateUtc": "2021-04-12T02:25:01.425",
    "credit": "NASA/JPL-Caltech",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00051/ids/edr/browse/ncam/NLE_0051_0671466170_380ECM_N0031950NCAM00408_00_0LLJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its onboard Left Navigation Camera (Navcam). The camera is located high on the rover's mast and aids in driving. This image was acquired on April 12, 2021 (Sol 51) at the local mean solar time of 12:01:56."
  },
  {
    "sol": 247,
    "camera": "MCZ_LEFT",
    "imageId": "ZL2_0247_0688868318_348ECM_N0072440ZCAM03249_1100LMJ",
    "dateUtc": "2021-10-30T12:23:13.028",
    "credit": "NASA/JPL-Caltech/ASU",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00247/ids/edr/browse/zcam/ZL2_0247_0688868318_348ECM_N0072440ZCAM03249_1100LMJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its Left Mastcam-Z camera. Mastcam-Z is a pair of cameras located high on the rover's mast. This image was acquired on Oct. 30, 2021 (Sol 247) at the local mean solar time of 12:39:58."
  },
  {
    "sol": 247,
    "camera": "NAVCAM_LEFT",
    "imageId": "NLG_0247_0688863009_565ECM_N0072440NCAM00500_00_2I4J",
    "dateUtc": "2021-10-30T10:54:33.503",
    "credit": "NASA/JPL-Caltech",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00247/ids/edr/browse/ncam/NLG_0247_0688863009_565ECM_N0072440NCAM00500_00_2I4J01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its onboard Left Navigation Camera (Navcam). The camera is located high on the rover's mast and aids in driving. This image was acquired on Oct. 30, 2021 (Sol 247) at the local mean solar time of 11:13:40."
  },
  {
    "sol": 410,
    "camera": "MCZ_LEFT",
    "imageId": "ZL0_0410_0703339623_331EBY_N0220000ZCAM03343_0340LMJ",
    "dateUtc": "2022-04-16T00:15:05.105",
    "credit": "NASA/JPL-Caltech/ASU",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00410/ids/edr/browse/zcam/ZL0_0410_0703339623_331EBY_N0220000ZCAM03343_0340LMJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its Left Mastcam-Z camera. Mastcam-Z is a pair of cameras located high on the rover's mast. This image was acquired on April 16, 2022 (Sol 410) at the local mean solar time of 12:58:35."
  },
  {
    "sol": 410,
    "camera": "MCZ_LEFT",
    "imageId": "ZL0_0410_0703340008_331EBY_N0220000ZCAM03344_0340LMJ",
    "dateUtc": "2022-04-16T00:20:09.104",
    "credit": "NASA/JPL-Caltech/ASU",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00410/ids/edr/browse/zcam/ZL0_0410_0703340008_331EBY_N0220000ZCAM03344_0340LMJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its Left Mastcam-Z camera. Mastcam-Z is a pair of cameras located high on the rover's mast. This image was acquired on April 16, 2022 (Sol 410) at the local mean solar time of 13:03:30."
  },
  {
    "sol": 552,
    "camera": "MCZ_LEFT",
    "imageId": "ZL0_0552_0715937204_832EBY_N0265226ZCAM08572_0480LMJ",
    "dateUtc": "2022-09-08T19:35:00.409",
    "credit": "NASA/JPL-Caltech/ASU",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00552/ids/edr/browse/zcam/ZL0_0552_0715937204_832EBY_N0265226ZCAM08572_0480LMJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its Left Mastcam-Z camera. Mastcam-Z is a pair of cameras located high on the rover's mast. This image was acquired on Sept. 8, 2022 (Sol 552) at the local mean solar time of 10:40:52."
  },
  {
    "sol": 552,
    "camera": "MCZ_LEFT",
    "imageId": "ZL0_0552_0715937009_831EBY_N0265226ZCAM08572_0480LMJ",
    "dateUtc": "2022-09-08T19:33:31.409",
    "credit": "NASA/JPL-Caltech/ASU",
    "url": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00552/ids/edr/browse/zcam/ZL0_0552_0715937009_831EBY_N0265226ZCAM08572_0480LMJ01_800.jpg",
    "caption": "NASA's Mars Perseverance rover acquired this image using its Left Mastcam-Z camera. Mastcam-Z is a pair of cameras located high on the rover's mast. This image was acquired on Sept. 8, 2022 (Sol 552) at the local mean solar time of 10:39:26."
  }
]

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    meta = []
    for i, im in enumerate(IMAGES):
        name = f"sol{im['sol']:04d}_{im['camera'].lower()}_{i}.jpg"
        (OUT / name).write_bytes(urllib.request.urlopen(im["url"], timeout=60).read())
        meta.append({"file": name, "sol": im["sol"], "camera": im["camera"], "imageId": im["imageId"], "dateUtc": im["dateUtc"], "credit": im["credit"], "caption": im["caption"], "source": im["url"]})
        print("saved", name, (OUT / name).stat().st_size // 1024, "KB")
    (OUT / "rover.json").write_text(json.dumps({"mission": "Mars 2020 Perseverance", "note": "Raw, unprocessed images. Colour and contrast are as released by the camera teams.", "images": meta}, indent=1))
