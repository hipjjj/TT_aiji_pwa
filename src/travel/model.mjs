import regionData from "./regions.json" with { type: "json" };
import { validDate } from "../model.mjs";
import { localDate, validatePhoto } from "../nutrition/model.mjs";
export const provinces = regionData.provinces;
export const cities = regionData.cities;
const cityIndex = new Map(cities.map((city) => [city.id, city]));
export const cityById = (id) => cityIndex.get(id);
export const provinceById = (id) =>
  provinces.find((province) => province.id === id);
const str = (value, max, label, empty = true) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    throw Error(`${label}无效`);
  return value.trim();
};
// Compatibility only: preserve places from retired categories in old backups.
const normalizeScenicGrade = (grade) => (grade === "4A" ? "其他" : grade);
const identifier = (value) => str(value, 100, "记录编号", false);
const time = (value) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  )
    throw Error("记录时间无效");
  return value;
};
export function validateTrip(input) {
  if (
    !input ||
    !validDate(input.startDate) ||
    !validDate(input.endDate) ||
    input.startDate > input.endDate
  )
    throw Error("旅行起止日期无效，结束日期不能早于开始日期");
  if (
    !Array.isArray(input.stops) ||
    !input.stops.length ||
    input.stops.length > 20
  )
    throw Error("一趟旅行需要1–20个城市");
  const stops = input.stops.map((stop) => {
    if (
      !stop ||
      !cityById(stop.cityId) ||
      !Array.isArray(stop.spots) ||
      stop.spots.length > 40
    )
      throw Error("旅行城市或景点无效");
    const spots = stop.spots.map((spot) => {
      if (!spot || !["5A", "其他"].includes(normalizeScenicGrade(spot.grade)))
        throw Error("景点评级无效");
      return {
        name: str(spot.name, 150, "景点名称", false),
        grade: normalizeScenicGrade(spot.grade),
        ...(spot.catalogId ? { catalogId: identifier(spot.catalogId) } : {}),
      };
    });
    if (new Set(spots.map((spot) => spot.name)).size !== spots.length)
      throw Error("同一城市的景点不能重复");
    return { cityId: stop.cityId, spots };
  });
  if (new Set(stops.map((stop) => stop.cityId)).size !== stops.length)
    throw Error("同一城市只需添加一次，可合并景点");
  if (!Array.isArray(input.photos) || input.photos.length > 12)
    throw Error("一趟旅行最多12张照片");
  const photos = input.photos.map((photo) => {
    if (!photo || !photo.dataURL) throw Error("旅行照片缺失");
    return {
      id: identifier(photo.id),
      dataURL: validatePhoto(photo.dataURL),
      caption: str(photo.caption, 300, "照片说明"),
    };
  });
  if (new Set(photos.map((photo) => photo.id)).size !== photos.length)
    throw Error("照片编号重复");
  if (!["manual", "template", "ai"].includes(input.storySource))
    throw Error("游记来源无效");
  return {
    id: identifier(input.id),
    title: str(input.title, 100, "旅行标题", false),
    startDate: input.startDate,
    endDate: input.endDate,
    stops,
    note: str(input.note, 5000, "旅行感受"),
    photos,
    story: str(input.story, 12000, "游记"),
    storySource: input.storySource,
    updatedAt: time(input.updatedAt),
  };
}
export function validateVisitedCity(input) {
  if (
    !input ||
    !cityById(input.cityId) ||
    (input.date !== null && !validDate(input.date))
  )
    throw Error("手动点亮城市或日期无效");
  return {
    cityId: input.cityId,
    date: input.date,
    note: str(input.note, 300, "城市备注"),
    updatedAt: time(input.updatedAt),
  };
}
export function visitedCityIds(trips, manual, today = localDate()) {
  return new Set([
    ...manual
      .filter((item) => !item.date || item.date <= today)
      .map((item) => item.cityId),
    ...trips
      .filter((trip) => trip.endDate <= today)
      .flatMap((trip) => trip.stops.map((stop) => stop.cityId)),
  ]);
}
export function visitedProvinceIds(visited) {
  return new Set(
    [...visited].map((id) => cityById(id)?.provinceId).filter(Boolean),
  );
}
export function validateTravelBackup(data) {
  if (!Object.hasOwn(data, "travel")) return null;
  const input = data.travel;
  if (
    !input ||
    !Array.isArray(input.trips) ||
    !Array.isArray(input.visitedCities) ||
    input.trips.length > 10000 ||
    input.visitedCities.length > cities.length ||
    (input.photosIncluded !== undefined &&
      typeof input.photosIncluded !== "boolean")
  )
    throw Error("旅行备份格式无效");
  if (
    input.spots !== undefined &&
    (!Array.isArray(input.spots) || input.spots.length > 10000)
  )
    throw Error("补充景点备份无效");
  const spots = (input.spots || []).map(validateUserScenic);
  const trips = input.trips.map(validateTrip),
    visitedCities = input.visitedCities.map(validateVisitedCity);
  if (
    new Set(spots.map((spot) => spot.id)).size !== spots.length ||
    new Set(trips.map((trip) => trip.id)).size !== trips.length ||
    new Set(visitedCities.map((item) => item.cityId)).size !==
      visitedCities.length
  )
    throw Error("旅行备份存在重复编号");
  return {
    trips,
    visitedCities,
    spots,
    photosIncluded: input.photosIncluded !== false,
  };
}
export function storyPayload(input) {
  // Photo data and unrelated app records never enter the AI request.
  const trip = validateTrip(input);
  return {
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    stops: trip.stops.map((stop) => ({
      city: cityById(stop.cityId).name,
      spots: stop.spots.map((spot) => spot.name),
    })),
    note: trip.note,
  };
}
export function validateStoryRequest(input) {
  if (
    !input ||
    JSON.stringify(input).length > 20000 ||
    !validDate(input.startDate) ||
    !validDate(input.endDate) ||
    input.startDate > input.endDate ||
    !Array.isArray(input.stops) ||
    !input.stops.length ||
    input.stops.length > 20
  )
    throw Error("游记请求无效");
  return {
    title: str(input.title, 100, "游记标题", false),
    startDate: input.startDate,
    endDate: input.endDate,
    note: str(input.note, 5000, "旅行感受"),
    stops: input.stops.map((stop) => {
      if (!stop || !Array.isArray(stop.spots) || stop.spots.length > 40)
        throw Error("游记景点无效");
      return {
        city: str(stop.city, 100, "城市", false),
        spots: stop.spots.map((spot) => str(spot, 150, "景点", false)),
      };
    }),
  };
}
export function validateStoryResult(input) {
  if (!input) throw Error("AI游记为空");
  return { story: str(input.story, 12000, "AI游记", false) };
}
export function draftStory(trip) {
  const data = storyPayload(trip);
  const route = data.stops.map((stop) => stop.city).join(" → ");
  return `黏黏包翻开旅行册，把「${data.title}」轻轻收进这一页。\n\n${data.startDate} 至 ${data.endDate}，这段旅程的足迹是：${route}。\n\n${data.stops.map((stop) => `${stop.city}这一页，${stop.spots.length ? `写下了${stop.spots.join("、")}。` : "暂时还没有记下具体景点，留一点位置，等你慢慢补上。"}`).join("\n\n")}${data.note ? `\n\n你留下的话，黏黏包一字一句收好了：\n${data.note}` : ""}\n\n小地图又多了一段回忆。黏黏包会陪你把下一段旅程，也好好记下来。`;
}

export function validateUserScenic(input) {
  if (
    !input ||
    !cityById(input.cityId) ||
    !["5A", "其他"].includes(normalizeScenicGrade(input.grade))
  )
    throw Error("补充景点无效");
  const sourceURL = str(input.sourceURL, 500, "景点来源链接");
  if (sourceURL) {
    let url;
    try {
      url = new URL(sourceURL);
    } catch {
      throw Error("请输入有效来源链接");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("来源链接需要使用HTTPS");
  }
  return {
    id: identifier(input.id),
    cityId: input.cityId,
    name: str(input.name, 150, "景点名称", false),
    grade: normalizeScenicGrade(input.grade),
    sourceURL,
    updatedAt: time(input.updatedAt),
  };
}
