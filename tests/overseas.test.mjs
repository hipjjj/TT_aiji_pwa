import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateOverseasTrip,
  validateOverseasBackup,
  overseasFootprints,
  overseasStoryPayload,
  overseasDraft,
  countries,
} from "../src/travel/overseas-model.mjs";
const trip = (patch = {}) => ({
  id: "abroad-1",
  title: "日本法国小旅行",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  stops: [
    { countryCode: "JP", city: "东京", spots: ["浅草寺"] },
    { countryCode: "FR", city: "巴黎", spots: ["卢浮宫"] },
  ],
  note: "看到喜欢的小店",
  photos: [],
  story: "",
  storySource: "manual",
  updatedAt: 1,
  ...patch,
});
test("overseas destinations validate country and unique city, preserve multiple countries and reject unsafe photos", () => {
  assert.equal(validateOverseasTrip(trip()).stops.length, 2);
  assert(!countries.some((c) => ["CN", "HK", "MO", "TW"].includes(c.code)));
  assert.equal(new Set(countries.map((c) => c.code)).size, countries.length);
  for (const bad of [
    trip({ endDate: "2026-09-01" }),
    trip({ stops: [{ countryCode: "CN", city: "北京", spots: [] }] }),
    trip({ stops: [trip().stops[0], trip().stops[0]] }),
    trip({
      photos: [{ id: "p", dataURL: "https://unknown.test/photo", caption: "" }],
    }),
  ])
    assert.throws(() => validateOverseasTrip(bad));
});
test("overseas footprints count completed cities and countries independently of domestic map", () => {
  const future = trip({
    id: "future",
    startDate: "2027-01-01",
    endDate: "2027-01-03",
    stops: [{ countryCode: "US", city: "纽约", spots: [] }],
  });
  const footprints = overseasFootprints([trip(), future], "2026-10-13");
  assert.equal(footprints.countries.size, 2);
  assert.equal(footprints.cityCount, 2);
  assert(!footprints.countries.has("US"));
  assert.equal(overseasFootprints([]).countries.size, 0);
});
test("overseas backups preserve omission semantics, validate before merging and retain record IDs", () => {
  assert.equal(validateOverseasBackup({ version: 1 }), null);
  const value = validateOverseasBackup({
    overseas: { trips: [trip()], photosIncluded: false },
  });
  assert.equal(value.trips[0].id, "abroad-1");
  assert.equal(value.photosIncluded, false);
  assert.throws(() =>
    validateOverseasBackup({ overseas: { trips: [trip(), trip()] } }),
  );
  assert.throws(() =>
    validateOverseasBackup({
      overseas: {
        trips: [
          trip({ stops: [{ countryCode: "ZZ", city: "未知", spots: [] }] }),
        ],
      },
    }),
  );
});
test("overseas journal uses recorded locations and sends only text to existing AI endpoint", () => {
  const p = overseasStoryPayload({
    ...trip(),
    expenses: "private",
    body: "private",
  });
  assert.equal(p.stops[0].city, "日本·东京");
  assert.equal(Object.hasOwn(p, "photos"), false);
  assert(!JSON.stringify(p).includes("private"));
  const draft = overseasDraft(trip());
  assert.match(draft, /日本·东京/);
  assert.match(draft, /浅草寺/);
  assert.match(draft, /看到喜欢的小店/);
  assert(!/天气晴朗|酒店|飞机/.test(draft));
});

test("overseas country cards and city counters deduplicate case variants across trips", () => {
  const a = trip({
      stops: [{ countryCode: "US", city: "New York", spots: [] }],
    }),
    b = trip({
      id: "b",
      stops: [{ countryCode: "US", city: "new york", spots: [] }],
    });
  const result = overseasFootprints([a, b], "2026-10-13");
  assert.equal(result.cityCount, 1);
  assert.equal(result.countries.get("US").size, 1);
});

test("local overseas drafts remain editable for trips longer than the AI payload cap", () => {
  const stops = Array.from({ length: 20 }, (_, i) => ({
    countryCode: "JP",
    city: "城市" + i,
    spots: Array.from({ length: 40 }, (_, j) => "地点" + j + "记".repeat(100)),
  }));
  const t = trip({ stops });
  assert.equal(validateOverseasTrip(t).stops.length, 20);
  assert.throws(() => overseasStoryPayload(t));
  const draft = overseasDraft(t);
  assert(draft.length <= 12000);
  assert.match(draft, /完整地点和感受仍保留/);
});
