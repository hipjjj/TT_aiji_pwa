import React, { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { Modal } from "../nutrition/NutritionTab";
import { preparePhoto } from "../nutrition/photo";
import { localDate } from "../nutrition/model.mjs";
import {
  cities,
  provinces,
  cityById,
  provinceById,
  draftStory,
  storyPayload,
  validateStoryResult,
  validateTrip,
  validateUserScenic,
  validateVisitedCity,
  visitedCityIds,
  visitedProvinceIds,
} from "./model.mjs";
import scenicData from "./scenic.json";
import TravelMap from "./TravelMap";
import { travelCopy as copy } from "./copy";
import type {
  Trip,
  TravelStop,
  TravelPhoto,
  TravelSpot,
  UserScenic,
  VisitedCity,
  Scenic,
} from "./types";
import "./style.css";
const library = scenicData as Scenic[];
const failure = (error: unknown) =>
  error instanceof Error ? error.message : "暂时没有保存成功，请重试";
export default function TravelTab({ onManageAI }: { onManageAI: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([]),
    [manual, setManual] = useState<VisitedCity[]>([]),
    [custom, setCustom] = useState<UserScenic[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [view, setView] = useState<"map" | "journal">("map"),
    [provinceId, setProvinceId] = useState<string | null>(null),
    [cityId, setCityId] = useState<string | null>(null),
    [grade, setGrade] = useState<"5A" | "其他">("5A"),
    [spotSearch, setSpotSearch] = useState(""),
    [limit, setLimit] = useState(20),
    [markDate, setMarkDate] = useState(""),
    [markNote, setMarkNote] = useState("");
  const [newSpot, setNewSpot] = useState({
    name: "",
    grade: "其他" as TravelSpot["grade"],
    sourceURL: "",
  });
  const [tripOpen, setTripOpen] = useState(false),
    [editing, setEditing] = useState<Trip | null>(null),
    [draftId, setDraftId] = useState(""),
    [title, setTitle] = useState(""),
    [startDate, setStartDate] = useState(localDate()),
    [endDate, setEndDate] = useState(localDate()),
    [stops, setStops] = useState<TravelStop[]>([]),
    [note, setNote] = useState(""),
    [photos, setPhotos] = useState<TravelPhoto[]>([]),
    [story, setStory] = useState(""),
    [storySource, setStorySource] = useState<Trip["storySource"]>("manual"),
    [storyConfirmed, setStoryConfirmed] = useState(false);
  const [addProvince, setAddProvince] = useState(""),
    [addCity, setAddCity] = useState(""),
    [manualSpot, setManualSpot] = useState<
      Record<string, { name: string; grade: TravelSpot["grade"] }>
    >({}),
    [searches, setSearches] = useState<Record<string, string>>({});
  const [photoBusy, setPhotoBusy] = useState(false),
    [preview, setPreview] = useState<TravelPhoto | null>(null),
    [consent, setConsent] = useState(false),
    [asking, setAsking] = useState(false),
    [apiURL, setAPIURL] = useState("");
  const file = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  const reload = async () => {
    const [saved, marks, added, settings] = await Promise.all([
      db.trips.orderBy("startDate").reverse().toArray(),
      db.visitedCities.toArray(),
      db.travelSpots.toArray(),
      db.settings.get("ai"),
    ]);
    setTrips(saved);
    setManual(marks);
    setCustom(added);
    setAPIURL(
      settings ? settings.url : import.meta.env.VITE_NUTRITION_API_URL || "",
    );
  };
  useEffect(() => {
    reload()
      .then(() => setReady(true))
      .catch(() => setMessage("黏黏包打不开本地旅行册，请检查浏览器存储"));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timeout);
  }, [message]);
  const visited = visitedCityIds(trips, manual),
    visitedProvinces = visitedProvinceIds(visited);
  const city = cityId ? cityById(cityId) : null,
    cityTrips = cityId
      ? trips.filter((trip) =>
          trip.stops.some((stop) => stop.cityId === cityId),
        )
      : [];
  const catalog = (id: string) => [
    ...library.filter((spot) => spot.cityId === id),
    ...custom
      .filter((spot) => spot.cityId === id)
      .map((spot) => ({
        ...spot,
        source: "用户补充 · 评级待核实",
        snapshot: "user",
      })),
  ];
  const cityCatalog = cityId ? catalog(cityId) : [];
  const shownSpots = cityCatalog.filter(
    (spot) =>
      spot.grade === grade && (!spotSearch || spot.name.includes(spotSearch)),
  );
  const notify = (text: string) => {
    setMessage(text);
    setError("");
  };
  const openCity = (id: string) => {
    setCityId(id);
    setGrade("5A");
    setSpotSearch("");
    setLimit(20);
    const saved = manual.find((item) => item.cityId === id);
    setMarkDate(saved?.date || "");
    setMarkNote(saved?.note || "");
    setNewSpot({ name: "", grade: "其他", sourceURL: "" });
    setError("");
  };
  const markCity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cityId) return;
    setBusy(true);
    try {
      if (markDate && markDate > localDate())
        throw Error("去过的日期不能填写未来日期");
      await db.visitedCities.put(
        validateVisitedCity({
          cityId,
          date: markDate || null,
          note: markNote,
          updatedAt: Date.now(),
        }) as VisitedCity,
      );
      await reload();
      notify("点亮啦！黏黏包给这座城市贴了一颗小星星");
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const unmarkCity = async () => {
    if (!cityId) return;
    setBusy(true);
    try {
      await db.visitedCities.delete(cityId);
      await reload();
      notify(
        cityTrips.some((trip) => trip.endDate <= localDate())
          ? "已取消手动标记；已有旅行记录仍会点亮这座城市"
          : "已取消这座城市的手动点亮",
      );
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const addCatalog = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cityId) return;
    setBusy(true);
    try {
      if (cityCatalog.some((spot) => spot.name === newSpot.name.trim()))
        throw Error("已有同名景点，请直接选择");
      await db.travelSpots.add(
        validateUserScenic({
          ...newSpot,
          id: crypto.randomUUID(),
          cityId,
          updatedAt: Date.now(),
        }) as UserScenic,
      );
      await reload();
      setGrade(newSpot.grade);
      setNewSpot({ name: "", grade: "其他", sourceURL: "" });
      notify("补充景点收好啦，评级会标为自填");
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const removeCatalog = async (spot: UserScenic) => {
    if (!confirm(`移除自填景点「${spot.name}」？旅行中的旧记录会保留。`))
      return;
    setBusy(true);
    try {
      await db.travelSpots.delete(spot.id);
      await reload();
      notify("自填景点已移除，过去的旅行记录保留");
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const openTrip = (trip?: Trip, startCity?: string) => {
    setEditing(trip || null);
    setDraftId(trip?.id || crypto.randomUUID());
    setTitle(trip?.title || "");
    setStartDate(trip?.startDate || localDate());
    setEndDate(trip?.endDate || localDate());
    setStops(
      trip
        ? trip.stops.map((stop) => ({
            ...stop,
            spots: stop.spots.map((spot) => ({ ...spot })),
          }))
        : startCity
          ? [{ cityId: startCity, spots: [] }]
          : [],
    );
    setNote(trip?.note || "");
    setPhotos(trip ? trip.photos.map((photo) => ({ ...photo })) : []);
    setStory(trip?.story || "");
    setStorySource(trip?.storySource || "manual");
    setStoryConfirmed(!!trip?.story);
    setConsent(false);
    setSearches({});
    setManualSpot({});
    setAddProvince(startCity ? cityById(startCity)?.provinceId || "" : "");
    setAddCity("");
    setCityId(null);
    setError("");
    setTripOpen(true);
  };
  const closeTrip = () => {
    if (busy || photoBusy) return;
    controller.current?.abort();
    setTripOpen(false);
  };
  const addStop = () => {
    if (!addCity || !cityById(addCity)) {
      setError("先选择省份和城市，再加入行程");
      return;
    }
    if (stops.length >= 20) {
      setError("一趟最多20个城市");
      return;
    }
    if (stops.some((stop) => stop.cityId === addCity)) {
      setError("这座城市已经在行程里啦");
      return;
    }
    setStops([...stops, { cityId: addCity, spots: [] }]);
    setAddCity("");
    setStoryConfirmed(false);
    setError("");
  };
  const toggleSpot = (id: string, spot: TravelSpot, checked: boolean) => {
    setStops((previous) =>
      previous.map((stop) =>
        stop.cityId !== id
          ? stop
          : {
              ...stop,
              spots: checked
                ? [
                    ...stop.spots.filter((item) => item.name !== spot.name),
                    spot,
                  ]
                : stop.spots.filter((item) => item.name !== spot.name),
            },
      ),
    );
    setStoryConfirmed(false);
  };
  const addManualSpot = (id: string) => {
    const value = manualSpot[id] || { name: "", grade: "其他" };
    const name = value.name.trim();
    if (!name) {
      setError("请填写景点名称");
      return;
    }
    if (
      stops
        .find((stop) => stop.cityId === id)
        ?.spots.some((spot) => spot.name === name)
    ) {
      setError("这个景点已经记下啦");
      return;
    }
    toggleSpot(id, { name, grade: value.grade }, true);
    setManualSpot({ ...manualSpot, [id]: { name: "", grade: "其他" } });
    setError("");
  };
  const buildTrip = () =>
    validateTrip({
      id: draftId,
      title: title.trim() || "我的小旅行",
      startDate,
      endDate,
      stops,
      note,
      photos,
      story,
      storySource,
      updatedAt: Date.now(),
    }) as Trip;
  const loadPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setPhotoBusy(true);
    try {
      if (photos.length + selected.length > 12)
        throw Error("一趟旅行最多12张照片，请分到另一段旅程");
      const additions: TravelPhoto[] = [];
      for (const image of selected) {
        try {
          additions.push({
            id: crypto.randomUUID(),
            dataURL: await preparePhoto(image),
            caption: "",
          });
        } catch (error) {
          throw Error(`${image.name}：${failure(error)}`);
        }
      }
      setPhotos((previous) => [...previous, ...additions]);
      setError("");
    } catch (error) {
      setError(failure(error));
    } finally {
      setPhotoBusy(false);
      event.target.value = "";
    }
  };
  const replaceStory = () =>
    !story || confirm("重新整理会替换当前游记文字，继续吗？");
  const localStory = () => {
    if (!replaceStory()) return;
    try {
      const result = draftStory(buildTrip());
      if (result.length > 12000)
        throw Error("行程文字较长，请减少景点或手动整理游记");
      setStory(result);
      setStorySource("template");
      setStoryConfirmed(false);
      setError("");
    } catch (error) {
      setError(failure(error));
    }
  };
  const aiStory = async () => {
    const access = sessionStorage.getItem("xiaobao-ai-access") || "";
    if (!apiURL || !access) {
      setError(
        "请先到“个人 → AI连接设置”配置服务；当前行程会保留，可以先本地整理。",
      );
      return;
    }
    if (!navigator.onLine) {
      setError("问 AI 需要联网，可以先用本地整理游记");
      return;
    }
    if (!consent) {
      setError("请先同意发送本次旅行文字");
      return;
    }
    if (!replaceStory()) return;
    setAsking(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 45000);
    try {
      const payload = storyPayload(buildTrip());
      const response = await fetch(`${apiURL}/travel-story`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Code": access,
        },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "游记服务暂时不可用");
      const result = validateStoryResult(body);
      setStory(result.story);
      setStorySource("ai");
      setStoryConfirmed(false);
    } catch (error) {
      setError(
        abort.signal.aborted ? "已停止整理，行程文字仍保留" : failure(error),
      );
    } finally {
      clearTimeout(timeout);
      setAsking(false);
      controller.current = null;
    }
  };
  const saveTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const trip = buildTrip();
      if (trip.storySource === "ai" && trip.story && !storyConfirmed)
        throw Error("请先核对 AI 游记，再勾选确认");
      await db.transaction("rw", db.trips, db.travelSpots, async () => {
        await db.trips.put(trip);
        const added = await db.travelSpots.toArray();
        for (const stop of trip.stops)
          for (const spot of stop.spots) {
            if (
              spot.catalogId ||
              library.some(
                (item) =>
                  item.cityId === stop.cityId && item.name === spot.name,
              ) ||
              added.some(
                (item) =>
                  item.cityId === stop.cityId && item.name === spot.name,
              )
            )
              continue;
            const item = validateUserScenic({
              id: crypto.randomUUID(),
              cityId: stop.cityId,
              name: spot.name,
              grade: spot.grade,
              sourceURL: "",
              updatedAt: Date.now(),
            }) as UserScenic;
            await db.travelSpots.add(item);
            added.push(item);
          }
      });
      await reload();
      setTripOpen(false);
      setView("journal");
      notify(
        trip.endDate > localDate()
          ? "旅程收好啦，旅行完成日期到达后会计入点亮"
          : copy.saved,
      );
    } catch (error) {
      setError(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const deleteTrip = async (trip: Trip) => {
    if (!confirm(`删除「${trip.title}」及其本地照片、游记？手动点亮会保留。`))
      return;
    setBusy(true);
    try {
      await db.trips.delete(trip.id);
      await reload();
      notify("这段旅行记录已删除，地图已重新计算");
    } catch (error) {
      setMessage(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const modalProps = { eyebrow: copy.eyebrow, className: "travel-dialog" };
  return (
    <section className="travel-house">
      <div className="travel-heading">
        <div>
          <span className="park-label">Little Journeys, Big Memories</span>
          <h2>{copy.name}</h2>
        </div>
      </div>
      <div className="travel-summary">
        <div>
          <span>点亮的省级区域</span>
          <b>
            {visitedProvinces.size}
            <small>个</small>
          </b>
        </div>
        <div>
          <span>去过的城市／地区</span>
          <b>
            {visited.size}
            <small>个</small>
          </b>
        </div>
        <div>
          <span>收好的旅程</span>
          <b>
            {trips.length}
            <small>段</small>
          </b>
        </div>
      </div>
      <button
        className="new-expense travel-add"
        disabled={!ready || busy}
        onClick={() => openTrip()}
      >
        ＋ 记下一段旅行 <span aria-hidden="true">✧</span>
      </button>
      <div className="travel-view" role="group" aria-label="旅行册视图">
        <button aria-pressed={view === "map"} onClick={() => setView("map")}>
          旅行地图
        </button>
        <button
          aria-pressed={view === "journal"}
          onClick={() => setView("journal")}
        >
          我的旅行记录
        </button>
        <button className="travel-settings-link" onClick={onManageAI}>
          AI设置
        </button>
      </div>
      {!ready ? (
        <p className="empty">黏黏包正在打开旅行册…</p>
      ) : view === "map" ? (
        <TravelMap
          provinceId={provinceId}
          onProvince={setProvinceId}
          onCity={openCity}
          visited={visited}
        />
      ) : (
        <section className="travel-journal">
          <div className="section-head">
            <h3>把回忆慢慢翻开</h3>
            <span>{trips.length} 段旅程</span>
          </div>
          {!trips.length ? (
            <div className="empty">
              <span aria-hidden="true">🧳</span>
              <h3>旅行册还留着空白页</h3>
              <p>去过的城市、走过的景点，都可以记在这里。</p>
            </div>
          ) : (
            trips.map((trip) => (
              <article className="travel-trip-card" key={trip.id}>
                {trip.photos[0] && (
                  <button
                    className="travel-cover-button"
                    onClick={() => setPreview(trip.photos[0])}
                  >
                    <img
                      className="travel-cover"
                      src={trip.photos[0].dataURL}
                      loading="lazy"
                      alt={trip.photos[0].caption || `${trip.title}的旅行照片`}
                    />
                  </button>
                )}
                <div className="travel-trip-body">
                  <span className="park-label">A Page of Our Journey</span>
                  <h3>{trip.title}</h3>
                  <p className="travel-trip-date">
                    {trip.startDate} — {trip.endDate}
                    {trip.endDate > localDate() ? " · 尚未计入点亮" : ""}
                  </p>
                  <p className="travel-route">
                    {trip.stops
                      .map((stop) => cityById(stop.cityId)?.name)
                      .join(" → ")}
                  </p>
                  <p className="travel-spots-text">
                    {trip.stops
                      .flatMap((stop) => stop.spots.map((spot) => spot.name))
                      .join("、") || "还没补充具体景点"}
                  </p>
                  {trip.note && <p className="travel-trip-note">{trip.note}</p>}
                  {trip.story && (
                    <details className="travel-story">
                      <summary>
                        翻开黏黏包的游记{" "}
                        <span>
                          {trip.storySource === "ai"
                            ? "AI草稿 · 已确认"
                            : trip.storySource === "template"
                              ? "本地整理"
                              : "手动书写"}
                        </span>
                      </summary>
                      <p>{trip.story}</p>
                    </details>
                  )}
                  {trip.photos.length > 0 && (
                    <details className="travel-trip-photos">
                      <summary>看看 {trip.photos.length} 张旅行照片</summary>
                      <div className="travel-photo-grid">
                        {trip.photos.map((photo) => (
                          <button
                            key={photo.id}
                            onClick={() => setPreview(photo)}
                          >
                            <img
                              src={photo.dataURL}
                              loading="lazy"
                              alt={photo.caption || "旅行照片"}
                            />
                            {photo.caption && <span>{photo.caption}</span>}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="travel-trip-actions">
                    <button
                      disabled={busy}
                      onClick={() => openTrip(trip)}
                      aria-label={`编辑旅行${trip.title}`}
                    >
                      编辑旅行
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void deleteTrip(trip)}
                      aria-label={`删除旅行${trip.title}`}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      )}
      <Modal
        {...modalProps}
        open={!!cityId}
        onClose={() => {
          if (!busy) setCityId(null);
        }}
        title={city?.name || "城市足迹"}
      >
        {city && (
          <>
            <p className="travel-city-status">
              {visited.has(city.id)
                ? "★ 已点亮 · 黏黏包记得你来过"
                : "○ 还没点亮 · 等你留下足迹"}
            </p>
            <p className="nutrition-small-note">
              {provinceById(city.provinceId)?.name} · {cityTrips.length}{" "}
              段旅行记录
            </p>
            {error && (
              <p className="nutrition-error" role="alert">
                {error}
              </p>
            )}
            <form className="travel-mark-form" onSubmit={markCity} noValidate>
              <div className="meal-form-top">
                <label>
                  去过的日期（可选）
                  <input
                    aria-label="手动去过日期"
                    type="date"
                    max={localDate()}
                    value={markDate}
                    onChange={(event) => setMarkDate(event.target.value)}
                  />
                </label>
                <label>
                  小备注（可选）
                  <input
                    aria-label="手动城市备注"
                    value={markNote}
                    maxLength={300}
                    onChange={(event) => setMarkNote(event.target.value)}
                    placeholder="小时候来过，也可以"
                  />
                </label>
              </div>
              <button className="nutrition-soft-button" disabled={busy}>
                {manual.some((item) => item.cityId === city.id)
                  ? "更新手动标记"
                  : "标记我去过"}
              </button>
              {manual.some((item) => item.cityId === city.id) && (
                <button
                  type="button"
                  className="travel-text-button"
                  disabled={busy}
                  onClick={() => void unmarkCity()}
                >
                  取消手动点亮
                </button>
              )}
            </form>
            {visited.has(city.id) &&
              !manual.some((item) => item.cityId === city.id) && (
                <p className="nutrition-small-note">
                  这座城市由旅行记录自动点亮；修改或删除对应旅程后，会重新计算。
                </p>
              )}
            <button
              className="primary"
              disabled={busy}
              onClick={() => openTrip(undefined, city.id)}
            >
              记一次这里的旅行
            </button>
            <h3 className="travel-section-title">城市景点小清单</h3>
            <div className="travel-grade-filters">
              {(["5A", "其他"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={grade === value}
                  onClick={() => {
                    setGrade(value);
                    setLimit(20);
                  }}
                >
                  {value} ·{" "}
                  {cityCatalog.filter((spot) => spot.grade === value).length}
                </button>
              ))}
            </div>
            <label>
              <span className="sr-only">查找城市景点</span>
              <input
                aria-label="查找城市景点"
                value={spotSearch}
                onChange={(event) => {
                  setSpotSearch(event.target.value);
                  setLimit(20);
                }}
                placeholder="找一个景点…"
              />
            </label>
            {!shownSpots.length ? (
              <p className="nutrition-small-note">
                {grade === "5A"
                  ? "这份来源快照未匹配到景区，不代表当地没有；也可以自填补充。"
                  : "还没有补充其他地点，街道、小店和公园都可以记下来。"}
              </p>
            ) : (
              <ul className="travel-scenic-list">
                {shownSpots.slice(0, limit).map((spot) => (
                  <li key={spot.id}>
                    <div>
                      <strong>{spot.name}</strong>
                      <span className="travel-scenic-grade">{spot.grade}</span>
                    </div>
                    <small>
                      {spot.source}
                      {"sourceDate" in spot && spot.sourceDate
                        ? ` · ${spot.sourceDate}快照`
                        : ""}
                      {spot.sourceURL && (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={spot.sourceURL}
                            target="_blank"
                            rel="noreferrer"
                          >
                            来源 ↗
                          </a>
                        </>
                      )}
                    </small>
                    {spot.snapshot === "user" && (
                      <button
                        className="travel-text-button"
                        disabled={busy}
                        onClick={() =>
                          void removeCatalog(
                            custom.find((item) => item.id === spot.id)!,
                          )
                        }
                        aria-label={`移除自填景点${spot.name}`}
                      >
                        移除自填条目
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {shownSpots.length > limit && (
              <button
                className="nutrition-soft-button"
                onClick={() => setLimit((value) => value + 20)}
              >
                再展开一些景点
              </button>
            )}
            <details className="travel-custom-spot">
              <summary>补充一个景点／其他地点</summary>
              <form onSubmit={addCatalog} noValidate>
                <label>
                  景点名称
                  <input
                    aria-label="补充景点名称"
                    value={newSpot.name}
                    maxLength={150}
                    onChange={(event) =>
                      setNewSpot({ ...newSpot, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  自填评级
                  <select
                    aria-label="补充景点评级"
                    value={newSpot.grade}
                    onChange={(event) =>
                      setNewSpot({
                        ...newSpot,
                        grade: event.target.value as TravelSpot["grade"],
                      })
                    }
                  >
                    {["其他", "5A"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  来源链接（可选）
                  <input
                    aria-label="补充景点来源"
                    value={newSpot.sourceURL}
                    maxLength={500}
                    onChange={(event) =>
                      setNewSpot({ ...newSpot, sourceURL: event.target.value })
                    }
                    placeholder="https://…"
                  />
                </label>
                <button className="primary" disabled={busy}>
                  保存补充景点
                </button>
              </form>
            </details>
            {cityTrips.length > 0 && (
              <>
                <h3 className="travel-section-title">在这座城的回忆</h3>
                {cityTrips.map((trip) => (
                  <button
                    className="travel-city-trip"
                    key={trip.id}
                    onClick={() => openTrip(trip)}
                  >
                    <strong>{trip.title}</strong>
                    <span>
                      {trip.startDate} — {trip.endDate}
                    </span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </Modal>
      <Modal
        {...modalProps}
        open={tripOpen}
        onClose={closeTrip}
        title={editing ? "编辑这段旅行" : "记下一段旅行"}
      >
        <form onSubmit={saveTrip} noValidate>
          {error && (
            <p className="nutrition-error" role="alert">
              {error}
            </p>
          )}
          <label>
            旅行标题（可选）
            <input
              aria-label="旅行标题"
              value={title}
              maxLength={100}
              disabled={asking || busy}
              onChange={(event) => {
                setTitle(event.target.value);
                setStoryConfirmed(false);
              }}
              placeholder="例如 春天，在杭州慢慢走"
            />
          </label>
          <div className="meal-form-top">
            <label>
              开始日期
              <input
                aria-label="旅行开始日期"
                type="date"
                value={startDate}
                disabled={asking || busy}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setStoryConfirmed(false);
                }}
              />
            </label>
            <label>
              结束日期
              <input
                aria-label="旅行结束日期"
                type="date"
                value={endDate}
                disabled={asking || busy}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setStoryConfirmed(false);
                }}
              />
            </label>
          </div>
          <p className="nutrition-small-note">
            未来日期的旅程可先记下，完成日期到达后才计入去过的城市。
          </p>
          <fieldset className="travel-city-picker">
            <legend>这一趟，去了哪些城市？</legend>
            <div className="meal-form-top">
              <label>
                省级区域
                <select
                  aria-label="行程省份"
                  value={addProvince}
                  disabled={asking || busy}
                  onChange={(event) => {
                    setAddProvince(event.target.value);
                    setAddCity("");
                  }}
                >
                  <option value="">先选省份</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                城市／地区
                <select
                  aria-label="行程城市"
                  value={addCity}
                  disabled={!addProvince || asking || busy}
                  onChange={(event) => setAddCity(event.target.value)}
                >
                  <option value="">再选城市</option>
                  {cities
                    .filter((city) => city.provinceId === addProvince)
                    .map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <button
              className="nutrition-soft-button"
              type="button"
              disabled={asking || busy}
              onClick={addStop}
            >
              ＋ 加入这座城市
            </button>
          </fieldset>
          {stops.map((stop) => {
            const items = catalog(stop.cityId).filter(
              (spot) =>
                !searches[stop.cityId] ||
                spot.name.includes(searches[stop.cityId]),
            );
            const manualValue = manualSpot[stop.cityId] || {
              name: "",
              grade: "其他",
            };
            return (
              <fieldset className="travel-stop" key={stop.cityId}>
                <legend>{cityById(stop.cityId)?.name}</legend>
                <button
                  type="button"
                  className="travel-remove-city"
                  disabled={asking || busy}
                  onClick={() => {
                    setStops(
                      stops.filter((item) => item.cityId !== stop.cityId),
                    );
                    setStoryConfirmed(false);
                  }}
                >
                  移出这座城市
                </button>
                <div className="travel-selected-spots">
                  {stop.spots.map((spot) => (
                    <button
                      type="button"
                      key={spot.name}
                      disabled={asking || busy}
                      onClick={() => toggleSpot(stop.cityId, spot, false)}
                    >
                      {spot.name} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
                <details>
                  <summary>选择去过的景区（5A／自填）</summary>
                  <input
                    aria-label={`${cityById(stop.cityId)?.name}景点搜索`}
                    value={searches[stop.cityId] || ""}
                    onChange={(event) =>
                      setSearches({
                        ...searches,
                        [stop.cityId]: event.target.value,
                      })
                    }
                    placeholder="搜索这座城市的景点"
                  />
                  <div className="travel-spot-options">
                    {items.slice(0, 30).map((spot) => (
                      <label key={spot.id}>
                        <input
                          type="checkbox"
                          checked={stop.spots.some(
                            (item) => item.name === spot.name,
                          )}
                          disabled={asking || busy}
                          onChange={(event) =>
                            toggleSpot(
                              stop.cityId,
                              {
                                name: spot.name,
                                grade: spot.grade,
                                catalogId: spot.id,
                              },
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          {spot.name}
                          <small>
                            {spot.grade} ·{" "}
                            {spot.snapshot === "user"
                              ? "自填，评级待核实"
                              : "来源快照"}
                          </small>
                        </span>
                      </label>
                    ))}
                    {!items.length && (
                      <p className="nutrition-small-note">
                        还没有匹配条目，下面可以手动填写。
                      </p>
                    )}
                    {items.length > 30 && (
                      <p className="nutrition-small-note">
                        先展示30条，输入名称可缩小范围。
                      </p>
                    )}
                  </div>
                </details>
                <div className="travel-manual-spot">
                  <label>
                    手动记下一个地点
                    <input
                      aria-label={`${cityById(stop.cityId)?.name}手动景点`}
                      maxLength={150}
                      value={manualValue.name}
                      disabled={asking || busy}
                      onChange={(event) =>
                        setManualSpot({
                          ...manualSpot,
                          [stop.cityId]: {
                            ...manualValue,
                            name: event.target.value,
                          },
                        })
                      }
                      placeholder="景区、街道、小店…"
                    />
                  </label>
                  <label>
                    自填评级
                    <select
                      aria-label={`${cityById(stop.cityId)?.name}自填评级`}
                      value={manualValue.grade}
                      disabled={asking || busy}
                      onChange={(event) =>
                        setManualSpot({
                          ...manualSpot,
                          [stop.cityId]: {
                            ...manualValue,
                            grade: event.target.value as TravelSpot["grade"],
                          },
                        })
                      }
                    >
                      {["其他", "5A"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="nutrition-soft-button"
                  disabled={asking || busy}
                  onClick={() => addManualSpot(stop.cityId)}
                >
                  加入这个地点
                </button>
              </fieldset>
            );
          })}
          <label>
            这段旅行的感受
            <textarea
              aria-label="旅行感受"
              maxLength={5000}
              rows={4}
              disabled={asking || busy}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setStoryConfirmed(false);
              }}
              placeholder="记一点真的发生过的小故事，黏黏包会认真收好。"
            />
          </label>
          <div className="travel-photo-heading">
            <h3>旅行照片</h3>
            <span>{photos.length}/12</span>
          </div>
          <button
            type="button"
            className="photo-upload"
            disabled={asking || busy || photoBusy}
            onClick={() => file.current?.click()}
          >
            <span aria-hidden="true">📷</span>
            {photoBusy ? "黏黏包正在收好照片…" : "拍照／上传旅行照片"}
            <small>本地压缩保存；写游记也不会自动发送照片</small>
          </button>
          <input
            hidden
            ref={file}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={loadPhotos}
          />
          <div className="travel-edit-photos">
            {photos.map((photo) => (
              <div key={photo.id}>
                <button
                  type="button"
                  className="travel-photo-preview"
                  onClick={() => setPreview(photo)}
                >
                  <img
                    src={photo.dataURL}
                    alt={photo.caption || "待保存的旅行照片"}
                  />
                </button>
                <input
                  aria-label={`照片说明${photo.id}`}
                  value={photo.caption}
                  maxLength={300}
                  disabled={asking || busy}
                  onChange={(event) =>
                    setPhotos(
                      photos.map((item) =>
                        item.id === photo.id
                          ? { ...item, caption: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="这张照片的小回忆"
                />
                <button
                  type="button"
                  className="travel-text-button"
                  disabled={asking || busy}
                  onClick={() =>
                    setPhotos(photos.filter((item) => item.id !== photo.id))
                  }
                >
                  移除照片
                </button>
              </div>
            ))}
          </div>
          <h3 className="travel-section-title">黏黏包陪你写游记</h3>
          <div className="analysis-actions">
            <button
              type="button"
              disabled={asking || busy || photoBusy}
              onClick={localStory}
            >
              {copy.local}
              <small>本地模板 · 不编造经历</small>
            </button>
            <button
              type="button"
              className="ai-calculate"
              disabled={asking || busy || photoBusy}
              onClick={() => void aiStory()}
            >
              {copy.ai}
              <small>仅发送本次旅行文字</small>
            </button>
          </div>
          <label className="nutrition-checkbox">
            <input
              type="checkbox"
              checked={consent}
              disabled={asking || busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              同意发送这次旅行的日期、城市、景点和感受给AI；不发送照片、账单或身体资料。
            </span>
          </label>
          {asking && (
            <div className="analysis-working" role="status">
              黏黏包正在把小故事串起来…
              <button type="button" onClick={() => controller.current?.abort()}>
                停止
              </button>
            </div>
          )}
          <label>
            游记草稿（可修改）
            <textarea
              aria-label="游记草稿"
              maxLength={12000}
              rows={8}
              value={story}
              disabled={asking || busy}
              onChange={(event) => {
                setStory(event.target.value);
                setStorySource("manual");
                setStoryConfirmed(false);
              }}
              placeholder="先整理一份草稿，也可以自己慢慢写。"
            />
          </label>
          {storySource === "ai" && (
            <label className="nutrition-checkbox">
              <input
                type="checkbox"
                checked={storyConfirmed}
                onChange={(event) => setStoryConfirmed(event.target.checked)}
              />
              <span>已核对AI游记，没有添加我未记录的经历</span>
            </label>
          )}
          <p className="nutrition-small-note">
            保存之前都只是草稿；黏黏包不会替你公开发布。照片留在当前设备，记得定期到个人页备份。
          </p>
          <button className="primary" disabled={busy || asking || photoBusy}>
            {busy ? "正在收好…" : "确认并保存旅程"}
          </button>
        </form>
      </Modal>
      <Modal
        {...modalProps}
        open={!!preview}
        onClose={() => setPreview(null)}
        title="这一刻的小回忆"
      >
        {preview && (
          <div className="travel-photo-lightbox">
            <img src={preview.dataURL} alt={preview.caption || "旅行照片"} />
            <p>{preview.caption || "一张留在设备里的旅行照片"}</p>
          </div>
        )}
      </Modal>
      {!cityId && !tripOpen && !preview && (
        <div className={`toast ${message ? "visible" : ""}`} role="status">
          {message}
        </div>
      )}
    </section>
  );
}
