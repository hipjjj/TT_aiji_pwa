import React, { useEffect, useState } from "react";
import {
  geometryPath,
  mapLabels,
  mapProjection,
  splitGeometry,
} from "./map.mjs";
import { provinces, provinceById, cities } from "./model.mjs";
import type { MapFeature, TravelMap as MapData } from "./types";
export default function TravelMap({
  provinceId,
  onProvince,
  onCity,
  visited,
}: {
  provinceId: string | null;
  onProvince: (id: string | null) => void;
  onCity: (id: string) => void;
  visited: Set<string>;
}) {
  const [data, setData] = useState<MapData | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setSearch("");
    fetch(
      `${import.meta.env.BASE_URL}travel-maps/${provinceId || "national"}.json`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw Error("地图暂时没有载入，请重试");
        return response.json();
      })
      .then((value) => {
        if (
          value.type !== "FeatureCollection" ||
          !Array.isArray(value.features) ||
          !value.features.length
        )
          throw Error("地图数据无效");
        setData(value as MapData);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "地图加载失败");
      });
    return () => controller.abort();
  }, [provinceId, attempt]);
  const province = provinceId ? provinceById(provinceId) : null;
  const choose = (id: string) => (provinceId ? onCity(id) : onProvince(id));
  const main = data?.features
    .map((feature) => ({
      ...feature,
      geometry: splitGeometry(feature.geometry).main,
    }))
    .filter((feature) => feature.geometry.coordinates.length) as
    MapFeature[] | undefined;
  const inset = data?.features
    .map((feature) => ({
      ...feature,
      geometry: splitGeometry(feature.geometry).inset,
    }))
    .filter((feature) => feature.geometry.coordinates.length) as
    MapFeature[] | undefined;
  const outline = data?.outline ? splitGeometry(data.outline) : null;
  const insetBounds = outline?.inset.coordinates.length
    ? [...(inset || []), { geometry: outline.inset }]
    : inset || [];
  const project = mapProjection(main || [], 620, 440),
    smallProject = mapProjection(insetBounds, 92, 116, 7);
  const labels = mapLabels(main || [], project) as {
    id: string;
    name: string;
    x: number;
    y: number;
  }[];
  const items = provinceId
    ? cities.filter((city) => city.provinceId === provinceId)
    : provinces;
  const displayed = items.filter(
    (item) => !search || item.name.includes(search),
  );
  const isVisited = (id: string) =>
    provinceId
      ? visited.has(id)
      : provinces
          .find((province) => province.id === id)
          ?.cityIds.some((cityId) => visited.has(cityId)) || false;
  return (
    <section className="travel-map-card">
      <div className="travel-map-heading">
        <div>
          <span className="park-label">Little Footprints</span>
          <h3>我的旅行足迹</h3>
        </div>
        <div className="travel-legend">
          <span>
            <i />
            去过
          </span>
          <span>
            <i />
            没去过
          </span>
        </div>
      </div>
      <div className="travel-breadcrumb">
        <button disabled={!provinceId} onClick={() => onProvince(null)}>
          全国
        </button>
        {province && (
          <>
            <span aria-hidden="true">›</span>
            <strong>{province.name}</strong>
            <button
              className="travel-map-back"
              onClick={() => onProvince(null)}
            >
              ‹ 返回全国
            </button>
          </>
        )}
      </div>
      {!data ? (
        <div className="travel-map-loading" role="status">
          {error ? (
            <>
              <p>{error}</p>
              <button onClick={() => setAttempt((value) => value + 1)}>
                重新加载地图
              </button>
            </>
          ) : (
            "黏黏包正在展开小地图…"
          )}
        </div>
      ) : (
        <svg
          className="travel-map"
          viewBox="0 0 620 440"
          role="group"
          aria-label={
            provinceId ? `${province?.name}城市地图` : "中国省级旅行地图"
          }
        >
          <defs>
            <filter id="travel-paper-shadow">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.2"
                floodColor="#b7a789"
                floodOpacity=".18"
              />
            </filter>
          </defs>
          <g className="travel-map-main">
            {main?.map((feature) => (
              <path
                key={feature.properties.id}
                d={geometryPath(feature.geometry, project)}
                className={
                  isVisited(feature.properties.id) ? "map-visited" : ""
                }
                role="button"
                tabIndex={0}
                aria-label={`${feature.properties.name}，${isVisited(feature.properties.id) ? "去过" : "没去过"}，${provinceId ? "查看景点和旅行" : "进入城市地图"}`}
                onClick={() => choose(feature.properties.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(feature.properties.id);
                  }
                }}
              >
                <title>{feature.properties.name}</title>
              </path>
            ))}
          </g>
          {outline && (
            <path
              className="travel-country-outline"
              d={geometryPath(outline.main, project)}
              aria-hidden="true"
            />
          )}
          <g className="travel-map-labels" aria-hidden="true">
            {labels.map((label) => (
              <g key={label.id} onClick={() => choose(label.id)}>
                <text x={label.x} y={label.y} textAnchor="middle">
                  {label.name}
                </text>
                {isVisited(label.id) && (
                  <text
                    className="map-star"
                    x={label.x}
                    y={label.y - 18}
                    textAnchor="middle"
                  >
                    ★
                  </text>
                )}
              </g>
            ))}
          </g>
          {!!inset?.length && (
            <g className="travel-map-inset" transform="translate(520 292)">
              <rect width="94" height="140" rx="10" />
              {inset.map((feature) => (
                <path
                  key={feature.properties.id}
                  d={geometryPath(feature.geometry, smallProject)}
                  className={
                    isVisited(feature.properties.id) ? "map-visited" : ""
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${feature.properties.name}南部岛屿，查看`}
                  onClick={() => choose(feature.properties.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(feature.properties.id);
                    }
                  }}
                />
              ))}
              {outline && (
                <path
                  className="travel-country-outline"
                  d={geometryPath(outline.inset, smallProject)}
                  aria-hidden="true"
                />
              )}
              <text x="47" y="132" textAnchor="middle">
                南海诸岛
              </text>
            </g>
          )}
        </svg>
      )}
      <p className="travel-map-note">
        {provinceId
          ? "点城市查看景点和记录；下方列表也能选择。"
          : "点省份进入城市地图，仍在同一个地图区域切换。"}
      </p>
      {province?.boundaryNote && (
        <p className="travel-data-note">{province.boundaryNote}</p>
      )}
      <label className="travel-search">
        <span className="sr-only">{provinceId ? "查找城市" : "查找省份"}</span>
        <input
          aria-label={provinceId ? "查找城市" : "查找省份"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={provinceId ? "找一座城市…" : "找一个省份…"}
        />
      </label>
      <div className="travel-region-list">
        {displayed.map((item) => (
          <button
            key={item.id}
            className={isVisited(item.id) ? "region-visited" : ""}
            onClick={() => choose(item.id)}
          >
            <span aria-hidden="true">{isVisited(item.id) ? "★" : "○"}</span>
            {item.name}
          </button>
        ))}
        {!displayed.length && <p>没有找到这个名称，换个关键词试试。</p>}
      </div>
      <details className="travel-map-source">
        <summary>地图和景区数据来源</summary>
        <p>
          行政边界参考 DataV.GeoAtlas
          开源镜像，非实时行政区划；直辖市和港澳整体记录，其他区域包括地级和省直辖地区。
          <a
            href="https://github.com/zhChuXiao/ChinaGeoJson"
            target="_blank"
            rel="noreferrer"
          >
            地图来源（2026-08-10快照） ↗
          </a>
        </p>
        <p>
          5A 列表采用 LoreRoutes 的373条名录快照（2026-08-31），CC BY-SA
          4.0；评级可能变动，请以主管部门最新公布为准。4A
          全国名录暂未完整收录，自填评级会明确标记。
          <a
            href="https://github.com/tuansuwu/china-5a-scenic-areas"
            target="_blank"
            rel="noreferrer"
          >
            景区来源 ↗
          </a>
        </p>
      </details>
    </section>
  );
}
