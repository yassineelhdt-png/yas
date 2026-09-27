// Génère les icônes (app web embarquée, Windows, Android) à partir de assets/icon.svg.
// Usage : npm run icons   (les fichiers générés sont versionnés : inutile de relancer à chaque build)
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const p = (rel) => fileURLToPath(new URL("../" + rel, import.meta.url));
const svg = readFileSync(p("assets/icon.svg"), "utf8");
const INK = "#D62839", BG = "#F5F3F4";

const rounded = Buffer.from(svg);
// motif seul, fond transparent, un peu réduit pour la zone sûre des icônes adaptatives Android
const foreground = Buffer.from(svg.replace(/<rect width="512"[^>]*\/>/, "").replace('<g id="pill" transform="', '<g id="pill" transform="translate(256 256) scale(.78) translate(-256 -256) '));
const round = Buffer.from(svg.replace(/<rect width="512"[^>]*\/>/, `<circle cx="256" cy="256" r="256" fill="${INK}"/>`));

const png = (buf, size, out) => sharp(buf, { density: 384 }).resize(size, size).png().toFile(p(out));

mkdirSync(p("assets/png"), { recursive: true });
mkdirSync(p("build"), { recursive: true });
await Promise.all([
  png(rounded, 192, "assets/png/icon-192.png"),
  png(rounded, 32, "assets/png/favicon-32.png"),
  png(rounded, 512, "build/icon.png") // Windows (electron-builder le convertit en .ico)
]);

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
  const splashes = ["drawable/splash.png"];
  for (const o of ["port", "land"]) for (const d of Object.keys(dens)) splashes.push(`drawable-${o}-${d}/splash.png`);
  jobs.push(...splashes.map(async (f) => {
    const { width, height } = await sharp(p(res + f)).metadata();
    const s = Math.round(Math.min(width, height) * 0.28);
    const icon = await sharp(rounded, { density: 384 }).resize(s, s).png().toBuffer();
    await sharp({ create: { width, height, channels: 4, background: BG } }).composite([{ input: icon, gravity: "centre" }]).png().toFile(p(res + f) + ".tmp");
    renameSync(p(res + f) + ".tmp", p(res + f));
  }));
  await Promise.all(jobs);
  writeFileSync(p(res + "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INK}</color>\n</resources>\n`);
  // l'icône adaptative utilise la couleur ci-dessus en fond et notre PNG en premier plan
  writeFileSync(p(res + "drawable/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <solid android:color="${INK}" />\n</shape>\n`);
}
console.log("Icônes générées.");
