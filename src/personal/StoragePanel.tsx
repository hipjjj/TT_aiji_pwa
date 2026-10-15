import React, { useEffect, useState } from "react";
import { db } from "../db";
const size = (bytes: number) =>
  bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(1) + " MB"
    : (bytes / 1024).toFixed(1) + " KB";
export default function StoragePanel() {
  const [stats, setStats] = useState<{
      records: number;
      photos: number;
      photoBytes: number;
      appBytes: number;
      last: number;
      usage?: number;
      quota?: number;
      persisted: boolean;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const tables = [
        db.expenses,
        db.meals,
        db.budgets,
        db.inventory,
        db.shopping,
        db.trips,
        db.overseasTrips,
        db.visitedCities,
        db.travelSpots,
        db.chatThreads,
        db.chatMessages,
        db.chatMemories,
        db.chatGrowth,
        db.nutritionProfiles,
        db.fridgePreferences,
        db.chatDrafts,
        db.personalFoods,
      ];
      const arrays = await db.transaction("r", tables, () =>
        Promise.all(tables.map((t) => t.toArray())),
      );
      let records = 0,
        photos = 0,
        photoBytes = 0,
        appBytes = 0;
      for (const list of arrays) {
        records += list.length;
        appBytes += new Blob([JSON.stringify(list)]).size;
        for (const row of list) {
          const r = row as unknown as {
            photo?: string;
            photos?: { dataURL: string }[];
          };
          const pictures = [
            ...(r.photo ? [r.photo] : []),
            ...(r.photos || []).map((p) => p.dataURL),
          ];
          photos += pictures.length;
          photoBytes += pictures.reduce((n, p) => n + new Blob([p]).size, 0);
        }
      }
      const last = await db.appMeta.get("last-backup");
      let estimate: StorageEstimate = {},
        persisted = false;
      try {
        estimate = (await navigator.storage?.estimate?.()) || {};
        persisted = (await navigator.storage?.persisted?.()) || false;
      } catch {
        /* App totals remain available on browsers without storage APIs. */
      }
      setStats({
        records,
        photos,
        photoBytes,
        appBytes,
        last: typeof last?.value === "number" ? last.value : 0,
        ...estimate,
        persisted,
      });
      setError("");
    } catch {
      setError("彪彪暂时算不出空间占用，请稍后刷新");
    }
  };
  useEffect(() => {
    void load();
    const onExport = () => void load();
    window.addEventListener("tt-backup-exported", onExport);
    return () => window.removeEventListener("tt-backup-exported", onExport);
  }, []);
  const persist = async () => {
    setBusy(true);
    try {
      const granted = await navigator.storage?.persist?.();
      await load();
      if (!granted) setError("浏览器暂未授予持久存储，请继续定期导出备份");
    } catch {
      setError("当前浏览器不支持这项设置，请定期备份");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="personal-ai storage-panel">
      <span className="park-label">BIAO BIAO’S LITTLE DRAWER</span>
      <h2>本机的小抽屉</h2>
      {stats ? (
        <>
          <div className="storage-grid">
            <div>
              <span>应用记录约占</span>
              <b>{size(stats.appBytes)}</b>
            </div>
            <div>
              <span>压缩照片</span>
              <b>{stats.photos} 张</b>
              <small>编码约占 {size(stats.photoBytes)}</small>
            </div>
          </div>
          <p className="personal-note">
            以上为记录和照片的估算，不含离线地图缓存。
            {stats.usage !== undefined
              ? `浏览器站点共占 ${size(stats.usage)}${stats.quota ? `，当前配额约 ${size(stats.quota)}` : ""}（可能包含同域其他网站）。`
              : ""}
          </p>
          <p>
            上次导出：
            {stats.last
              ? new Date(stats.last).toLocaleString("zh-CN")
              : "还没有导出过备份"}
          </p>
          {stats.records > 0 &&
            (!stats.last || Date.now() - stats.last > 7 * 86400000) && (
              <div className="storage-reminder" role="status">
                <strong>彪彪提醒：给小抽屉留一份备份吧。</strong>
                <p>
                  {stats.last
                    ? "已经超过7天没导出了。"
                    : "已有本地记录，建议导出第一份备份。"}
                </p>
                <button
                  onClick={() =>
                    document
                      .querySelector(".backup-panel")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  去导出备份
                </button>
              </div>
            )}
          <p className="personal-note">
            {stats.persisted
              ? "浏览器已授予持久存储。"
              : "本地存储仍可能被浏览器自动清理。"}
            清除网站数据、换设备或换域名仍需靠备份恢复。
          </p>
          {!stats.persisted &&
            typeof navigator.storage?.persist === "function" && (
              <button disabled={busy} onClick={() => void persist()}>
                增强本地保存
              </button>
            )}
          <button disabled={busy} onClick={() => void load()}>
            刷新空间统计
          </button>
        </>
      ) : (
        <p>彪彪正在清点小抽屉…</p>
      )}
      {error && (
        <p className="nutrition-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
