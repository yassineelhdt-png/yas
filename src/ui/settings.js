// Vue « Réglages » : paramètres du planning, apparence, sauvegarde.
import { html, nothing } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { state, S, saveSettings, resetSettings, setTheme, toast, exportData, importData } from "../store.js";
import { platform } from "../platform.js";
import { icons } from "./icons.js";

// [clé, libellé, type, options] — type : time | date | bool | sel | min | h | sem
// options.min / options.max bornent les nombres
const FORM = [
  ["Journée", [
    ["wake", "Réveil habituel (si tu ne saisis rien)", "time"],
    ["prep", "Préparation après le lever", "min"],
    ["targetH", "Objectif net par jour", "h", { min: 1, max: 14 }],
    ["sleepH", "Sommeil visé", "h", { min: 4, max: 12 }]
  ]],
  ["Rythme", [
    ["session", "Session de concentration max", "min", { min: 15 }],
    ["pause", "Micro-pause", "min"],
    ["bigPause", "Grande pause", "min"],
    ["lunch", "Déjeuner", "min"],
    ["dinner", "Dîner", "min"],
    ["sport", "Sport", "min"],
    ["shower", "Douche après le sport", "min"]
  ]],
  ["Unif · Erasme", [
    ["travel", "Trajet aller simple", "min"],
    ["guidChimDay", "Guidance chimie : jour", "sel", { choices: [[2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"]] }],
    ["guidChimDur", "Guidance chimie : durée", "min", { min: 15 }],
    ["permPhysDay", "Permanence physique : jour", "sel", { choices: [[1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"], [5, "Vendredi"]] }],
    ["permPhysStart", "Permanence physique : arrivée", "time"],
    ["permPhysDur", "Permanence physique : durée", "min", { min: 15 }],
    ["appuiMath", "Appui maths du mardi", "bool"],
    ["appuiBio", "Appui bio du vendredi", "bool"],
    ["attendTheory", "Aller aux cours théoriques", "bool"]
  ]],
  ["Week-end", [
    ["chimOrga", "Samedi : chimie organique (Q2)", "min"],
    ["chimMin", "Samedi : chimie minérale (Q2)", "min"],
    ["concoursSat", "Samedi : prépa concours physique + maths", "min"],
    ["revSat", "Samedi : révision de la semaine", "min"],
    ["concoursStart", "Début du concours blanc (vide = dès que prêt)", "time"],
    ["concoursPause", "Pause entre les deux parties", "min"],
    ["raisonnement", "Raisonnement", "min"],
    ["ethique", "Éthique & empathie", "min"],
    ["ethiqueEvery", "Éthique : toutes les", "sem", { min: 1 }],
    ["ethiqueAnchor", "Éthique : premier dimanche", "date"]
  ]]
];

function saveNumber(key, raw, opt = {}) {
  if (raw === "") return saveSettings({ [key]: "" }); // champ vidé → valeur par défaut
  let v = +raw;
  if (!Number.isFinite(v)) return;
  v = Math.max(opt.min ?? 0, v);
  if (opt.max !== undefined) v = Math.min(opt.max, v);
  saveSettings({ [key]: v });
  toast("Réglage enregistré");
}

function field([key, label, type, opt = {}], st) {
  const id = "set-" + key, v = st[key];
  let input;
  if (type === "time" || type === "date") {
    input = html`<input type=${type} id=${id} .value=${live(v || "")} @change=${(e) => { saveSettings({ [key]: e.target.value }); toast("Réglage enregistré"); }}>`;
  } else if (type === "bool") {
    input = html`<button class="sw" role="switch" id=${id} aria-checked=${v ? "true" : "false"} aria-label=${label} @click=${() => saveSettings({ [key]: !v })}></button>`;
  } else if (type === "sel") {
    // ?selected pour le premier affichage, .value pour les mises à jour (ex. retour aux réglages de base)
    input = html`<select id=${id} .value=${live(String(+v))} @change=${(e) => { saveSettings({ [key]: +e.target.value }); toast("Réglage enregistré"); }}>
      ${opt.choices.map(([val, name]) => html`<option value=${val} ?selected=${+v === val}>${name}</option>`)}</select>`;
  } else {
    input = html`<input type="number" id=${id} inputmode="decimal" min=${opt.min ?? 0} max=${opt.max ?? nothing} step=${type === "h" ? "0.5" : type === "sem" ? "1" : "5"}
      .value=${live(String(v))} @change=${(e) => saveNumber(key, e.target.value, opt)}><span class="u">${type === "sem" ? "sem." : type}</span>`;
  }
  return html`<div class="fr"><label for=${id}>${label}</label><div class="in">${input}</div></div>`;
}

// ---------- sauvegarde ----------
const backupText = () => JSON.stringify(exportData());

async function copyBackup() {
  try {
    await navigator.clipboard.writeText(backupText());
    toast("Sauvegarde copiée : colle-la sur ton autre appareil");
  } catch {
    const ta = document.getElementById("backup-in");
    ta.value = backupText();
    ta.select();
    toast("Sélectionne le texte et copie-le");
  }
}

function downloadBackup() {
  const blob = new Blob([backupText()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "horaire-9h-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function doImport(text) {
  if (!text.trim()) return toast("Colle d'abord une sauvegarde");
  if (!confirm("Remplacer tes réglages et tes journées par cette sauvegarde ?")) return;
  try {
    const n = importData(text);
    toast("Sauvegarde restaurée (" + n + " jour" + (n > 1 ? "s" : "") + ")");
    document.getElementById("backup-in").value = "";
  } catch (err) {
    toast(err.message);
  }
}

async function importFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (file) doImport(await file.text());
}

export function settingsView() {
  const st = S();
  const themes = [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]];
  return html`
    <section class="settings">
      <h1>Réglages</h1>
      ${FORM.map(([legend, fields]) => html`<fieldset><legend>${legend}</legend>${fields.map((f) => field(f, st))}</fieldset>`)}

      <fieldset>
        <legend>Apparence</legend>
        <div class="fr"><span id="theme-lbl">Thème</span>
          <div class="seg" role="radiogroup" aria-labelledby="theme-lbl">
            ${themes.map(([k, n]) => html`<button role="radio" aria-checked=${state.theme === k ? "true" : "false"} @click=${() => setTheme(k)}>${n}</button>`)}
          </div>
        </div>
      </fieldset>

      <fieldset class="backup">
        <legend>Sauvegarde & autres appareils</legend>
        <p class="sub">${state.sync === "cloud"
          ? "Tes réglages et tes journées se synchronisent automatiquement avec ton compte Claude."
          : "Tout est enregistré sur cet appareil. Pour retrouver tes réglages et tes cases cochées sur ton iPhone, ta tablette ou ton PC : copie la sauvegarde ici, puis colle-la dans l'app de l'autre appareil."}</p>
        <div class="btnrow">
          <button class="btn" @click=${copyBackup}>${icons.copy()} Copier la sauvegarde</button>
          ${platform.canDownload ? html`<button class="btn" @click=${downloadBackup}>${icons.download()} Télécharger le fichier</button>` : nothing}
          <label class="btn">${icons.upload()} Ouvrir un fichier<input type="file" accept="application/json,.json" hidden @change=${importFile}></label>
        </div>
        <textarea id="backup-in" rows="3" placeholder="Colle ici une sauvegarde copiée depuis un autre appareil…" spellcheck="false"></textarea>
        <div class="btnrow"><button class="btn primary" @click=${() => doImport(document.getElementById("backup-in").value)}>Restaurer cette sauvegarde</button></div>
      </fieldset>

      <div class="setfoot">
        <button class="btn" @click=${() => { resetSettings(); toast("Réglages de base rétablis"); }}>Revenir aux réglages de base</button>
        <span class="sub">${state.sync === "cloud" ? "Enregistré et synchronisé sur tes appareils." : "Enregistré sur cet appareil."} · v${__APP_VERSION__} · ${platform.label}</span>
      </div>
    </section>`;
}
