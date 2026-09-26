// Génère toutes les icônes (web, iPhone, Android, Windows) à partir de assets/*.svg.
// Usage : npm run icons   (les fichiers générés sont versionnés : inutile de relancer à chaque build)
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const p = (rel) => new URL(rel, root).pathname;
const rounded = readFileSync(p("assets/icon.svg"));
const fullbleed = readFileSync(p("assets/icon-fullbleed.svg"));
const BLUE = "#1A47D6", BG = "#EDF0F3";

const png = (svg, size, out) => sharp(svg, { density: 384 }).resize(size, size).png().toFile(p(out));

// motif seul, fond transparent (premier plan des icônes adaptatives Android)
const foreground = Buffer.from(
  fullbleed.toString().replace(/<rect[^>]*\/>/, "").replace("scale(.72)", "scale(.7)")
);
// icône ronde (anciens lanceurs Android)
const round = Buffer.from(fullbleed.toString().replace(/<rect([^>]*)\/>/, '<circle cx="256" cy="256" r="256" fill="' + BLUE + '"/>'));

mkdirSync(p("public/icons"), { recursive: true });
mkdirSync(p("build"), { recursive: true });

await Promise.all([
  // web / PWA
  png(rounded, 192, "public/icons/icon-192.png"),
  png(rounded, 512, "public/icons/icon-512.png"),
  png(fullbleed, 512, "public/icons/icon-maskable-512.png"),
  png(rounded, 32, "public/icons/favicon-32.png"),
  // iPhone : l'icône est arrondie par iOS, on fournit un carré plein
  png(fullbleed, 180, "public/icons/apple-touch-icon.png"),
  // Windows (electron-builder convertit en .ico)
  png(rounded, 512, "build/icon.png")
]);
copyFileSync(p("assets/icon.svg"), p("public/icons/favicon.svg"));

// Android
const res = "android/app/src/main/res/";
if (existsSync(p(res))) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const jobs = [];
  for (const [d, k] of Object.entries(dens)) {
    jobs.push(png(rounded, 48 * k, `${res}mipmap-${d}/ic_launcher.png`));
    jobs.push(png(round, 48 * k, `${res}mipmap-${d}/ic_launcher_round.png`));
    jobs.push(png(foreground, 108 * k, `${res}mipmap-${d}/ic_launcher_foreground.png`));
  }
  // écrans de démarrage : fond clair + icône au centre
  const splash = async (file) => {
    const { width, height } = await sharp(p(file)).metadata();
    const s = Math.round(Math.min(width, height) * 0.28);
    const icon = await sharp(rounded, { density: 384 }).resize(s, s).png().toBuffer();
    await sharp({ create: { width, height, channels: 4, background: BG } })
      .composite([{ input: icon, gravity: "centre" }])
      .png()
      .toFile(p(file) + ".tmp");
  };
  const splashes = ["drawable/splash.png"];
  for (const o of ["port", "land"]) for (const d of Object.keys(dens)) splashes.push(`drawable-${o}-${d}/splash.png`);
  jobs.push(...splashes.map(async (f) => {
    await splash(res + f);
    copyFileSync(p(res + f) + ".tmp", p(res + f));
    (await import("node:fs")).unlinkSync(p(res + f) + ".tmp");
  }));
  await Promise.all(jobs);
  writeFileSync(p(res + "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BLUE}</color>\n</resources>\n`);
}
console.log("Icônes générées.");
