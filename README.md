# 天天爱记 · TT_aiji_pwa

使用 React、TypeScript、Vite、Dexie 构建的个人开销 PWA。人民币金额以整数分保存，账单保存在当前浏览器的 IndexedDB 中，无需账号和后端。

## 开发

需要 Node.js 22.12+（当前环境使用 Node.js 24）。

```sh
npm ci
npm run dev
```

## 验证与构建

```sh
npm test
npm run build
npm run preview
```

界面采用企鹅游乐园主题：原创毛绒企鹅插画、奶油黄门票式月度统计、蜜桃色记账按钮和冰蓝底部导航。账单、统计、备份有独立页面；新增和编辑使用支持键盘焦点与 Escape 关闭的弹窗。插画随 PWA 一起离线缓存。

支持新增、编辑、删除账单，按月统计和分类汇总，JSON 备份导入导出。导入合并账单，相同编号更新已有记录，导入前验证所有数据并确认。单笔金额范围为 0.01–1,000,000 元。

生产构建自动生成 manifest 和 service worker；首次联网访问后可离线打开。开发模式不注册离线缓存，验证 PWA 请使用生产预览。部署 dist 到支持 HTTPS 的静态托管平台，站点路径默认是域名根目录。支持的浏览器可通过菜单安装；iOS Safari 可选择“分享 → 添加到主屏幕”。

数据仅保存在当前浏览器，不会跨设备同步。清理网站数据、卸载相关浏览器或使用隐私模式可能导致数据丢失，请定期导出备份。备份包含账单明文，请妥善保管。

## GitHub Pages 测试网站

已配置 `.github/workflows/deploy-pages.yml`：推送 main 后运行测试、以 `/TT_aiji_pwa/` 为路径构建并发布到 Pages。
首次部署需要在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。如果首次工作流因 Pages 尚未启用而失败，启用后在 Actions 中重新运行该工作流。

预计地址为 `https://hipjjj.github.io/TT_aiji_pwa/`，以成功的 Pages 部署结果为准。网页资源是公开的，账单仍保存在各访问者自己的浏览器中。

本地验证部署路径：

```sh
npm run build -- --base=/TT_aiji_pwa/
npm run preview
```

预览时访问 `/TT_aiji_pwa/`。PWA 的 manifest、图标和 service worker 均支持该子路径。

## 记账分类

按顺序提供：餐饮、食品日用、生活缴费、交通、购物、娱乐、医疗、旅行、人情、其他。旧账单中的“住房”会自动归入“生活缴费”，金额、日期、备注与编号保持不变；旧备份导入时也会进行相同转换。
