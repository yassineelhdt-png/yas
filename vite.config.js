import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const pwa = VitePWA({
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
    background_color: "#F4F5F7",
    theme_color: "#F4F5F7",
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
});

// Build « artefact Claude » : tout dans un seul HTML, sans service worker ni fichiers annexes
const artifactHtml = {
  name: "artifact-html",
  transformIndexHtml: (html) =>
    html.replace(/\s*<link rel="(icon|apple-touch-icon)"[^>]*>/g, "").replace(/\s*<meta name="(apple-mobile-web-app-[^"]*|mobile-web-app-capable)"[^>]*>/g, "")
};

export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  return {
    // chemins relatifs : le même build sert GitHub Pages (/yas/), l'APK Android et l'app PC
    base: "./",
    define: {
      // la CI fournit APP_VERSION (ex. 2.0.12) ; en local : version du package.json
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
      __ARTIFACT__: JSON.stringify(artifact)
    },
    resolve: artifact ? { alias: { "virtual:pwa-register": fileURLToPath(new URL("./src/pwa-stub.js", import.meta.url)) } } : {},
    build: artifact
      ? { target: "es2020", outDir: "dist-artifact", assetsInlineLimit: Infinity, copyPublicDir: false }
      : { target: "es2020" },
    plugins: artifact ? [artifactHtml, viteSingleFile()] : [pwa],
    test: { include: ["tests/**/*.test.js"] }
  };
});
