// État de l'application + sauvegarde.
// - Toujours : localStorage (clé compatible avec la v1).
// - Dans un artefact Claude : synchronisation entre appareils via la base `db` (comme la v1).
import { H, DEFAULTS, withDefaults, todayStr } from "./engine/index.js";

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
let storageWarned = false;
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage plein ou bloqué : l'app continue en mémoire (on prévient une fois)
    if (!storageWarned) {
      storageWarned = true;
      setTimeout(() => toast("Stockage de l'appareil indisponible : pense à copier ta sauvegarde"), 0);
    }
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

/** Anciennes versions : l'interrupteur « bibliothèque en semaine » (weekdayLib) est devenu le lieu du lundi au vendredi. */
function migrate(s) {
  if (!s || typeof s !== "object" || s.weekdayLib === undefined) return s || {};
  const o = { ...s };
  if (o.weekdayLib === false && !o.weekdayPlace) o.weekdayPlace = "maison";
  delete o.weekdayLib;
  return o;
}

(function load() {
  const o = readJSON(LS_KEY);
  if (o) {
    state.settings = migrate(o.settings);
    state.days = o.days || {};
  }
  const ui = readJSON(UI_KEY);
  if (ui && ["auto", "light", "dark"].includes(ui.theme)) state.theme = ui.theme;
  state.date = firstDay();
  state.view = viewFromHash();
})();

export const S = () => withDefaults(state.settings);
export const getDay = (ds) => state.days[ds] || null;

// app web ouverte dans deux onglets : chacun reprend ce que l'autre enregistre (sinon le dernier écrase tout)
window.addEventListener?.("storage", (e) => {
  if (e.key !== LS_KEY || !e.newValue) return;
  try {
    const o = JSON.parse(e.newValue);
    state.settings = migrate(o.settings);
    state.days = o.days || {};
    rev++;
    notify();
  } catch { /* contenu illisible : on garde l'état courant */ }
});

// ---------- synchronisation (artefact Claude uniquement) ----------
let db = null;
const writeQ = {};
// réglages modifiés avant la connexion à la base : ils priment sur ceux de la base à la connexion
const dirtyKeys = new Set();

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

/** Écoute un document / une collection ; relance l'écoute après une erreur (réseau coupé…). */
function listen(ref, onData) {
  let tries = 0;
  const start = () => ref.onSnapshot((x) => { tries = 0; onData(x); }, () => {
    setSync("error");
    if (tries++ < 20) setTimeout(start, Math.min(60000, 2000 * tries));
  });
  start();
}

export function connectSync() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") return;
  setSync("connecting");
  c.use("db")
    .then((d) => {
      if (!d) return setSync("local");
      db = d;
      listen(db.doc("app/settings"), (snap) => {
        const s = snap.exists ? migrate({ ...snap.data() }) : {};
        if (snap.exists || dirtyKeys.size) {
          // ce qui a été changé ici avant la connexion l'emporte, puis part dans la base
          for (const k of dirtyKeys) {
            if (k in state.settings) s[k] = state.settings[k];
            else delete s[k];
          }
          state.settings = s;
          cache();
          notify();
        }
        // (base encore vide : les réglages de cet appareil deviennent ceux du compte)
        if ((dirtyKeys.size || (!snap.exists && Object.keys(state.settings).length)) && !snap.metadata?.fromCache) {
          dirtyKeys.clear();
          writeDoc("app/settings", state.settings);
        }
        setSync("cloud");
      });
      listen(db.collection("days"), (qs) => {
        const days = {}, fresh = !qs.metadata?.fromCache;
        qs.docs.forEach((doc) => { days[doc.id] = { ...doc.data() }; });
        // jour par jour, la version la plus récente gagne : un jour modifié ici (hors ligne, pendant
        // la connexion, ou en cours d'envoi) n'est pas écrasé par une version plus ancienne de la base
        for (const [k, loc] of Object.entries(state.days)) {
          const cl = days[k];
          if (!loc || (cl && (cl.updated || "") >= (loc.updated || ""))) continue;
          days[k] = loc;
          if (fresh) writeDoc("days/" + k, loc);
        }
        state.days = days;
        cache();
        notify();
        setSync("cloud");
      });
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

// Réglages qui peuvent rester vides (les autres reviennent à leur valeur par défaut)
const OPTIONAL = new Set(["concoursStart", "endAt"]);

export function saveSettings(patch) {
  const s = { ...state.settings };
  for (const [k, v] of Object.entries(patch)) {
    if ((v === "" && !OPTIONAL.has(k)) || (typeof v === "number" && !Number.isFinite(v))) delete s[k];
    else s[k] = v;
  }
  state.settings = s;
  if (!db) for (const k of Object.keys(patch)) dirtyKeys.add(k);
  cache();
  notify();
  writeDoc("app/settings", s);
}

/** Réglages de base, en gardant les objectifs de la semaine (qui ne sont pas des « réglages »). */
export function resetSettings() {
  const keep = state.settings.goals ? { goals: state.settings.goals } : {};
  if (!db) for (const k of Object.keys(state.settings)) if (k !== "goals") dirtyKeys.add(k);
  state.settings = keep;
  cache();
  notify();
  writeDoc("app/settings", keep);
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

/** Lit une sauvegarde (texte JSON) sans rien modifier. Lève une erreur lisible si le contenu est invalide. */
export function parseBackup(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error("Ce n'est pas une sauvegarde valide (JSON illisible).");
  }
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(o) || (o.app && o.app !== EXPORT_APP) || !isObj(o.settings || {}) || !isObj(o.days || {}) || (!o.settings && !o.days)) {
    throw new Error("Ce texte n'est pas une sauvegarde d'Horaire 9h.");
  }
  // réglages : même type que la valeur par défaut, sinon ignorés (une valeur fausse bloquerait le planning)
  const TIME = /^\d{2}:\d{2}$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
  const sameShape = (v, def) => typeof v === typeof def && (typeof v !== "number" || Number.isFinite(v))
    && (typeof def !== "string" || ((!TIME.test(def) || TIME.test(v)) && (!DATE.test(def) || DATE.test(v))));
  const settings = {};
  for (const [k, v] of Object.entries(migrate(o.settings || {}))) {
    const def = DEFAULTS[k];
    if (def === undefined || v === null) continue;
    if (v === "" ? OPTIONAL.has(k) : k === "goals" ? isObj(v) : sameShape(v, def)) settings[k] = v;
  }
  // journées : heures au format HH:MM, le reste tel quel s'il a la bonne forme
  const days = {};
  for (const [k, v] of Object.entries(o.days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(v)) continue;
    const d = { ...v };
    for (const f of ["wake", "start", "end"]) if (d[f] !== undefined && !(typeof d[f] === "string" && TIME.test(d[f]))) delete d[f];
    for (const f of ["done", "ov", "replan"]) if (d[f] !== undefined && !isObj(d[f])) delete d[f];
    days[k] = d;
  }
  return { settings, days };
}

/** Remplace réglages et journées par ceux d'une sauvegarde lue avec parseBackup. */
export function importData({ settings, days }) {
  state.settings = settings;
  state.days = days;
  cache();
  notify();
  writeDoc("app/settings", settings);
  for (const [k, v] of Object.entries(days)) writeDoc("days/" + k, v);
}
