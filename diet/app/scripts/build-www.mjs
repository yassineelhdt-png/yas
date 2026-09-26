// Prépare l'app Android / PC : diet/mon-suivi.html (source de l'artefact Claude, sans <head>)
// devient www/index.html, un document complet qui marche hors ligne (polices et icônes locales).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// fileURLToPath (et pas URL.pathname) : chemins valides aussi sous Windows
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const src = readFileSync(here("../../mon-suivi.html"), "utf8");
const www = here("../www/");
rmSync(www, { recursive: true, force: true });
mkdirSync(www + "fonts", { recursive: true });
mkdirSync(www + "icons", { recursive: true });

// Polices : les mêmes que sur Google Fonts, mais embarquées (l'app doit marcher sans réseau)
const fonts = [
  ["Figtree", "@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2", "figtree.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"],
  ["Figtree", "@fontsource-variable/figtree/files/figtree-latin-ext-wght-normal.woff2", "figtree-ext.woff2", "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"],
  ["Unbounded", "@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2", "unbounded.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"]
];
const faces = fonts.map(([family, from, to, range]) => {
  copyFileSync(here("../node_modules/" + from), www + "fonts/" + to);
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:200 900;font-display:swap;src:url(fonts/${to}) format("woff2");unicode-range:${range};}`;
}).join("\n");

// L'en-tête de l'artefact (titre, polices Google, styles) passe dans <head>, le reste dans <body>
const cut = src.indexOf('<div id="app">');
if (cut < 0) throw new Error("mon-suivi.html : <div id=\"app\"> introuvable");
const head = src.slice(0, cut)
  .replace(/\s*<link rel="preconnect"[^>]*>/g, "")
  .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, "")
  .trim();
const body = src.slice(cut).trim();

for (const f of ["icon-192.png", "favicon-32.png"]) {
  if (existsSync(here("../assets/png/" + f))) copyFileSync(here("../assets/png/" + f), www + "icons/" + f);
}

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#EDF1F5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10161F" media="(prefers-color-scheme: dark)">
<link rel="icon" href="icons/favicon-32.png">
<!-- même base que le squelette des artefacts Claude -->
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<style>
${faces}
</style>
${head}
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(www + "index.html", html);
console.log("www/index.html :", (html.length / 1024).toFixed(0), "Ko");
