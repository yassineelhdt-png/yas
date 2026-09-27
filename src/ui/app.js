// Coquille de l'app : barre du haut, navigation (onglets / barre du bas), rendu, raccourcis, gestes.
import { html, render } from "lit-html";
import * as E from "../engine/index.js";
import { state, subscribe, notify, getDay, dataRev, firstDay, viewFromHash } from "../store.js";
import { dayView } from "./day.js";
import { weekView } from "./week.js";
import { settingsView } from "./settings.js";
import { methodView } from "./method.js";
import { openGoals } from "./settings.js";
import { icons } from "./icons.js";
import { platform } from "../platform.js";

const TABS = [
  ["jour", "Jour", icons.day],
  ["semaine", "Semaine", icons.week],
  ["reglages", "Réglages", icons.settings],
  ["methode", "Méthode", icons.method]
];
const SYNC_TXT = { cloud: "Synchronisé", error: "Synchro en pause", connecting: "Connexion…", local: "Sur cet appareil" };
const THEME_COLOR = { light: "#EDF0F3", dark: "#0D1218" };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

let root;
// module Android chargé uniquement dans l'APK
const native = platform.native ? import("../native.js") : null;

// ---------- planning (recalculé seulement si les données ou la date changent) ----------
const memo = { day: {}, week: {} };
function plan(kind, ds) {
  const key = ds + "|" + dataRev(), slot = memo[kind];
  if (slot.key !== key) {
    slot.key = key;
    slot.value = kind === "day" ? E.planDay(ds, state.settings, getDay) : E.planWeek(ds, state.settings, getDay);
  }
  return slot.value;
}

// ---------- transitions ----------
// L'état change tout de suite (appuis rapides sur ← → fiables) ; seule l'animation est asynchrone.
let vtToken = 0;
function withTransition(kind, mutate) {
  mutate();
  if (!document.startViewTransition || reduceMotion.matches) return renderNow();
  const token = ++vtToken;
  document.documentElement.dataset.vt = kind;
  document.startViewTransition(renderNow).finished.finally(() => {
    if (token === vtToken) delete document.documentElement.dataset.vt;
  });
}

// ---------- navigation ----------
function applyView(view) {
  if (view === state.view) return;
  withTransition("fade", () => { state.view = view; state.replanOpen = false; });
  window.scrollTo(0, 0);
}

// certains cadres (artefact Claude) refusent de modifier l'historique : l'onglet change quand même
function safeHistory(method, data, url) {
  try {
    history[method](data, "", url);
  } catch {
    /* pas d'historique : le bouton retour ne changera pas d'onglet */
  }
}

/** Onglets : un seul niveau d'historique (Jour ← autre onglet), pour que « retour » ramène au Jour. */
function goView(view) {
  if (view === state.view) return window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
  if (view === "jour") {
    if (history.state?.tab) return history.back(); // popstate s'occupe du reste
    safeHistory("replaceState", null, location.pathname + location.search);
  } else if (state.view === "jour") safeHistory("pushState", { tab: true }, "#" + view);
  else safeHistory("replaceState", { tab: true }, "#" + view);
  applyView(view);
}

function setDate(ds, dir) {
  if (ds === state.date) return;
  withTransition(dir > 0 ? "next" : "prev", () => { state.date = ds; state.replanOpen = false; });
}

