import {readAccessCode,saveAccessCode,clearAccessCode} from './access-code.mjs';
import React, { useEffect, useState } from "react";
import { db } from "../db";
export default function AISettings() {
  const [url, setURL] = useState(""),
    [code, setCode] = useState(""),
    [savedURL, setSavedURL] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    db.settings
      .get("ai")
      .then((settings) => {
        const value = settings
          ? settings.url
          : import.meta.env.VITE_NUTRITION_API_URL || "";
        setURL(value);
        setSavedURL(value);
        setCode(readAccessCode());
        setReady(true);
      })
      .catch(() => setError("彪彪暂时打不开连接设置，请检查浏览器存储"));
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const parsed = new URL(url.trim());
      const local =
        import.meta.env.DEV &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
        parsed.protocol === "http:";
      if (
        (parsed.protocol !== "https:" && !local) ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname !== "/"
      )
        throw new Error(
          "请输入 AI 后端的 HTTPS 根地址，不要填写 /analyze、/recipes 、/travel-story 或 /chat",
        );
      const access = code.trim();
      if (access.length < 16 || access.length > 200)
        throw new Error("访问口令须为16–200字符");
      saveAccessCode(access);
      await db.settings.put({ id: "ai", url: parsed.origin });
      setURL(parsed.origin);
      setCode(access);
      setSavedURL(parsed.origin);
      setMessage("彪彪收好连接信息啦！企鹅朋友都会使用这份设置。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await db.settings.put({ id: "ai", url: "" });
      clearAccessCode();
      setURL("");
      setCode("");
      setSavedURL("");
      setMessage("AI连接已清除，本地功能仍可使用");
    } catch {
      setError("清除连接失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="personal-ai">
      <span className="park-label">Biao Biao’s Connections</span>
      <h2>AI连接设置</h2>
      <p className="personal-note">
        企鹅小家的聊天、小包的营养分析、嘟嘟糕的食谱和黏黏包的游记，共用这里的 OpenAI 连接信息。
      </p>
      <span className="personal-connection-state">
        {!ready
          ? "正在读取…"
          : savedURL && code
            ? "已保存地址和设备口令 · 尚未验证服务"
            : savedURL
              ? "已保存服务地址 · 请补充访问口令"
              : "尚未配置 · 本地功能可正常使用"}
      </span>
      <form onSubmit={save} noValidate>
        <label>
          API后端地址
          <input
            aria-label="API后端地址"
            type="url"
            value={url}
            disabled={!ready || busy}
            onChange={(event) => setURL(event.target.value)}
            placeholder="https://服务名.workers.dev"
            autoComplete="url"
          />
        </label>
        <label>
          AI服务访问口令
          <input
            aria-label="AI服务访问口令"
            type="password"
            value={code}
            disabled={!ready || busy}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <p className="personal-note">
          服务地址和访问口令保存在当前设备，关闭后再打开无需重新输入。可随时清除连接；两者都不随备份导出。
        </p>
        <button className="backup-primary" disabled={!ready || busy}>
          {busy ? "正在保存…" : "保存AI连接"}
        </button>
        {savedURL && (
          <button
            type="button"
            className="backup-secondary"
            disabled={busy}
            onClick={() => void clear()}
          >
            清除AI连接
          </button>
        )}
        {error && (
          <p className="nutrition-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="personal-result" role="status">
            {message}
          </p>
        )}
      </form>
      <details className="personal-server-help">
        <summary>OpenAI API 密钥在哪里配置？</summary>
        <p>
          OpenAI API 密钥由 Cloudflare 后端保管，不填写在网页中。在 GitHub
          仓库的 Actions Secrets 安全配置
          CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID、NUTRITION_API_KEY、NUTRITION_ACCESS_CODE，然后运行
          Deploy Xiaobao AI backend。
        </p>
        <a
          href="https://github.com/hipjjj/TT_aiji_pwa/settings/secrets/actions"
          target="_blank"
          rel="noreferrer"
        >
          打开安全配置页面 ↗
        </a>
        <p>
          API服务地址填写部署后的 Worker 根地址；访问口令对应
          NUTRITION_ACCESS_CODE。保存连接信息不会调用AI，分析仍需你明确同意并主动点击。
        </p>
      </details>
    </section>
  );
}
