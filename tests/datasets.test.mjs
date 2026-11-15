// The Datasets page lists every dataset: check that nothing it points to is missing and that each entry is honest and complete.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DATASETS } from "../src/lib/datasets.ts";

const data = path.resolve("public/data");

test("dataset ids are unique and statuses are valid", () => {
  assert.equal(new Set(DATASETS.map((d) => d.id)).size, DATASETS.length);
  for (const d of DATASETS) assert.ok(["used", "reference", "context", "not-used"].includes(d.status), d.id);
});

test("every file and preview named by a dataset exists in the repository", () => {
  for (const d of DATASETS) {
    for (const f of d.files) assert.ok(fs.existsSync(path.join(data, f)), `${d.id}: missing ${f}`);
    if (d.preview) assert.ok(fs.existsSync(path.join(data, "datasets", d.preview)), `${d.id}: missing preview ${d.preview}`);
  }
});

test("each entry has a source link, a credit and a clear statement of use", () => {
  for (const d of DATASETS) {
    assert.ok(d.sources.length >= 1 && d.sources.every((s) => s.url.startsWith("https://")), `${d.id}: sources`);
    assert.ok(d.credit.length > 3 && d.provided.length > 5, `${d.id}: credit/provided`);
    if (d.status === "used") assert.ok(d.usedFor.length >= 1, `${d.id}: says how it is used`);
    if (d.status === "context" || d.status === "not-used") assert.ok(d.note && d.note.length > 20, `${d.id}: explains why it is not analysed`);
  }
});

test("the datasets the analysis depends on are all listed as used", () => {
  const used = new Set(DATASETS.filter((d) => d.status === "used").map((d) => d.id));
  for (const id of ["hrsc", "ctx", "themis", "usgs", "mola", "meda", "rover-images", "traverse", "rad"]) assert.ok(used.has(id), id);
  assert.ok(used.size >= 9);
});
