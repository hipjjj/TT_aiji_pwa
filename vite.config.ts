import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
// Every Pages workflow run has a monotonically increasing release number.
export default defineConfig(({ mode }) => {
const release = Number(loadEnv(mode, '.', 'GITHUB_').GITHUB_RUN_NUMBER || 0);
const appVersion = `${String(1 + Math.floor(release / 100)).padStart(2, '0')}.${String(release % 100).padStart(2, '0')}`;
return {
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|dexie)\//.test(id))
            return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "天天爱记",
        short_name: "天天爱记",
        description: "企鹅朋友陪你记账、吃饭、旅行、工作与学习",
        lang: "zh-CN",
        theme_color: "#dcecf7",
        background_color: "#fff9ed",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "./bobby-icon-v2-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "./bobby-icon-v2-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "./bobby-maskable-v2-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,png,svg,webp}", "travel-maps/*.json", "study-dictionary/*.{json,txt}"],
      },
    }),
  ],
};
});
