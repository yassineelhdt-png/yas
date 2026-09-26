import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  // chemins relatifs : le même build sert GitHub Pages (/yas/), l'APK Android et l'app PC
  base: "./",
  // la CI fournit APP_VERSION (ex. 2.0.12) ; en local : version du package.json
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version) },
  build: { target: "es2020" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        id: "./",
        name: "Horaire 9h nettes",
        short_name: "Horaire 9h",
        description: "Planning quotidien B1 BIME : 9h d'étude nettes, calé sur l'heure de lever.",
        lang: "fr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#EDF0F3",
        theme_color: "#EDF0F3",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: { include: ["tests/**/*.test.js"] }
});
