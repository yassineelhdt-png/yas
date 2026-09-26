// État de l'application + sauvegarde.
// - Toujours : localStorage (clé compatible avec la v1).
// - Dans un artefact Claude : synchronisation entre appareils via la base `db` (comme la v1).
import { H, withDefaults, todayStr } from "./engine/index.js";

const LS_KEY = "horaire9h.v1";
const UI_KEY = "horaire9h.ui"; // préférences propres à l'appareil (thème)
const VIEWS = ["jour", "semaine", "reglages", "methode"];
const EXPORT_APP = "horaire-9h";

export const state = {
  settings: {},
  days: {},
  view: "jour",
  date: null,
  sync: "local", // local | connecting | cloud | error
  replanOpen: false,
  theme: "auto", // auto | light | dark
  toast: null
};

// ---------- abonnements ----------
const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);
export const notify = () => listeners.forEach((fn) => fn());

// ---------- lecture / écriture locales ----------
function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou bloqué : l'app continue en mémoire */
  }
}
// `rev` change à chaque modification des données : sert à ne recalculer le planning que si besoin
let rev = 0;
export const dataRev = () => rev;
function cache() {
  rev++;
  writeJSON(LS_KEY, { settings: state.settings, days: state.days, view: state.view });
}

export const viewFromHash = () => {
  const h = (location.hash || "").replace("#", "");
  return VIEWS.includes(h) ? h : "jour";
};
export const firstDay = () => {
  const t = todayStr();
  return t < H.firstDay ? H.firstDay : t;
};

(function load() {
  const o = readJSON(LS_KEY);
  if (o) {
    state.settings = o.settings || {};
    state.days = o.days || {};
  }
  const ui = readJSON(UI_KEY);
  if (ui && ["auto", "light", "dark"].includes(ui.theme)) state.theme = ui.theme;
  state.date = firstDay();
  state.view = viewFromHash();
})();

export const S = () => withDefaults(state.settings);
export const getDay = (ds) => state.days[ds] || null;

// ---------- synchronisation (artefact Claude uniquement) ----------
let db = null;
const writeQ = {};

function setSync(s) {
  state.sync = s;
  notify();
}
function writeDoc(path, data) {
  if (!db) return;
  const prev = writeQ[path] || Promise.resolve();
  writeQ[path] = prev
    .then(() => db.doc(path).set(data))
    .then(() => { if (state.sync !== "cloud") setSync("cloud"); })
    .catch((e) => {
      if (e && e.code === "unavailable") {
        return new Promise((r) => setTimeout(r, 800 + Math.random() * 800))
          .then(() => db.doc(path).set(data))
          .catch(() => setSync("error"));
      }
      setSync("error");
    });
}

export function connectSync() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") return;
  setSync("connecting");
  c.use("db")
    .then((d) => {
      if (!d) return setSync("local");
      db = d;
      db.doc("app/settings").onSnapshot((snap) => {
        if (snap.exists) { state.settings = { ...snap.data() }; cache(); }
        setSync("cloud");
      }, () => setSync("error"));
      db.collection("days").onSnapshot((qs) => {
        const days = {};
        qs.docs.forEach((doc) => { days[doc.id] = { ...doc.data() }; });
        // garder les jours locaux pas encore arrivés dans la base
        for (const k of Object.keys(state.days)) if (!days[k] && state.days[k] && !qs.metadata.fromCache) days[k] = state.days[k];
        state.days = days;
        cache();
        setSync("cloud");
      }, () => setSync("error"));
    })
    .catch(() => setSync("local"));
}

// ---------- modifications ----------
export function saveDay(ds, patch) {
  const d = { ...state.days[ds], ...patch, updated: new Date().toISOString() };
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  state.days[ds] = d;
  cache();
  notify();
  writeDoc("days/" + ds, d);
}

// Réglages qui ne peuvent pas être vides (sinon le planning ne peut pas être calculé)
const OPTIONAL = new Set(["concoursStart"]);

export function saveSettings(patch) {
  const s = { ...state.settings };
  for (const [k, v] of Object.entries(patch)) {
    if ((v === "" && !OPTIONAL.has(k)) || (typeof v === "number" && !Number.isFinite(v))) delete s[k];
    else s[k] = v;
  }
  state.settings = s;
  cache();
  notify();
  writeDoc("app/settings", s);
}

export function resetSettings() {
  state.settings = {};
  cache();
  notify();
  writeDoc("app/settings", {});
}

export function setTheme(theme) {
  state.theme = theme;
  writeJSON(UI_KEY, { theme });
  notify();
}

let toastTimer = null;
export function toast(msg) {
  state.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = null; notify(); }, 2400);
  notify();
}

// ---------- sauvegarde / restauration ----------
export function exportData() {
  return { app: EXPORT_APP, version: 1, exportedAt: new Date().toISOString(), settings: state.settings, days: state.days };
}

/** Remplace réglages et journées par ceux d'une sauvegarde. Lève une erreur si le contenu est invalide. */
export function importData(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error("Ce n'est pas une sauvegarde valide (JSON illisible).");
  }
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(o) || (o.app && o.app !== EXPORT_APP) || !isObj(o.settings || {}) || !isObj(o.days || {})) {
    throw new Error("Ce fichier n'est pas une sauvegarde d'Horaire 9h.");
  }
  const days = {};
  for (const [k, v] of Object.entries(o.days || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(v)) days[k] = v;
  state.settings = o.settings || {};
  state.days = days;
  cache();
  notify();
  writeDoc("app/settings", state.settings);
  for (const [k, v] of Object.entries(days)) writeDoc("days/" + k, v);
  return Object.keys(days).length;
}
