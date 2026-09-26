// Construit la version « artefact Claude » : un seul fichier HTML sans <html>/<head>/<body>
// (Claude ajoute lui-même ce squelette à la publication). Résultat : dist-artifact/horaire-9h.html
import { readFileSync, writeFileSync } from "node:fs";
import { build } from "vite";

await build({ mode: "artifact", logLevel: "warn" });

const out = new URL("../dist-artifact/", import.meta.url);
const html = readFileSync(new URL("index.html", out), "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  // charset et viewport sont fournis par le squelette de l'artefact
  .replace(/\s*<meta charset="[^"]*">/, "")
  .replace(/\s*<meta name="viewport"[^>]*>/, "");
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
// le <title> doit rester en tête de fichier (seuls les 8 premiers Ko sont lus pour le nom)
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const page = [title, head.replace(title, "").trim(), body.trim()].join("\n") + "\n";
writeFileSync(new URL("horaire-9h.html", out), page);
console.log("dist-artifact/horaire-9h.html :", (page.length / 1024).toFixed(0), "Ko");
