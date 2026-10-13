import {
  validateTrip,
  validateStoryRequest,
  validateStoryResult,
} from "./model.mjs";
import { localDate } from "../nutrition/model.mjs";
const codes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
const names = new Intl.DisplayNames(["zh-CN"], { type: "region" });
export const countries = codes
  .map((code) => ({ code, name: names.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
const countryIndex = new Map(countries.map((c) => [c.code, c.name]));
export const countryName = (code) => countryIndex.get(code) || "";
const key = (stop) =>
  stop.countryCode +
  "|" +
  stop.city.trim().normalize("NFKC").toLocaleLowerCase();
export function validateOverseasTrip(input) {
  if (
    !input ||
    !Array.isArray(input.stops) ||
    !input.stops.length ||
    input.stops.length > 20
  )
    throw Error("海外旅行需要1–20个城市");
  const stops = input.stops.map((s) => {
    if (
      !s ||
      !countryIndex.has(s.countryCode) ||
      typeof s.city !== "string" ||
      !s.city.trim() ||
      s.city.length > 60 ||
      !Array.isArray(s.spots) ||
      s.spots.length > 40
    )
      throw Error("请完整填写海外国家、城市和地点");
    const spots = s.spots.map((v) => {
      if (typeof v !== "string" || !v.trim() || v.length > 150)
        throw Error("海外地点名称无效");
      return v.trim();
    });
    if (new Set(spots).size !== spots.length)
      throw Error("同一城市的地点不能重复");
    return { countryCode: s.countryCode, city: s.city.trim(), spots };
  });
  if (new Set(stops.map(key)).size !== stops.length)
    throw Error("同一国家的同一城市只需添加一次");
  const common = validateTrip({
    ...input,
    stops: [{ cityId: "110000", spots: [] }],
  });
  return { ...common, stops };
}
export function validateOverseasBackup(data) {
  if (data.overseas === undefined) return null;
  const x = data.overseas;
  if (
    !x ||
    !Array.isArray(x.trips) ||
    x.trips.length > 10000 ||
    (x.photosIncluded !== undefined && typeof x.photosIncluded !== "boolean")
  )
    throw Error("海外旅行备份无效");
  const trips = x.trips.map(validateOverseasTrip);
  if (new Set(trips.map((t) => t.id)).size !== trips.length)
    throw Error("海外旅行编号重复");
  return { trips, photosIncluded: x.photosIncluded !== false };
}
export function overseasFootprints(trips, today = localDate()) {
  const done = trips.filter((t) => t.endDate <= today);
  const countries = new Map(),
    seen = new Set();
  for (const trip of done)
    for (const stop of trip.stops) {
      if (!countries.has(stop.countryCode))
        countries.set(stop.countryCode, new Set());
      if (!seen.has(key(stop))) {
        countries.get(stop.countryCode).add(stop.city);
        seen.add(key(stop));
      }
    }
  return {
    countries,
    cityCount: new Set(done.flatMap((t) => t.stops.map(key))).size,
  };
}
export function overseasStoryPayload(input) {
  const t = validateOverseasTrip(input);
  return validateStoryRequest({
    title: t.title,
    startDate: t.startDate,
    endDate: t.endDate,
    note: t.note,
    stops: t.stops.map((s) => ({
      city: countryName(s.countryCode) + "·" + s.city,
      spots: s.spots,
    })),
  });
}
export function overseasDraft(input) {
  const v = validateOverseasTrip(input),
    t = {
      ...v,
      stops: v.stops.map((s) => ({
        city: countryName(s.countryCode) + "·" + s.city,
        spots: s.spots,
      })),
    };
  const text = `黏黏包把小脚印带到了中国地图以外。\n\n${t.startDate} 至 ${t.endDate}，我们把「${t.title}」收进旅行册。\n\n${t.stops.map((s) => `${s.city}：${s.spots.length ? s.spots.join("、") : "留一页空白，等你补上去过的地方"}。`).join("\n\n")}${t.note ? "\n\n你留下的感受：\n" + t.note : ""}\n\n小地图外的回忆，也被好好收起来了。`;
  return text.length <= 12000
    ? text
    : text.slice(0, 11850) +
        "\n\n（内容较长，先整理到这里；完整地点和感受仍保留在旅行记录中，可以继续编辑。）";
}
export { validateStoryResult };
