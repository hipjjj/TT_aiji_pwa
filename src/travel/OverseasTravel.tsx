import React, { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { Modal } from "../nutrition/NutritionTab";
import { localDate } from "../nutrition/model.mjs";
import { preparePhoto } from "../nutrition/photo";
import {
  countries,
  countryName,
  validateOverseasTrip,
  overseasDraft,
  overseasStoryPayload,
  validateStoryResult,
  overseasFootprints,
} from "./overseas-model.mjs";
import type { OverseasTrip, OverseasStop } from "./overseas-types";
import type { TravelPhoto } from "./types";
export function OverseasCards({
  trips,
  onEdit,
  onDelete,
  onPreview,
}: {
  trips: OverseasTrip[];
  onEdit: (t: OverseasTrip) => void;
  onDelete: (t: OverseasTrip) => void;
  onPreview: (p: TravelPhoto) => void;
}) {
  return (
    <>
      {trips.map((t) => (
        <article className="travel-trip-card" key={t.id}>
          {t.photos[0] && (
            <button
              className="travel-cover-button"
              onClick={() => onPreview(t.photos[0])}
            >
              <img
                className="travel-cover"
                src={t.photos[0].dataURL}
                alt={t.photos[0].caption || t.title}
                loading="lazy"
              />
            </button>
          )}
          <div className="travel-trip-body">
            <span className="park-label">OVERSEAS LITTLE FOOTPRINTS</span>
            <h3>{t.title}</h3>
            <p className="travel-trip-date">
              {t.startDate} — {t.endDate}
              {t.endDate > localDate() ? " · 尚未计入海外足迹" : ""}
            </p>
            <p className="travel-route">
              {t.stops
                .map((s) => countryName(s.countryCode) + "·" + s.city)
                .join(" → ")}
            </p>
            <p className="travel-spots-text">
              {t.stops.flatMap((s) => s.spots).join("、") ||
                "还没有补充具体地点"}
            </p>
            {t.note && <p className="travel-trip-note">{t.note}</p>}
            {t.story && (
              <details className="travel-story">
                <summary>
                  翻开黏黏包的游记{" "}
                  <span>
                    {t.storySource === "ai"
                      ? "AI草稿 · 已确认"
                      : t.storySource === "template"
                        ? "本地整理"
                        : "手动书写"}
                  </span>
                </summary>
                <p>{t.story}</p>
              </details>
            )}
            {!!t.photos.length && (
              <details className="travel-trip-photos">
                <summary>看看 {t.photos.length} 张旅行照片</summary>
                <div className="travel-photo-grid">
                  {t.photos.map((p) => (
                    <button key={p.id} onClick={() => onPreview(p)}>
                      <img
                        loading="lazy"
                        src={p.dataURL}
                        alt={p.caption || "海外旅行照片"}
                      />
                      {p.caption && <span>{p.caption}</span>}
                    </button>
                  ))}
                </div>
              </details>
            )}
            <div className="travel-trip-actions">
              <button
                aria-label={"编辑海外旅行" + t.title}
                onClick={() => onEdit(t)}
              >
                编辑旅行
              </button>
              <button
                aria-label={"删除海外旅行" + t.title}
                onClick={() => onDelete(t)}
              >
                删除
              </button>
            </div>
          </div>
        </article>
      ))}
    </>
  );
}
export default function OverseasTravel({
  trips,
  onChanged,
  onManageAI,
  children,
}: {
  trips: OverseasTrip[];
  onChanged: () => Promise<void>;
  onManageAI: () => void;
  children?: (props: {
    cards: React.ReactNode;
    renderCard: (t: OverseasTrip) => React.ReactNode;
    open: (t?: OverseasTrip) => void;
  }) => React.ReactNode;
}) {
  const [editing, setEditing] = useState<OverseasTrip | null>(null),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(localDate()),
    [end, setEnd] = useState(localDate()),
    [stops, setStops] = useState<OverseasStop[]>([]),
    [note, setNote] = useState(""),
    [photos, setPhotos] = useState<TravelPhoto[]>([]),
    [story, setStory] = useState(""),
    [source, setSource] = useState<OverseasTrip["storySource"]>("manual"),
    [confirmed, setConfirmed] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [asking, setAsking] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<TravelPhoto | null>(null);
  const controller = useRef<AbortController | null>(null),
    draftID = useRef(""),
    editVersion = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  const startEdit = (t?: OverseasTrip) => {
    controller.current?.abort();
    editVersion.current++;
    setAsking(false);
    setEditing(t || null);
    draftID.current = t?.id || crypto.randomUUID();
    setTitle(t?.title || "");
    setStart(t?.startDate || localDate());
    setEnd(t?.endDate || localDate());
    setStops(
      t
        ? t.stops.map((s) => ({ ...s, spots: [...s.spots] }))
        : [{ countryCode: "", city: "", spots: [] }],
    );
    setNote(t?.note || "");
    setPhotos(t ? t.photos.map((p) => ({ ...p })) : []);
    setStory(t?.story || "");
    setSource(t?.storySource || "manual");
    setConfirmed(t?.storySource === "ai");
    setConsent(false);
    setError("");
    setOpen(true);
  };
  const trip = () =>
    validateOverseasTrip({
      id: draftID.current,
      title,
      startDate: start,
      endDate: end,
      stops,
      note,
      photos,
      story,
      storySource: source,
      updatedAt: Date.now(),
    }) as OverseasTrip;
  const updateStop = (i: number, patch: Partial<OverseasStop>) => {
    setStops(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setConfirmed(false);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const t = trip();
      if (t.storySource === "ai" && t.story && !confirmed)
        throw Error("请先核对AI游记，再勾选确认");
      await db.overseasTrips.put(t);
      await onChanged();
      setOpen(false);
      setMessage("黏黏包把海外的小脚印收好了！");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请检查本地空间");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (t: OverseasTrip) => {
    if (!confirm("删除「" + t.title + "」及其本地照片和游记？")) return;
    try {
      await db.overseasTrips.delete(t.id);
      await onChanged();
      setMessage("这段海外旅程已删除，足迹已重新计算");
    } catch {
      setMessage("删除失败，请重试");
    }
  };
  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoBusy(true);
    setError("");
    try {
      if (photos.length + files.length > 12)
        throw Error("一趟旅行最多12张照片");
      const added = [];
      for (const file of files)
        added.push({
          id: crypto.randomUUID(),
          dataURL: await preparePhoto(file),
          caption: "",
        });
      setPhotos([...photos, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "照片处理失败");
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  };
  const generate = async (ai: boolean) => {
    setError("");
    if (story && !confirm("用新的草稿替换当前游记？")) return;
    const version = editVersion.current;
    let abort: AbortController | null = null,
      timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const t = trip();
      if (!ai) {
        setStory(overseasDraft(t));
        setSource("template");
        setConfirmed(false);
        return;
      }
      if (!consent) throw Error("请先同意发送本次旅行文字");
      if (!navigator.onLine) throw Error("问AI需要联网，可以先本地整理");
      setAsking(true);
      abort = new AbortController();
      controller.current = abort;
      const signal = abort.signal;
      timer = setTimeout(() => abort?.abort(), 45000);
      const settings = await db.settings.get("ai"),
        url = settings
          ? settings.url
          : import.meta.env.VITE_NUTRITION_API_URL || "",
        code = sessionStorage.getItem("xiaobao-ai-access") || "";
      if (version !== editVersion.current || signal.aborted) return;
      if (!url || code.length < 16)
        throw Error("请到个人页配置AI连接，当前行程仍保留");
      const endpoint = new URL(url);
      if (
        endpoint.protocol !== "https:" ||
        endpoint.pathname !== "/" ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      )
        throw Error("AI后端地址格式无效");
      const r = await fetch(endpoint.origin + "/travel-story", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Access-Code": code },
        body: JSON.stringify(overseasStoryPayload(t)),
        signal,
      });
      const data = await r.json();
      if (version !== editVersion.current || signal.aborted) return;
      if (!r.ok) throw Error(data.error || "AI暂时不可用");
      setStory(validateStoryResult(data).story);
      setSource("ai");
      setConfirmed(false);
    } catch (e) {
      if (version === editVersion.current)
        setError(
          e instanceof Error
            ? e.name === "AbortError"
              ? "已停止整理，文字仍保留"
              : e.message
            : "游记生成失败",
        );
    } finally {
      if (timer) clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
      if (version === editVersion.current) setAsking(false);
    }
  };
  const footprints = overseasFootprints(trips);
  const cards = (
    <OverseasCards
      trips={trips}
      onEdit={startEdit}
      onDelete={(t) => void remove(t)}
      onPreview={setPreview}
    />
  );
  return (
    <>
      {children ? (
        children({
          cards,
          renderCard: (t) => (
            <OverseasCards
              trips={[t]}
              onEdit={startEdit}
              onDelete={(t) => void remove(t)}
              onPreview={setPreview}
            />
          ),
          open: startEdit,
        })
      ) : (
        <section className="overseas-section">
          <div className="section-head">
            <h3>黏黏包的海外小脚印</h3>
            <span>
              {footprints.countries.size} 个国家／地区 · {footprints.cityCount}{" "}
              个城市
            </span>
          </div>
          <p className="nutrition-small-note">中国地图外的回忆，也一起收好。</p>
          <button className="new-expense" onClick={() => startEdit()}>
            ＋ 记录海外旅行
          </button>
          <div className="overseas-countries">
            {[...footprints.countries].map(([code, citySet]) => (
              <article key={code}>
                <strong>{countryName(code)}</strong>
                <p>{[...citySet].join("、")}</p>
              </article>
            ))}
          </div>
          {!trips.length ? (
            <div className="empty">
              <h3>给远方留一页</h3>
              <p>记下国家、城市和照片，黏黏包陪你收好地图外的回忆。</p>
            </div>
          ) : (
            cards
          )}
        </section>
      )}
      <Modal
        open={open}
        onClose={() => {
          if (!busy && !photoBusy) {
            controller.current?.abort();
            setOpen(false);
          }
        }}
        title={editing ? "编辑海外旅行" : "记下一段海外旅行"}
        eyebrow="NIANNIAN BAO’S OVERSEAS FOOTPRINTS"
        className="travel-dialog"
      >
        <form onSubmit={save}>
          <fieldset
            disabled={busy || asking || photoBusy}
            className="overseas-fields"
          >
            <label>
              旅行标题
              <input
                aria-label="海外旅行标题"
                maxLength={100}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setConfirmed(false);
                }}
                required
              />
            </label>
            <div className="form-fields">
              <label>
                出发日期
                <input
                  aria-label="海外出发日期"
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setConfirmed(false);
                  }}
                  required
                />
              </label>
              <label>
                结束日期
                <input
                  aria-label="海外结束日期"
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setConfirmed(false);
                  }}
                  required
                />
              </label>
            </div>
            <h3>去哪些地方？</h3>
            {stops.map((s, i) => (
              <section className="overseas-stop" key={i}>
                <label>
                  国家／地区
                  <select
                    aria-label={`海外国家${i + 1}`}
                    value={s.countryCode}
                    onChange={(e) =>
                      updateStop(i, { countryCode: e.target.value })
                    }
                    required
                  >
                    <option value="">选择国家／地区</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  城市
                  <input
                    aria-label={`海外城市${i + 1}`}
                    maxLength={60}
                    value={s.city}
                    onChange={(e) => updateStop(i, { city: e.target.value })}
                    placeholder="例如 东京、巴黎"
                    required
                  />
                </label>
                <label>
                  去过的地点 <span>一行一个，选填</span>
                  <textarea
                    aria-label={`海外地点${i + 1}`}
                    value={s.spots.join("\n")}
                    onChange={(e) =>
                      updateStop(i, { spots: e.target.value.split("\n") })
                    }
                    onBlur={() =>
                      updateStop(i, {
                        spots: s.spots
                          .filter((v) => v.trim())
                          .map((v) => v.trim()),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStops(stops.filter((_, j) => j !== i));
                    setConfirmed(false);
                  }}
                >
                  移除这个城市
                </button>
              </section>
            ))}
            <button
              type="button"
              disabled={stops.length >= 20}
              onClick={() => {
                setStops([
                  ...stops,
                  {
                    countryCode: stops.at(-1)?.countryCode || "",
                    city: "",
                    spots: [],
                  },
                ]);
                setConfirmed(false);
              }}
            >
              ＋ 添加海外城市
            </button>
            <label>
              旅行感受
              <textarea
                aria-label="海外旅行感受"
                maxLength={5000}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              本地照片（{photos.length}/12）
              <input
                aria-label="海外照片"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => void addPhotos(e)}
              />
            </label>
            <div className="travel-edit-photos">
              {photos.map((p) => (
                <article key={p.id}>
                  <img src={p.dataURL} alt={p.caption || "海外旅行照片"} />
                  <input
                    aria-label="海外照片说明"
                    maxLength={300}
                    value={p.caption}
                    onChange={(e) =>
                      setPhotos(
                        photos.map((q) =>
                          q.id === p.id ? { ...q, caption: e.target.value } : q,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos(photos.filter((q) => q.id !== p.id))
                    }
                  >
                    移除照片
                  </button>
                </article>
              ))}
            </div>
            <div className="travel-story-actions">
              <button type="button" onClick={() => void generate(false)}>
                黏黏包整理游记
              </button>
              <button type="button" onClick={() => void generate(true)}>
                黏黏包问AI写游记
              </button>
            </div>
            <label className="nutrition-checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>仅发送本次日期、国家、城市、地点和感受，不发送照片</span>
            </label>
            <label>
              游记
              <textarea
                aria-label="海外游记"
                maxLength={12000}
                value={story}
                onChange={(e) => {
                  setStory(e.target.value);
                  setSource("manual");
                  setConfirmed(false);
                }}
              />
            </label>
            {source === "ai" && !!story && (
              <label className="nutrition-checkbox">
                <input
                  aria-label="确认海外AI游记"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>我已核对AI游记，确认没有虚构经历</span>
              </label>
            )}
            <button className="primary">
              {busy ? "正在收好…" : "确认并保存海外旅程"}
            </button>
          </fieldset>
          {asking && (
            <button type="button" onClick={() => controller.current?.abort()}>
              停止整理
            </button>
          )}
          {error && (
            <p role="alert" className="nutrition-error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="travel-settings-link"
            disabled={busy || asking || photoBusy}
            onClick={() => {
              if (confirm("前往个人页会离开当前未保存的海外旅行，确认离开？"))
                onManageAI();
            }}
          >
            前往个人页设置AI
          </button>
        </form>
      </Modal>
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="海外旅行照片"
        className="travel-photo-dialog"
      >
        {preview && (
          <>
            <img
              src={preview.dataURL}
              alt={preview.caption || "海外旅行照片"}
            />
            <p>{preview.caption}</p>
          </>
        )}
      </Modal>
      {message && <p role="status">{message}</p>}
    </>
  );
}
