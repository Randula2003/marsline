// Sun geometry and spacewalk-window tests against values known from geometry.
import test from "node:test";
import assert from "node:assert/strict";
import { declinationDeg, sunElevationDeg, daylightLtst, interpHourly, planWindow } from "../src/lib/eva.ts";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("declination equals the obliquity at the solstice and zero at the equinox", () => {
  near(declinationDeg(90), 25.19, 1e-6, "Ls 90"); near(declinationDeg(0), 0, 1e-9, "Ls 0"); near(declinationDeg(270), -25.19, 1e-6, "Ls 270");
});

test("sun is overhead at noon on the equator at an equinox, and below the horizon at midnight", () => {
  near(sunElevationDeg(0, 0, 12), 90, 1e-6, "noon"); near(sunElevationDeg(0, 0, 0), -90, 1e-6, "midnight");
});

test("noon elevation at Jezero latitude near the northern solstice is 90 - (declination - latitude)", () => {
  near(sunElevationDeg(18.4, 90, 12), 90 - (25.19 - 18.4), 0.01, "Jezero summer noon");
});

test("daylight is 12 h at the equator at an equinox, longer in northern summer and shorter in winter at 18 N", () => {
  const eq = daylightLtst(0, 0), summer = daylightLtst(18.4, 90), winter = daylightLtst(18.4, 270);
  near(eq.sunset - eq.sunrise, 12, 1e-9, "equinox"); assert.ok(summer.sunset - summer.sunrise > 12.5); assert.ok(winter.sunset - winter.sunrise < 11.5);
});

test("polar night returns null", () => assert.equal(daylightLtst(80, 270), null));

test("hourly interpolation is linear between bin centres and wraps around midnight", () => {
  const v = Array.from({ length: 24 }, (_, h) => h);                                  // value = hour index at centre h + 0.5
  near(interpHourly(v, 5.5), 5, 1e-9, "at a centre"); near(interpHourly(v, 6), 5.5, 1e-9, "between centres");
  near(interpHourly(v, 0), 11.5, 1e-9, "wrap");   // halfway between the 23.5 centre (value 23) and the 0.5 centre (value 0)
});

test("a 4 h walk at an equinox on the equator can start between 06:00 and 14:00 (daylight only)", () => {
  const r = planWindow({ latDeg: 0, lsDeg: 0, durationH: 4 });
  assert.ok(r.feasible); near(r.windows[0].from, 6, 0.26, "earliest"); near(r.windows[0].to, 14, 0.26, "latest");
});

test("a walk longer than the daylight is not feasible and says why", () => {
  const r = planWindow({ latDeg: 0, lsDeg: 0, durationH: 13 });
  assert.equal(r.feasible, false); assert.match(r.reason, /longer than the daylight/);
});

test("a temperature limit removes the cold morning starts", () => {
  const temps = Array.from({ length: 24 }, (_, h) => -70 + Math.max(0, 60 - Math.abs(h + 0.5 - 14) * 8)); // coldest at night, warmest at 14:00
  const loose = planWindow({ latDeg: 0, lsDeg: 0, durationH: 3, tempHourlyC: temps, minTempC: -80 });
  const strict = planWindow({ latDeg: 0, lsDeg: 0, durationH: 3, tempHourlyC: temps, minTempC: -30 });
  assert.ok(loose.feasible && strict.feasible); assert.ok(strict.windows[0].from > loose.windows[0].from, "strict limit starts later");
  assert.ok(strict.best.coldestAirC >= -30);
  const impossible = planWindow({ latDeg: 0, lsDeg: 0, durationH: 3, tempHourlyC: temps, minTempC: 10 });
  assert.equal(impossible.feasible, false);
});

test("the equation-of-time offset shifts the daylight window", () => {
  const a = planWindow({ latDeg: 0, lsDeg: 0, durationH: 4, ltstOffsetH: 0 }), b = planWindow({ latDeg: 0, lsDeg: 0, durationH: 4, ltstOffsetH: -0.5 });
  near(a.daylight.sunrise - b.daylight.sunrise, -0.5, 1e-9, "sunrise shifts by the offset");
});