const nav = {
  /** ±n jours ; 0 = aujourd'hui */
  go(delta) {
    if (delta === 0) {
      const t = firstDay();
      return setDate(t, t > state.date ? 1 : -1);
    }
    setDate(E.addDays(state.date, delta), delta);
  },
  openDay(ds) {
    state.date = ds;
    goView("jour");
  },
  setReplanOpen(open) {
    state.replanOpen = open;
    notify();
  },
  /** Réglages, section objectifs, sur la semaine affichée */
  editGoals() {
    openGoals(E.monday(state.date));
    goView("reglages");
    requestAnimationFrame(() => document.getElementById("goals")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
};

// ---------- rendu ----------
function currentView() {
  switch (state.view) {
    case "semaine": return weekView(plan("week", state.date), nav);
    case "reglages": return settingsView();
    case "methode": return methodView();
    default: return dayView(plan("day", state.date), nav, plan("week", state.date));
  }
}

const tabButtons = (cls) => TABS.map(([v, label, icon]) => html`
  <button class=${cls} role="tab" aria-selected=${state.view === v ? "true" : "false"} @click=${() => goView(v)}>
    ${icon()}<span>${label}</span>
  </button>`);

function shell() {
  return html`
    <header class="top">
      <div class="top-in">
        <div class="brand">Horaire 9h <b>B1-BIME · Q1</b></div>
        <nav class="tabs" role="tablist" aria-label="Vues">${tabButtons("tab")}</nav>
        <div class="sync" data-s=${state.sync} title=${SYNC_TXT[state.sync]}><i></i><span>${SYNC_TXT[state.sync]}</span></div>
      </div>
    </header>
    <main id="main" class="wrap view-${state.view}">${currentView()}</main>
    <nav class="bottomnav" role="tablist" aria-label="Vues">${tabButtons("btab")}</nav>
    <div class="toast ${state.toast ? "show" : ""}" role="status" aria-live="polite">${state.toast || ""}</div>`;
}

// En « auto », on ne touche pas à data-theme : dans un artefact Claude, c'est le thème choisi dans Claude.
let ownTheme = false;
function applyTheme() {
  const root = document.documentElement;
  if (state.theme !== "auto") {
    root.dataset.theme = state.theme;
    ownTheme = true;
  } else if (ownTheme) {
    delete root.dataset.theme;
    ownTheme = false;
  }
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : darkScheme.matches;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
  native?.then((n) => n.setBarsDark(dark));
}

function renderNow() {
  scheduled = false;
  applyTheme();
  render(shell(), root);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(renderNow);
}

// ---------- horloge : surlignage « maintenant », passage à minuit ----------
let lastToday = E.todayStr();
function tick() {
  const t = E.todayStr();
  if (t !== lastToday) {
    if (state.date === lastToday) state.date = t;
    lastToday = t;
  }
  if (document.visibilityState !== "visible") return;
  // ne pas écraser un champ en cours de saisie
  if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  schedule();
}

// ---------- clavier (PC) ----------
function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const step = state.view === "semaine" ? 7 : state.view === "jour" ? 1 : 0;
  if (e.key === "ArrowLeft" && step) nav.go(-step);
  else if (e.key === "ArrowRight" && step) nav.go(step);
  else if ((e.key === "t" || e.key === "T") && step) nav.go(0);
  else if (e.key >= "1" && e.key <= "4") goView(TABS[+e.key - 1][0]);
  else return;
  e.preventDefault();
}

// ---------- glisser gauche / droite sur la vue Jour (téléphone, tablette) ----------
function bindSwipe(el) {
  let start = null;
  el.addEventListener("touchstart", (e) => {
    start = null;
    if (state.view !== "jour" || e.touches.length !== 1) return;
    const t = e.touches[0];
    // bords de l'écran réservés aux gestes du système ; champs et interrupteurs ignorés
    if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;
    if (e.target.closest("input, select, textarea, .sw")) return;
    start = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!start) return;
    const t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y, dt = Date.now() - start.time;
    start = null;
    if (dt < 700 && Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) nav.go(dx < 0 ? 1 : -1);
  }, { passive: true });
}

export function mountApp(el) {
  root = el;
  subscribe(schedule);
  window.addEventListener("popstate", () => applyView(viewFromHash()));
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", tick);
  darkScheme.addEventListener?.("change", schedule);
  setInterval(tick, 30000);
  bindSwipe(el);
  native?.then((n) => n.setupNative());
  renderNow();
}
