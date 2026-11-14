"""Remove embedded chart images from the notebook so it stays small in git (about 80 KB instead of 5 MB).
Usage: python notebooks/strip_outputs.py notebooks/01_feature_engineering.ipynb"""
import json, sys
path = sys.argv[1] if len(sys.argv) > 1 else "notebooks/01_feature_engineering.ipynb"
nb = json.load(open(path))
for cell in nb["cells"]:
    if cell["cell_type"] != "code": continue
    kept = []
    for out in cell.get("outputs", []):
        if out.get("output_type") in ("display_data", "execute_result") and "image/png" in out.get("data", {}):
            rest = {k: v for k, v in out["data"].items() if k not in ("image/png", "text/plain")}
            if not rest: continue
            out["data"] = rest
        kept.append(out)
    cell["outputs"] = kept
json.dump(nb, open(path, "w"), indent=1, ensure_ascii=False); open(path, "a").write("\n")
print("stripped", path)
