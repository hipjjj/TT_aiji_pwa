import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { topology } from "topojson-server";
import { merge } from "topojson-client";
const cache = process.argv[2] || "/tmp/tt-travel-source";
const scenicPath = process.argv[3] || `${cache}/scenic-5a.json`;
const scenicManifest = JSON.parse(
  readFileSync("scripts/travel-source/scenic-manifest.json", "utf8"),
);
if (
  createHash("sha256").update(readFileSync(scenicPath)).digest("hex") !==
  scenicManifest.sha256
)
  throw Error("Scenic source checksum failed");
const manifest = JSON.parse(
  readFileSync("scripts/travel-source/map-manifest.json", "utf8"),
);
for (const file of manifest.files) {
  const bytes = readFileSync(`${cache}/${file.path}`);
  if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
    throw Error(`Source checksum failed: ${file.path}`);
}
const codes = {
  北京市: "110000",
  天津市: "120000",
  河北省: "130000",
  山西省: "140000",
  内蒙古自治区: "150000",
  辽宁省: "210000",
  吉林省: "220000",
  黑龙江省: "230000",
  上海市: "310000",
  江苏省: "320000",
  浙江省: "330000",
  安徽省: "340000",
  福建省: "350000",
  江西省: "360000",
  山东省: "370000",
  河南省: "410000",
  湖北省: "420000",
  湖南省: "430000",
  广东省: "440000",
  广西壮族自治区: "450000",
  海南省: "460000",
  重庆市: "500000",
  四川省: "510000",
  贵州省: "520000",
  云南省: "530000",
  西藏自治区: "540000",
  陕西省: "610000",
  甘肃省: "620000",
  青海省: "630000",
  宁夏回族自治区: "640000",
  新疆维吾尔自治区: "650000",
  台湾省: "710000",
  香港特别行政区: "810000",
  澳门特别行政区: "820000",
};
const whole = new Set([
  "110000",
  "120000",
  "310000",
  "500000",
  "710000",
  "810000",
  "820000",
]);
const roundCoordinates = (value) =>
  Array.isArray(value)
    ? value.map(roundCoordinates)
    : typeof value === "number"
      ? Number(value.toFixed(6))
      : value;
const provinces = [],
  cities = [],
  national = [];
mkdirSync("public/travel-maps", { recursive: true });
mkdirSync("src/travel", { recursive: true });
const centerOf = (features) => {
  const points = features
    .map((f) => f.properties.centroid || f.properties.center)
    .filter(Array.isArray);
  return points.length
    ? [
        points.reduce((sum, p) => sum + p[0], 0) / points.length,
        points.reduce((sum, p) => sum + p[1], 0) / points.length,
      ]
    : [104, 35];
};
for (const name of Object.keys(codes)) {
  const id = codes[name],
    source = JSON.parse(readFileSync(`${cache}/province/${name}.json`, "utf8"));
  const topo = topology({ regions: source }, 1e6),
    geometry = merge(topo, topo.objects.regions.geometries);
  geometry.coordinates = roundCoordinates(geometry.coordinates);
  const center = centerOf(source.features),
    properties = { id, name, center };
  national.push({ type: "Feature", properties, geometry });
  const parts = whole.has(id)
    ? [
        {
          type: "Feature",
          properties: { id, name, provinceId: id, center },
          geometry,
        },
      ]
    : source.features.map((f) => ({
        type: "Feature",
        properties: {
          id: String(f.properties.adcode),
          name: f.properties.name,
          provinceId: id,
          center: f.properties.centroid || f.properties.center || center,
        },
        geometry: f.geometry,
      }));
  const ids = new Set();
  for (const feature of parts) {
    if (ids.has(feature.properties.id)) throw Error("Duplicate region");
    ids.add(feature.properties.id);
    cities.push({
      ...feature.properties,
      type: whole.has(id)
        ? "whole-region"
        : String(feature.properties.id).endsWith("00")
          ? "prefecture"
          : "direct-admin",
    });
  }
  provinces.push({
    id,
    name,
    center,
    cityIds: parts.map((f) => f.properties.id),
    wholeRegion: whole.has(id),
    boundaryNote:
      id === "710000"
        ? "当前数据源未提供台湾地区的地级边界，可整体标记并填写具体地点。"
        : whole.has(id)
          ? "该区域直接整体记录；不把下辖区当作地级市。"
          : "",
  });
  writeFileSync(
    `public/travel-maps/${id}.json`,
    JSON.stringify({ type: "FeatureCollection", features: parts }),
  );
}
writeFileSync(
  "public/travel-maps/national.json",
  JSON.stringify({
    type: "FeatureCollection",
    features: national,
    outline: JSON.parse(readFileSync(`${cache}/china.json`)).features[0]
      .geometry,
  }),
);
writeFileSync(
  "src/travel/regions.json",
  JSON.stringify({ provinces, cities }, null, 2),
);
const raw = JSON.parse(readFileSync(scenicPath, "utf8"));
const scenic = [],
  unmatched = [];
const cityOverrides = {
  槟榔谷黎苗文化旅游区: "469029",
  分界洲岛旅游区: "469028",
  呀诺达雨林文化旅游区: "469029",
  "塔克拉玛干·三五九旅文化旅游区": "659002",
};
for (const item of raw) {
  const provinceId = codes[item.province_zh];
  const city = cityOverrides[item.name_zh]
    ? cities.find((c) => c.id === cityOverrides[item.name_zh])
    : whole.has(provinceId)
      ? cities.find((c) => c.id === provinceId)
      : cities.find(
          (c) => c.provinceId === provinceId && c.name === item.city_zh,
        );
  if (!city) {
    unmatched.push({
      name: item.name_zh,
      province: item.province_zh,
      city: item.city_zh,
    });
    continue;
  }
  scenic.push({
    id: item.slug,
    cityId: city.id,
    name: item.name_zh,
    grade: "5A",
    source: "LoreRoutes / china-5a-scenic-areas",
    sourceURL: item.profile_url,
    snapshot: "49e335839bdea082c9e9e8e887d8d9ec574e9306",
    sourceDate: "2026-08-31",
    license: "CC-BY-SA-4.0",
  });
}
writeFileSync("src/travel/scenic.json", JSON.stringify(scenic, null, 2));
writeFileSync(
  "scripts/travel-source/scenic-unmatched.json",
  JSON.stringify(unmatched, null, 2),
);
writeFileSync(
  "scripts/travel-source/scenic-manifest.json",
  JSON.stringify(
    {
      repo: "tuansuwu/china-5a-scenic-areas",
      commit: "49e335839bdea082c9e9e8e887d8d9ec574e9306",
      file: "data/china-5a-scenic-areas.json",
      sha256: createHash("sha256")
        .update(readFileSync(scenicPath))
        .digest("hex"),
      sourceRecords: raw.length,
      matchedRecords: scenic.length,
    },
    null,
    2,
  ),
);
console.log(
  `Built ${provinces.length} provinces, ${cities.length} travel regions, ${scenic.length}/${raw.length} mapped scenic records`,
);
console.log("Unmatched source city names:", JSON.stringify(unmatched));
