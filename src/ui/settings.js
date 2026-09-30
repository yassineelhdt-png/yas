// Vue « Réglages » : paramètres du planning, apparence, sauvegarde.
import { html, nothing, noChange } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { state, S, notify, saveSettings, resetSettings, setTheme, toast, exportData, parseBackup, importData } from "../store.js";
import { platform } from "../platform.js";
import { icons } from "./icons.js";
import * as E from "../engine/index.js";
import { goalName } from "./goals.js";
import { MOISC } from "./format.js";

// [clé, libellé, type, options] — type : time | date | bool | sel | min | h | sem
// options.min / options.max bornent les nombres
const FORM = [
  ["Journée", [
    ["wake", "Réveil habituel (si tu ne saisis rien)", "time"],
    ["prep", "Préparation après le lever", "min"],
    ["targetH", "Objectif net par jour", "h", { min: 1, max: 14 }],
    ["endAt", "Heure de fin du programme (vide = dès que l'objectif est atteint)", "time"],
    ["sleepH", "Sommeil visé", "h", { min: 4, max: 12 }]
  ]],
  ["Rythme", [
    ["session", "Session de concentration max", "min", { min: 30, max: 180 }],
    ["minSession", "Session minimale (jamais moins)", "min", { min: 30, max: 90 }],
    ["pause", "Micro-pause", "min"],
    ["bigPause", "Grande pause", "min"],
    ["lunch", "Déjeuner", "min"],
    ["dinner", "Dîner", "min"],
    ["sport", "Sport", "min"],
    ["shower", "Douche après le sport", "min"]
  ]],
  ["Lieux", [
    ["weekdayPlace", "Lieu du lundi au vendredi (hors congés)", "sel", { str: true, choices: [["maison", "Maison"], ["erasme", "Erasme"], ["p4p", "Play4Peace"], ["uz", "UZ"]] }],
    ["homeTail", "Fin de journée à la maison : étude gardée pour la maison (0 = rester sur place)", "min", { min: 0, max: 240 }],
    ["travel", "Erasme : trajet (aussi pour les séances)", "min"],
    ["erasmeOpen", "Erasme : ouverture", "time"],
    ["erasmeClose", "Erasme : fermeture", "time"],
    ["p4pTravel", "Play4Peace : trajet", "min"],
    ["p4pOpen", "Play4Peace : ouverture", "time"],
    ["p4pClose", "Play4Peace : fermeture", "time"],
    ["uzTravel", "UZ : trajet", "min"],
    ["uzOpen", "UZ : ouverture", "time"],
    ["uzClose", "UZ : fermeture", "time"]
  ]],
  ["Unif · Erasme", [
    ["guidChimDay", "Guidance chimie : jour", "sel", { choices: [[2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"]] }],
    ["guidChimDur", "Guidance chimie : durée", "min", { min: 15 }],
    ["permPhysDay", "Permanence physique : jour", "sel", { choices: [[1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"], [5, "Vendredi"]] }],
    ["permPhysStart", "Permanence physique : arrivée", "time"],
    ["permPhysDur", "Permanence physique : durée", "min", { min: 15 }],
    ["appuiMath", "Appui maths du mardi", "bool"],
    ["appuiBio", "Appui bio du vendredi (guidances QCM à thèmes)", "bool"],
    ["tutoBio", "Tutorat de bio du mercredi (12:00–13:50)", "bool"]
  ]],
  // cours théoriques : par matière (attendTh), repli sur l'ancien choix général attendTheory
  ["Cours théoriques (par défaut)", [
    ["CHIM", "Chimie", "th"], ["PHYS", "Physique", "th"], ["MATH", "Maths", "th"],
    ["BIO", "Bio", "th"], ["BIO2", "Bio · diversité du vivant", "th"], ["MEDIG", "MEDIG (IA, ERSB, durabilité)", "th"]
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
    ["ethiqueEvery", "Éthique : toutes les", "sem", { min: 1, max: 12, int: true }],
    ["ethiqueAnchor", "Éthique : premier dimanche", "date"]
  ]]
];

// Champ en cours de saisie : un nouveau rendu (message qui s'efface, synchro) ne remplace pas ce qui est tapé
const keep = (id, v) => (document.activeElement?.id === id ? noChange : live(v));

function saveNumber(key, raw, opt = {}) {
  if (raw === "") { // champ vidé → valeur par défaut
    saveSettings({ [key]: "" });
    return toast("Valeur par défaut rétablie");
  }
  const x = +String(raw).replace(",", ".");
  if (!Number.isFinite(x)) return toast("Nombre non reconnu : réglage inchangé");
  let v = Math.max(opt.min ?? 0, x);
  if (opt.max !== undefined) v = Math.min(opt.max, v);
  if (opt.int) v = Math.round(v);
  saveSettings({ [key]: v });
  toast(v !== x ? "Ramené à " + v + " (valeur possible)" : "Réglage enregistré");
}

function field([key, label, type, opt = {}], st) {
  const id = "set-" + key, v = st[key];
  let input;
  if (type === "time" || type === "date") {
    input = html`<input type=${type} id=${id} .value=${keep(id, v || "")} @change=${(e) => { saveSettings({ [key]: e.target.value }); toast("Réglage enregistré"); }}>`;
  } else if (type === "th") {
    // cours théoriques d'une matière : j'y vais par défaut ? (chaque cours reste modifiable dans le planning)
    const th = st.attendTh || {}, on = typeof th[key] === "boolean" ? th[key] : !!st.attendTheory;
    input = html`<button class="sw" role="switch" id=${id} aria-checked=${on ? "true" : "false"} aria-label=${"Cours de " + label.toLowerCase()} @click=${() => { saveSettings({ attendTh: { ...th, [key]: !on } }); toast(on ? "Cours de " + label.toLowerCase() + " : rattrapés à la maison" : "Cours de " + label.toLowerCase() + " : tu y vas"); }}></button>`;
  } else if (type === "bool") {
    input = html`<button class="sw" role="switch" id=${id} aria-checked=${v ? "true" : "false"} aria-label=${label} @click=${() => saveSettings({ [key]: !v })}></button>`;
  } else if (type === "sel") {
    // ?selected pour le premier affichage, .value pour les mises à jour (ex. retour aux réglages de base)
    // opt.str : valeurs texte (ex. lieu), sinon nombres (ex. jour de la semaine)
    const cast = (x) => (opt.str ? String(x) : +x);
    input = html`<select id=${id} .value=${live(String(cast(v)))} @change=${(e) => { saveSettings({ [key]: cast(e.target.value) }); toast("Réglage enregistré"); }}>
      ${opt.choices.map(([val, name]) => html`<option value=${val} ?selected=${cast(v) === val}>${name}</option>`)}</select>`;
  } else {
    input = html`<input type="number" id=${id} inputmode="decimal" min=${opt.min ?? 0} max=${opt.max ?? nothing} step=${type === "h" ? "0.5" : type === "sem" ? "1" : "5"}
      .value=${keep(id, String(v))} @change=${(e) => saveNumber(key, e.target.value, opt)}><span class="u">${type === "sem" ? "sem." : type}</span>`;
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
  a.download = "horaire-9h-sauvegarde-" + E.todayStr() + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Sauvegarde lue et en attente de confirmation (confirm() n'existe pas partout, ex. dans un artefact Claude)
let pending = null;

function prepareImport(text) {
  if (!text.trim()) return toast("Colle d'abord une sauvegarde");
  try {
    pending = parseBackup(text);
    notify();
  } catch (err) {
    toast(err.message);
  }
}

function confirmImport() {
  importData(pending);
  const n = Object.keys(pending.days).length;
  pending = null;
  document.getElementById("backup-in").value = "";
  toast("Sauvegarde restaurée (" + n + " jour" + (n > 1 ? "s" : "") + ")");
}

function cancelImport() {
  pending = null;
  notify();
}

async function importFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (file) prepareImport(await file.text());
}

function importControls() {
  if (!pending) {
    return html`<div class="btnrow"><button class="btn" @click=${() => prepareImport(document.getElementById("backup-in").value)}>Restaurer cette sauvegarde</button></div>`;
  }
  const n = Object.keys(pending.days).length;
  return html`
    <div class="confirmbox" role="alert">
      <span>Tes réglages et tes journées actuels seront remplacés par ceux de la sauvegarde (${n} jour${n > 1 ? "s" : ""}).</span>
      <div class="btnrow"><button class="btn primary" @click=${confirmImport}>Remplacer mes données</button><button class="btn ghost" @click=${cancelImport}>Annuler</button></div>
    </div>`;
}

let confirmReset = false;

// ---------- objectifs de la semaine ----------
let goalWeek = "base"; // « base » = objectifs habituels, sinon le lundi de la semaine modifiée

/** Ouvre l'éditeur d'objectifs sur une semaine (depuis les vues Jour / Semaine). */
export function openGoals(mon) {
  goalWeek = mon;
}

function weekName(mon) {
  const a = E.pd(mon), b = E.pd(E.addDays(mon, 6)), wn = E.weekNo(mon);
  return (wn >= 1 && wn <= 20 ? "S" + wn + " · " : "") + a.getDate() + " " + MOISC[a.getMonth()] + " → " + b.getDate() + " " + MOISC[b.getMonth()];
}

function weekOptions() {
  const out = [];
  for (let mon = E.addDays(E.H.semesterStart, 7), i = 0; i < 16; mon = E.addDays(mon, 7), i++) out.push([mon, weekName(mon)]);
  // semaine ouverte depuis les vues Jour / Semaine, hors de la liste (ex. après le quadrimestre)
  if (goalWeek !== "base" && !out.some(([m]) => m === goalWeek)) out.push([goalWeek, weekName(goalWeek)]);
  return out;
}

function goalsState(st) {
  const g = st.goals || {};
  return { base: Array.isArray(g.base) ? g.base : [], weeks: g.weeks && typeof g.weeks === "object" ? g.weeks : {} };
}

function saveGoals(G, msg) {
  saveSettings({ goals: G });
  if (msg) toast(msg);
}

function editList(fn, msg) {
  // réglages actuels, pas ceux du dernier rendu (au toucher, change puis click arrivent avant le rendu suivant)
  const G = goalsState(S());
  const list = goalWeek === "base" ? G.base : G.weeks[goalWeek] || [];
  const next = fn(list.map((g) => ({ ...g })));
  saveGoals(goalWeek === "base" ? { ...G, base: next } : { ...G, weeks: { ...G.weeks, [goalWeek]: next } }, msg);
}

function goalRow(g, i, st) {
  const set = (patch, msg) => editList((l) => { l[i] = { ...l[i], ...patch }; return l; }, msg);
  const id = (f) => "goal-" + i + "-" + f;
  const kinds = Object.entries(E.GOAL_KINDS);
  return html`
    <div class="goalrow" style="--c:var(${"--c-" + (g.subj || "rev").toLowerCase()})">
      <div class="gr1">
        <select aria-label="Type d'objectif" .value=${live(g.kind)} @change=${(e) => set({ kind: e.target.value, hours: E.GOAL_KINDS[e.target.value].hours })}>
          ${kinds.map(([k, v]) => html`<option value=${k} ?selected=${g.kind === k}>${v.name}</option>`)}
        </select>
        <select aria-label="Matière" .value=${live(g.subj)} @change=${(e) => set({ subj: e.target.value })}>
          ${E.GOAL_SUBJECTS.map((k) => html`<option value=${k} ?selected=${g.subj === k}>${E.SUBJ[k]}</option>`)}
        </select>
        <button class="linkbtn danger" @click=${() => editList((l) => l.filter((_, j) => j !== i), "Objectif retiré")}>Retirer</button>
      </div>
      <div class="gr2">
        <label>Nombre <input type="number" id=${id("count")} min="1" max="20" step="1" inputmode="numeric" .value=${keep(id("count"), String(g.count ?? 1))} @change=${(e) => set({ count: Math.min(20, Math.max(1, Math.round(+e.target.value || 1))) })}></label>
        <label>× <input type="number" id=${id("hours")} min="0.5" max="20" step="0.5" inputmode="decimal" .value=${keep(id("hours"), String(g.hours ?? 1))} @change=${(e) => set({ hours: Math.min(20, Math.max(0.5, Math.round((+String(e.target.value).replace(",", ".") || 1) * 2) / 2)) })}> h</label>
        <input type="text" id=${id("label")} class="glabel" placeholder="Précision (chapitre, année…)" .value=${keep(id("label"), g.label || "")} @change=${(e) => set({ label: e.target.value.trim() })}>
      </div>
      <small>${goalName(g)}</small>
    </div>`;
}

function goalsFieldset(st) {
  const G = goalsState(st);
  const isBase = goalWeek === "base";
  const own = !isBase && Array.isArray(G.weeks[goalWeek]);
  const list = isBase ? G.base : own ? G.weeks[goalWeek] : G.base;
  const total = list.reduce((a, g) => a + Math.max(1, Math.round(+g.count || 1)) * (+g.hours || 0), 0);
  const editable = isBase || own;
  return html`
    <fieldset class="goals" id="goals">
      <legend>Objectifs de la semaine</legend>
      <p class="sub">Annales, théorie à rattraper, exercices… L'app les place en blocs de 2h d'un seul tenant (une annale de 4h = 2 × 2h), au plus deux par jour, sur ton temps d'étude libre (jamais pendant les séances, la guidance ou la permanence).</p>
      <div class="fr"><label for="goal-week">Semaine</label>
        <div class="in"><select id="goal-week" .value=${live(goalWeek)} @change=${(e) => { goalWeek = e.target.value; notify(); }}>
          <option value="base" ?selected=${isBase}>Chaque semaine (habituels)</option>
          ${weekOptions().map(([mon, name]) => html`<option value=${mon} ?selected=${goalWeek === mon}>${name}${Array.isArray(G.weeks[mon]) ? " · perso" : ""}</option>`)}
        </select></div>
      </div>
      ${!isBase && !own ? html`
        <p class="sub">Cette semaine suit tes objectifs habituels (ci-dessous).</p>
        <div class="btnrow"><button class="btn" @click=${() => saveGoals({ ...G, weeks: { ...G.weeks, [goalWeek]: G.base.map((g) => ({ ...g })) } }, "Semaine personnalisée")}>Personnaliser cette semaine</button></div>` : nothing}
      ${own ? html`<div class="btnrow"><button class="btn ghost" @click=${() => { const w = { ...G.weeks }; delete w[goalWeek]; saveGoals({ ...G, weeks: w }, "Objectifs habituels rétablis"); }}>Revenir aux objectifs habituels</button></div>` : nothing}
      <div class="goallist ${editable ? "" : "readonly"}">
        ${list.length ? list.map((g, i) => (editable ? goalRow(g, i, st) : html`<div class="goalrow ro"><small>${goalName(g)}</small></div>`)) : html`<p class="sub">Aucun objectif.</p>`}
      </div>
      ${editable ? html`<div class="btnrow"><button class="btn primary" @click=${() => editList((l) => [...l, { id: "g" + Date.now().toString(36), kind: "annale", subj: "CHIM", count: 1, hours: 4, label: "" }], "Objectif ajouté")}>Ajouter un objectif</button></div>` : nothing}
      <p class="sub">Total : ${E.dur(Math.round(total * 60))} par semaine.</p>
    </fieldset>`;
}

export function settingsView() {
  const st = S();
  const themes = [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]];
  return html`
    <section class="settings">
      <h1>Réglages</h1>
      ${goalsFieldset(st)}
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
          <button class="btn" @click=${() => document.getElementById("backup-file").click()}>${icons.upload()} Ouvrir un fichier</button>
          <input type="file" id="backup-file" accept="application/json,.json" hidden @change=${importFile}>
        </div>
        <textarea id="backup-in" rows="3" placeholder="Colle ici une sauvegarde copiée depuis un autre appareil…" spellcheck="false"></textarea>
        ${importControls()}
      </fieldset>

      <div class="setfoot">
        ${confirmReset
          ? html`<div class="confirmbox" role="alert"><span>Tous tes réglages reviennent aux valeurs de base (tes objectifs et tes journées sont gardés).</span>
              <div class="btnrow"><button class="btn primary" @click=${() => { confirmReset = false; resetSettings(); toast("Réglages de base rétablis"); }}>Rétablir les réglages de base</button><button class="btn ghost" @click=${() => { confirmReset = false; notify(); }}>Annuler</button></div></div>`
          : html`<button class="btn" @click=${() => { confirmReset = true; notify(); }}>Revenir aux réglages de base</button>`}
        <span class="sub">${state.sync === "cloud" ? "Enregistré et synchronisé sur tes appareils" : "Enregistré sur cet appareil"} · v${__APP_VERSION__} · ${platform.label}</span>
      </div>
    </section>`;
}
