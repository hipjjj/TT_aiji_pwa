import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins: [react(), VitePWA({registerType:'autoUpdate', manifest:{name:'天天爱记',short_name:'天天爱记',description:'离线可用的个人开销账本',lang:'zh-CN',theme_color:'#dcecf7',background_color:'#fff9ed',display:'standalone',start_url:'./',scope:'./',icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png'},{src:'./icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},workbox:{globPatterns:['**/*.{js,css,html,png,svg,webp}']}})] });
