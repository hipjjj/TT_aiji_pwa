# 小包的 AI 服务

前端仍部署在 GitHub Pages。真实照片/文字 AI 分析需要单独的 Cloudflare Worker 和有效的 OpenAI API 密钥。当前代码已实现接入与安全限制；没有凭据时不调用 OpenAI，也不会假装已经识别。

## 推荐：通过 GitHub Actions 发布

已有同名 Secret 可复用；不要在聊天、源码、前端设置或 README 中粘贴 API 密钥。

在仓库 Settings → Secrets and variables → Actions 中安全配置：

| Repository Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 限定到你的 Cloudflare 账户、拥有 Workers 部署权限的 API token |
| `CLOUDFLARE_ACCOUNT_ID` | 对应账户 ID |
| `NUTRITION_API_KEY` | 具有 API 使用额度的 OpenAI 密钥 |
| `NUTRITION_ACCESS_CODE` | 自行生成的随机访问口令，至少16字符，建议32字符以上；用于保护后端 |

可在自己的终端生成随机口令：`node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`。将结果安全保存，不提交到 Git。

在 Actions 中手动运行 **Deploy Xiaobao AI backend**。工作流会运行测试，部署 `tt-aiji-pwa-xiaobao-ai` 与持久额度存储，再通过标准输入设置 Worker Secret。最后检查健康状态并调用一次真实文字分析（会产生少量 API 费用及占用一次额度），验证 OpenAI 接通。它不会因为前端每次推送就自动部署，也不会输出密钥。

确认工作流成功后，从工作流摘要或 Cloudflare Workers 管理页取得实际 HTTPS 根地址。打开“营养屋 → 小包的食物库与估算说明 → 连接AI服务”，填写该地址和你设置的访问口令。这里不填写 OpenAI API 密钥。地址例如 `https://实际服务名.实际子域.workers.dev`，不要填写 `/analyze` 路径。

## 本机部署与开发

需 Node.js 24 和 `npm ci`。先通过自己的 Cloudflare 登录配置认证，再运行：

```sh
npm run worker:deploy
npx wrangler secret put NUTRITION_API_KEY --config server/wrangler.toml
npx wrangler secret put ACCESS_CODE --config server/wrangler.toml
```

密钥通过 Wrangler 的安全交互输入，勿写进 `wrangler.toml`。本地调试可使用被 Git 忽略的 `server/.dev.vars`，配置相同 Secret 后运行 `npm run worker:dev`。前端开发运行 `npm run dev`。本地 AI 地址可用 `http://127.0.0.1:8787`，仅开发模式允许 HTTP；把本地前端 Origin 加入开发用的 `ALLOWED_ORIGINS`，勿在生产改成通配符。没有密钥的本地服务 `/health` 会返回 `ready:false`，`/analyze` 返回503。

## API 与安全限制

- `GET /health`：只返回配置是否就绪及模型名，不返回凭据。
- `POST /analyze`：`Content-Type: application/json`，请求头 `X-Access-Code`。正文为 `{ "text": "米饭150克", "photo": null }`，或本地压缩后的 JPEG/PNG/WebP data URL；个人身体资料不在请求中。
- 返回 `{foods:[{name,grams,per100:{kcal,protein,carbs,fat},assumption,confidence}],note,model,source:"ai"}`。前端再次验证，并要求用户确认后保存。可匹配的食物优先使用同一个本地营养库换算；未匹配的营养数值标为 AI 估算。
- 默认模型为 `gpt-4.1-mini`，可在 `server/wrangler.toml` 中调整 `NUTRITION_MODEL`。
- OpenAI Responses API 使用结构化输出、`store:false`，最多2500个输出token。`store:false` 不等于提供商的零数据保留承诺；数据处理遵循提供商政策。
- 仅允许配置的前端 Origin，要求访问口令，并通过持久 Durable Object 对整个后端限制默认每日30次、每分钟5次。失败请求也消耗额度；日额度按 UTC 午夜重置。可调整 `DAILY_AI_LIMIT` / `PER_MINUTE_AI_LIMIT`。
- 缺少密钥、访问口令或额度存储时拒绝分析，防止无保护的付费调用。错误回复不包含 API 密钥、原始上游错误或请求照片。
- 照片只在点击问AI并勾选同意时发送。Worker 不持久保存照片或个人资料；额度存储只保存计数。
- 访问口令只保存在当前浏览器会话，不进入备份。Cloudflare/OpenAI 凭据始终在服务端。生产 Worker URL 是公开的，访问口令不可使用演示值或公开分享。

## 验证状态

单元测试覆盖认证、Origin、请求限额、持久额度并发控制、结构化响应校验和禁止传递身体资料。前端通过模拟 API 验证照片/文字分析、上传同意、确认与保存；没有真实凭据时不能据此声称 OpenAI 调用已验证。配置完成后应以真实饮食照片验证 `/health`、接口响应、份量确认与一次保存。
