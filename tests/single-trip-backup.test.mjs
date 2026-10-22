import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectTravelSnapshot,
  buildScopedBackup,
  travelExportName,
} from "../src/backup/model.mjs";
import { validateTravelBackup } from "../src/travel/model.mjs";
import { validateOverseasBackup } from "../src/travel/overseas-model.mjs";
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=";
const trip = (id, title) => ({
  id,
  title,
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  stops: [{ cityId: "110000", spots: [{ name: "故宫", grade: "5A" }] }],
  note: "旅行感受",
  photos: [{ id: "photo", dataURL: photo, caption: "照片说明" }],
  story: "这一篇的游记",
  storySource: "manual",
  updatedAt: 1,
});
const snapshot = () => ({
  trips: [trip("same-id", "北京旅行"), trip("other-trip", "不要导出这篇")],
  overseasTrips: [
    {
      ...trip("same-id", "东京旅行"),
      stops: [{ countryCode: "JP", city: "东京", spots: ["浅草寺"] }],
    },
  ],
  visitedCities: [
    { cityId: "310000", date: "2026-09-01", note: "独立标记", updatedAt: 1 },
  ],
  spots: [{ id: "unrelated", name: "独立景点" }],
});
test("single domestic diary excludes every other diary and independent travel records, preserving story and photos", () => {
  const source = snapshot(),
    data = buildScopedBackup(
      selectTravelSnapshot(source, { kind: "domestic", id: "same-id" }),
      "travel",
      true,
    );
  assert.equal(validateTravelBackup(data).trips.length, 1);
  assert.equal(validateOverseasBackup(data).trips.length, 0);
  assert.equal(data.travel.trips[0].title, "北京旅行");
  assert.equal(data.travel.trips[0].photos[0].dataURL, photo);
  assert.equal(data.travel.trips[0].photos[0].caption, "照片说明");
  assert.equal(data.travel.trips[0].story, "这一篇的游记");
  assert.deepEqual(data.travel.visitedCities, []);
  assert.deepEqual(data.travel.spots, []);
  assert(!JSON.stringify(data).includes("不要导出这篇"));
  assert.equal(source.trips.length, 2);
  assert.equal(source.visitedCities.length, 1);
});
test("overseas selection is distinct from domestic even when IDs coincide, and respects photo omission", () => {
  const data = buildScopedBackup(
    selectTravelSnapshot(snapshot(), { kind: "overseas", id: "same-id" }),
    "travel",
    false,
  );
  assert.equal(validateTravelBackup(data).trips.length, 0);
  const restored = validateOverseasBackup(data);
  assert.equal(restored.trips.length, 1);
  assert.equal(restored.trips[0].stops[0].city, "东京");
  assert.deepEqual(restored.trips[0].photos, []);
  assert.equal(restored.photosIncluded, false);
  assert(!JSON.stringify(data).includes("北京旅行"));
});
test("deleted or invalid selection refuses export rather than silently exporting everything, filenames are bounded", () => {
  for (const choice of [
    null,
    { kind: "invalid", id: "same-id" },
    { kind: "domestic", id: "deleted" },
    { kind: "overseas", id: "" },
  ])
    assert.throws(() => selectTravelSnapshot(snapshot(), choice));
  assert.equal(travelExportName("海边/旅行:第一天\n"), "海边-旅行-第一天-");
  assert.equal(travelExportName(" "), "未命名旅行");
  assert.equal(travelExportName("a".repeat(100)).length, 60);
});
