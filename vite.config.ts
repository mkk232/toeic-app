/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// 배포본에만 넣는 보안 정책: 스크립트는 이 앱 것만, 외부 접속은 Claude API 만.
// (개발 서버는 즉시 새로고침용 스크립트를 쓰므로 넣지 않음)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.anthropic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

const csp = (): Plugin => ({
  name: "toeic-csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    csp(),
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "토익 공부",
        short_name: "토익",
        lang: "ko",
        display: "standalone",
        start_url: ".",
        background_color: "#ffffff",
        theme_color: "#1f6feb",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
  },
});
