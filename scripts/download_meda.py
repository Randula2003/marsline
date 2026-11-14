#!/usr/bin/env python3
"""Download the Perseverance MEDA derived data files used for the Conditions charts (about 47 MB).

Source : NASA PDS Atmospheres Node, Mars 2020 MEDA derived environmental data (public archive)
         https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/
Target : data/raw/meda/sol_NNNN/   (git-ignored; the notebook turns it into a ~50 KB JSON that IS committed)
Usage  : python scripts/download_meda.py            (safe to re-run: finished files are skipped, partial ones resume)

One sol per season (solar longitude Ls about 30, 120, 210, 300 in Mars year 36). Wind (WS) files only exist for the first two.
"""
import concurrent.futures as cf
import os, sys, time, urllib.request
from pathlib import Path

BASE = "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env"
# sol -> (archive folder, [(kind, file name)])
SOLS = {
    51:  ("sol_0000_0089", [("PS", "WE__0051___________DER_PS__________________P01.CSV"), ("RHS", "WE__0051___________DER_RHS_________________P03.CSV"),
                            ("TIRS", "WE__0051___________DER_TIRS________________P04.CSV"), ("WS", "WE__0051___________DER_WS__________________P02.CSV")]),
    247: ("sol_0180_0299", [("PS", "WE__0247___________DER_PS__________________P01.CSV"), ("RHS", "WE__0247___________DER_RHS_________________P02.CSV"),
                            ("TIRS", "WE__0247___________DER_TIRS________________P03.CSV"), ("WS", "WE__0247___________DER_WS__________________P02.CSV")]),
    410: ("sol_0300_0419", [("PS", "WE__0410___________DER_PS__________________P01.CSV"), ("RHS", "WE__0410___________DER_RHS_________________P01.CSV"),
                            ("TIRS", "WE__0410___________DER_TIRS________________P02.CSV")]),
    552: ("sol_0540_0659", [("PS", "WE__0552___________DER_PS__________________P01.CSV"), ("RHS", "WE__0552___________DER_RHS_________________P01.CSV"),
                            ("TIRS", "WE__0552___________DER_TIRS________________P02.CSV")]),
}
ROOT = Path(__file__).resolve().parent.parent / "data" / "raw" / "meda"

def fetch(job):
    sol, folder, kind, name = job
    url = f"{BASE}/{folder}/sol_{sol:04d}/{name}"
    dest = ROOT / f"sol_{sol:04d}" / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 6):
        try:
            head = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60)
            total = int(head.headers.get("Content-Length", 0))
            have = dest.stat().st_size if dest.exists() else 0
            if total and have == total:
                return f"sol {sol} {kind}: already complete ({total/1e6:.1f} MB)"
            req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if 0 < have < total else {})
            with urllib.request.urlopen(req, timeout=120) as r, open(dest, "ab" if "Range" in req.headers else "wb") as f:
                while chunk := r.read(1 << 16):
                    f.write(chunk)
            if total and dest.stat().st_size != total:
                raise IOError(f"size {dest.stat().st_size} != {total}")
            return f"sol {sol} {kind}: downloaded {dest.stat().st_size/1e6:.1f} MB"
        except Exception as e:                                     # NASA's server is sometimes slow: back off and retry
            print(f"sol {sol} {kind}: attempt {attempt} failed ({type(e).__name__}: {e})", flush=True)
            time.sleep(3 * attempt)
    return f"sol {sol} {kind}: FAILED"

if __name__ == "__main__":
    jobs = [(sol, folder, kind, name) for sol, (folder, files) in SOLS.items() for kind, name in files]
    print(f"{len(jobs)} files into {ROOT}", flush=True)
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(fetch, jobs)) if False else [f.result() for f in [ex.submit(fetch, j) for j in jobs]]
    for r in results: print(r)
    sys.exit(1 if any("FAILED" in r for r in results) else 0)
