import React, { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { Modal } from "../nutrition/NutritionTab";
import { readAccessCode } from "../personal/access-code.mjs";
import {
  parseAnswerKey,
  makeRangePoints,
  pointsToRanges,
  validateGradingSettings,
  validateExamRecognition,
  gradeExam,
  validateExamRecord,
  choiceLetters,
} from "./model.mjs";
import { prepareExamPhoto } from "./photo";
import type { GradingSettings, ExamAnswer, ExamRecord } from "./types";
import "./style.css";
const display = (n: number) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
export default function GradingTab({ onManageAI }: { onManageAI: () => void }) {
  const [settings, setSettings] = useState<GradingSettings | null>(null),
    [ready, setReady] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [count, setCount] = useState("20"),
    [ranges, setRanges] = useState<
      { id: string; from: string; to: string; points: string }[]
    >([]),
    [keyText, setKeyText] = useState(""),
    [examName, setExamName] = useState("选择题试卷"),
    [settingsError, setSettingsError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null),
    [photoBusy, setPhotoBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<{
      settings: GradingSettings;
      answers: ExamAnswer[];
      note: string;
      model: string;
    } | null>(null),
    [title, setTitle] = useState(""),
    [keepPhoto, setKeepPhoto] = useState(true),
    [history, setHistory] = useState<
      { id: string; title: string; createdAt: number }[]
    >([]),
    [savedId, setSavedId] = useState<string | null>(null),
    [fullPhoto, setFullPhoto] = useState(false),
    [reviewOpen, setReviewOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null),
    alive = useRef(true),
    generation = useRef(0);
  const loadHistory = async () => {
    const rows: { id: string; title: string; createdAt: number }[] = [];
    await db.examGrades
      .orderBy("createdAt")
      .reverse()
      .limit(50)
      .each((row) => {
        rows.push({ id: row.id, title: row.title, createdAt: row.createdAt });
      });
    if (alive.current) setHistory(rows);
  };
  useEffect(() => {
    alive.current = true;
    db.gradingSettings
      .get("main")
      .then((value) => {
        if (alive.current) {
          setSettings(
            value ? (validateGradingSettings(value) as GradingSettings) : null,
          );
          setReady(true);
        }
      })
      .catch(() => setError("无法读取批阅设置，请检查本地存储"));
    void loadHistory().catch(() => {
      if (alive.current) setError("无法读取批阅历史，请检查本地存储");
    });
    return () => {
      alive.current = false;
      generation.current++;
      abort.current?.abort();
    };
  }, []);
  const resetResult = () => {
    setResult(null);
    setSavedId(null);
    setError("");
    setMessage("");
  };
  const editSettings = () => {
    if (
      result &&
      !confirm("修改设置后会清空当前显示的识别结果，已保存记录不变，继续吗？")
    )
      return;
    setCount(String(settings?.questionCount || 20));
    setRanges(
      settings
        ? pointsToRanges(settings.points).map((row) => ({
            id: crypto.randomUUID(),
            from: String(row.from),
            to: String(row.to),
            points: String(row.points),
          }))
        : [{ id: crypto.randomUUID(), from: "1", to: "", points: "" }],
    );
    setKeyText(settings?.key.join(" ") || "");
    setExamName(settings?.title || "选择题试卷");
    setSettingsError("");
    setSettingsOpen(true);
  };
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const questionCount = Number(count),
        value = validateGradingSettings({
          id: "main",
          title: examName,
          questionCount,
          key: parseAnswerKey(keyText, questionCount),
          points: makeRangePoints(
            questionCount,
            ranges.map((row) => ({
              from: Number(row.from),
              to: Number(row.to),
              points: Number(row.points),
            })),
          ),
          updatedAt: Date.now(),
        }) as GradingSettings;
      await db.gradingSettings.put(value);
      setSettings(value);
      resetResult();
      setSettingsOpen(false);
      setMessage("答案与分值设置已保存，下次可以继续使用。");
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "设置保存失败");
    } finally {
      setSaving(false);
    }
  };
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      result &&
      !confirm("更换照片会清空当前显示的结果，已保存记录不变，继续吗？")
    )
      return;
    const version = ++generation.current;
    setPhotoBusy(true);
    try {
      const value = await prepareExamPhoto(file);
      if (alive.current && version === generation.current) {
        setPhoto(value);
        resetResult();
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "无法读取照片");
    } finally {
      if (alive.current && version === generation.current) setPhotoBusy(false);
    }
  };
  const recognize = async () => {
    if (!settings || !photo || busy || photoBusy) return;
    if (result && !confirm("重新识别会替换当前显示的作答和修改，继续吗？"))
      return;
    setBusy(true);
    setError("");
    setMessage("");
    const controller = new AbortController(),
      version = ++generation.current;
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 80000);
    try {
      const config = await db.settings.get("ai"),
        access = readAccessCode(),
        url = config
          ? config.url
          : import.meta.env.VITE_NUTRITION_API_URL || "";
      if (!url || access.length < 16)
        throw Error("请先在个人页保存AI地址和访问口令");
      const endpoint = new URL(url);
      if (
        endpoint.protocol !== "https:" ||
        endpoint.pathname !== "/" ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      )
        throw Error("AI地址无效，请到个人页重新设置");
      if (!navigator.onLine)
        throw Error("AI识别需要联网；已保存的结果仍可离线查看");
      const response = await fetch(endpoint.origin + "/grade-exam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Code": access,
        },
        body: JSON.stringify({ questionCount: settings.questionCount, photo }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "试卷识别暂时不可用");
      const parsed = validateExamRecognition(data, settings.questionCount);
      if (alive.current && version === generation.current) {
        setResult({
          settings,
          answers: parsed.answers as ExamAnswer[],
          note: parsed.note,
          model: typeof data.model === "string" ? data.model : "GPT",
        });
        setReviewOpen(true);
        setSavedId(null);
        setTitle(settings.title || "选择题批阅");
      }
    } catch (e) {
      if (alive.current && version === generation.current)
        setError(
          controller.signal.aborted
            ? "已停止或超时，请重拍清晰的答题区后重试"
            : e instanceof Error
              ? e.message
              : "识别失败",
        );
    } finally {
      clearTimeout(timer);
      if (alive.current && version === generation.current) setBusy(false);
      if (abort.current === controller) abort.current = null;
    }
  };
  const score = result ? gradeExam(result.settings, result.answers) : null;
  const save = async () => {
    if (!result || !score) return;
    if (score.pending) {
      setError(
        "还有待核对题，请先在下方选择实际答案；明确未作答请选择“未作答”。",
      );
      return;
    }
    setSaving(true);
    try {
      const value = validateExamRecord({
        id: savedId || crypto.randomUUID(),
        title: title.trim() || result.settings.title || "选择题批阅",
        settings: result.settings,
        answers: result.answers,
        note: result.note,
        photo: keepPhoto ? photo : null,
        createdAt: Date.now(),
      }) as ExamRecord;
      await db.examGrades.put(value);
      setSavedId(value.id);
      await loadHistory();
      setError("");
      setMessage("批阅已保存到这台设备。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请检查本地空间");
    } finally {
      setSaving(false);
    }
  };
  const openRecord = async (id: string) => {
    if (
      result &&
      !savedId &&
      !confirm("打开历史记录会替换当前未保存结果，继续吗？")
    )
      return;
    try {
      const row = await db.examGrades.get(id);
      if (!row) throw Error("这条批阅记录已不存在");
      const value = validateExamRecord(row) as ExamRecord;
      setResult({
        settings: value.settings,
        answers: value.answers,
        note: value.note,
        model: "已保存的识别结果",
      });
      setPhoto(value.photo);
      setTitle(value.title);
      setSavedId(value.id);
      setReviewOpen(gradeExam(value.settings, value.answers).pending > 0);
      setError("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法打开记录");
    }
  };
  const remove = async (id: string) => {
    if (!confirm("删除这条批阅记录和保存的照片？")) return;
    try {
      await db.examGrades.delete(id);
      if (savedId === id) {
        resetResult();
        setPhoto(null);
      }
      await loadHistory();
    } catch {
      setError("删除失败，请重试");
    }
  };
  return (
    <section className="grading-tab">
      <div className="grading-heading">
        <span className="park-label">A LITTLE STRICT, A LOT OF CARE</span>
        <h2>邪恶包和羊羊包的批改室</h2>
        <p>选择题交过来，两只小企鹅一起认真批改。</p>
      </div>
      <section className="grading-settings-card">
        <div>
          <h3>答案与计分设置</h3>
          <p>
            {settings
              ? `${settings.questionCount}题 · 满分${display(settings.points.reduce((s, p) => s + p, 0))}分 · 单选题`
              : "先填标准答案，再上传试卷。第一版支持A–H单选题，最多100题。"}
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || busy || saving || photoBusy}
          onClick={editSettings}
        >
          {settings ? "修改设置" : "设置答案与分值"}
        </button>
      </section>
      <section className="grading-upload">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label="上传试卷照片"
          onChange={(e) => void pickPhoto(e)}
        />
        <button
          className="grading-photo-pick"
          type="button"
          disabled={!settings || busy || photoBusy || saving}
          onClick={() => input.current?.click()}
        >
          {photoBusy
            ? "正在整理清晰照片…"
            : photo
              ? "更换试卷照片"
              : "＋ 上传一张试卷照片"}
        </button>
        <p>
          请拍清题号和学生作答，尽量平铺、光线均匀；也可只拍答题区。照片只在点击识别时发送，标准答案与分值留在本机。
        </p>
        {photo && (
          <button
            className="grading-photo-preview"
            aria-label="查看试卷大图"
            type="button"
            onClick={() => setFullPhoto(true)}
          >
            <img src={photo} alt="本次试卷照片" />
          </button>
        )}
        <button
          className="primary"
          type="button"
          disabled={!settings || !photo || busy || photoBusy || saving}
          onClick={() => void recognize()}
        >
          {busy ? "两只小企鹅正在逐题看…" : "让邪恶包和羊羊包识别作答"}
        </button>
        {busy && (
          <button
            type="button"
            className="nutrition-soft-button"
            onClick={() => abort.current?.abort()}
          >
            停止识别
          </button>
        )}
        <button
          type="button"
          className="nutrition-soft-button"
          disabled={busy}
          onClick={onManageAI}
        >
          AI连接设置
        </button>
      </section>
      {error && (
        <p className="grading-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="grading-message" role="status">
          {message}
        </p>
      )}
      {result && score && (
        <section className="grading-result">
          <h3>批阅结果</h3>
          <div className="grading-score">
            <span>{score.pending ? "当前已确定得分" : "总分"}</span>
            <strong>
              {display(score.earned)}
              <small> / {display(score.total)}分</small>
            </strong>
            <p>
              对 {score.correct}题 · 错 {score.wrong}题
              {score.pending ? ` · ${score.pending}题待核对` : ""}
            </p>
          </div>
          <p className="grading-small">
            ✓ 对　✗ 错　? 待核对。由{result.model}
            识别作答，按你提供的答案与分值在本机计分。
          </p>
          {Array.from(
            { length: Math.ceil(score.rows.length / 10) },
            (_, block) => (
              <div className="grading-table-scroll" key={block}>
                <table className="grading-result-table">
                  <caption className="sr-only">
                    第{block * 10 + 1}至
                    {Math.min((block + 1) * 10, score.rows.length)}题对错
                  </caption>
                  <thead>
                    <tr>
                      <th>题号</th>
                      {score.rows
                        .slice(block * 10, block * 10 + 10)
                        .map((row) => (
                          <th key={row.number}>{row.number}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>对错</th>
                      {score.rows
                        .slice(block * 10, block * 10 + 10)
                        .map((row) => (
                          <td
                            key={row.number}
                            className={row.status}
                            aria-label={`第${row.number}题${row.status === "correct" ? "正确" : row.status === "wrong" ? "错误" : "待核对"}`}
                          >
                            {row.status === "correct"
                              ? "✓"
                              : row.status === "wrong"
                                ? "✗"
                                : "?"}
                          </td>
                        ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          )}
          {result.note && <p className="grading-small">{result.note}</p>}
          <details
            className="grading-review"
            open={reviewOpen}
            onToggle={(event) => setReviewOpen(event.currentTarget.open)}
          >
            <summary>核对／修改识别答案</summary>
            <p>
              看不清的题不会直接判错。选择实际选项即表示已核对；空白请选择“未作答”，分数会立即重算。
            </p>
            <div className="grading-answer-grid">
              {result.answers.map((row, i) => (
                <label
                  key={row.number}
                  className={
                    score.rows[i].status === "pending" ? "needs-review" : ""
                  }
                >
                  <b>
                    第{row.number}题 · {result.settings.points[i]}分
                  </b>
                  <select
                    aria-label={`第${row.number}题学生答案`}
                    disabled={saving || busy}
                    value={row.answer}
                    onChange={(e) =>
                      setResult({
                        ...result,
                        answers: result.answers.map((answer, j) =>
                          i === j
                            ? {
                                ...answer,
                                answer: e.target.value,
                                confirmed: e.target.value !== "?",
                              }
                            : answer,
                        ),
                      })
                    }
                  >
                    <option value="?">待核对</option>
                    <option value="">未作答</option>
                    {choiceLetters.map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                  <small>
                    标准答案：{result.settings.key[i]}
                    {row.note ? ` · ${row.note}` : ""}
                  </small>
                </label>
              ))}
            </div>
          </details>
          <label>
            批阅名称
            <input
              aria-label="批阅名称"
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving || busy}
            />
          </label>
          <label className="nutrition-checkbox">
            <input
              type="checkbox"
              checked={keepPhoto}
              disabled={saving || busy}
              onChange={(e) => setKeepPhoto(e.target.checked)}
            />
            <span>同时保存本次压缩照片</span>
          </label>
          <button
            className="primary"
            disabled={busy || saving}
            onClick={() => void save()}
          >
            {saving ? "正在保存…" : savedId ? "保存批阅修改" : "确认并保存批阅"}
          </button>
        </section>
      )}
      <details className="grading-history">
        <summary>最近批阅 · {history.length}条</summary>
        {!history.length && <p>确认保存后，邪恶包和羊羊包会把结果放在这里。</p>}
        {history.map((row) => (
          <article key={row.id}>
            <button
              type="button"
              disabled={busy || saving || photoBusy}
              onClick={() => void openRecord(row.id)}
            >
              {row.title || "选择题批阅"}
              <small>{new Date(row.createdAt).toLocaleString("zh-CN")}</small>
            </button>
            <button
              type="button"
              disabled={busy || saving}
              aria-label={`删除批阅 ${row.title}`}
              onClick={() => void remove(row.id)}
            >
              删除
            </button>
          </article>
        ))}
      </details>
      <Modal
        open={settingsOpen}
        onClose={() => {
          if (!saving) setSettingsOpen(false);
        }}
        title="设置答案与分值"
        eyebrow="邪恶包和羊羊包的批改室"
      >
        <form onSubmit={saveSettings}>
          <label>
            试卷名称
            <input
              aria-label="试卷名称"
              maxLength={100}
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
            />
          </label>
          <label>
            总共几题
            <input
              aria-label="选择题总题数"
              type="number"
              min="1"
              max="100"
              step="1"
              required
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <section className="grading-score-ranges" aria-label="指定题目分值">
            <h3>指定题目分值</h3>
            <p className="grading-small">
              题目A是起始题号，题目B是结束题号。单题的两个题号填相同数字；每道题都需要设置分值，区间不能重叠。
            </p>
            {ranges.map((row, index) => (
              <fieldset
                key={row.id}
                className="grading-score-range"
                disabled={saving}
              >
                <legend>第{index + 1}组</legend>
                {ranges.length > 1 && (
                  <button
                    type="button"
                    className="grading-remove-range"
                    aria-label={`删除第${index + 1}组区间`}
                    onClick={() =>
                      setRanges((previous) =>
                        previous.filter((x) => x.id !== row.id),
                      )
                    }
                  >
                    删除区间
                  </button>
                )}
                <div className="grading-range-inputs">
                  <label>
                    题目A
                    <input
                      aria-label={`第${index + 1}组题目A`}
                      type="number"
                      min="1"
                      max={Number(count) || 100}
                      step="1"
                      required
                      value={row.from}
                      onChange={(e) =>
                        setRanges((previous) =>
                          previous.map((x) =>
                            x.id === row.id
                              ? { ...x, from: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    题目B
                    <input
                      aria-label={`第${index + 1}组题目B`}
                      type="number"
                      min="1"
                      max={Number(count) || 100}
                      step="1"
                      required
                      value={row.to}
                      onChange={(e) =>
                        setRanges((previous) =>
                          previous.map((x) =>
                            x.id === row.id ? { ...x, to: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    每题分数
                    <input
                      aria-label={`第${index + 1}组每题分数`}
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      required
                      value={row.points}
                      onChange={(e) =>
                        setRanges((previous) =>
                          previous.map((x) =>
                            x.id === row.id
                              ? { ...x, points: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              className="grading-add-range"
              disabled={saving || ranges.length >= 100}
              onClick={() =>
                setRanges((previous) => {
                  const end = Math.max(
                    0,
                    ...previous.map((row) => Number(row.to) || 0),
                  );
                  return [
                    ...previous,
                    {
                      id: crypto.randomUUID(),
                      from:
                        end > 0 && end < Number(count) ? String(end + 1) : "",
                      to: "",
                      points: "",
                    },
                  ];
                })
              }
            >
              ＋ Add new
            </button>
          </section>
          <label>
            标准答案
            <textarea
              aria-label="标准答案"
              required
              rows={5}
              maxLength={4000}
              placeholder={"1.A 2.C 3.B 4.D\n也可以直接输入ACBD"}
              value={keyText}
              onChange={(e) => setKeyText(e.target.value)}
            />
          </label>
          <p className="grading-small">
            必须提供全部题目的答案，第一版为单选题。标准答案保存在本机，不发给AI。
          </p>
          {settingsError && (
            <p className="grading-error" role="alert">
              {settingsError}
            </p>
          )}
          <button className="primary" disabled={saving}>
            {saving ? "正在保存…" : "保存批阅设置"}
          </button>
        </form>
      </Modal>
      <Modal
        open={fullPhoto}
        onClose={() => setFullPhoto(false)}
        title="试卷照片"
        eyebrow="邪恶包和羊羊包的批改室"
      >
        {photo && (
          <img className="grading-full-photo" src={photo} alt="试卷大图" />
        )}
      </Modal>
    </section>
  );
}
