// Le moteur réécrit doit produire exactement les mêmes plannings que la v1 (legacy/horaire-9h-v1.html),
// pour tous les jours du quadrimestre et plusieurs profils de réglages / saisies,
// quand les ajouts de la v2 (heure de fin, lieux, sessions minimales, objectifs) sont désactivés.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import * as E from "../src/engine/index.js";

function loadLegacyEngine() {
  const html = readFileSync(new URL("../legacy/horaire-9h-v1.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  const ctx = vm.createContext({});
  vm.runInContext(scripts[0] + "\n" + scripts[1] + "\nthis.Engine = Engine;", ctx);
  return ctx.Engine;
}
const Legacy = loadLegacyEngine();

// PRNG déterministe pour générer des journées variées
function rng(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function dates(from, to) {
  const out = [];
  for (let d = from; d <= to; d = E.addDays(d, 1)) out.push(d);
  return out;
}
const ALL = dates("2026-09-21", "2027-01-10");

function randomDays(seed, { anyMinute = false } = {}) {
  const r = rng(seed), days = {};
  for (const ds of ALL) {
    if (r() < 0.35) continue;
    const d = {};
    // 06:00 → 10:55 par pas de 5 min ; ou à la minute près, avec des débuts jusqu'à 15:00
    d.wake = anyMinute ? E.hm(360 + Math.floor(r() * 300)) : E.hm(360 + Math.floor(r() * 60) * 5);
    if (r() < (anyMinute ? 0.5 : 0.25)) d.start = E.hm(E.m(d.wake) + 20 + (anyMinute ? Math.floor(r() * 240) : Math.floor(r() * 12) * 5));
    if (r() < 0.3) {
      const ov = {};
      for (const ev of E.dayEvents(ds, E.withDefaults({}), null)) if (r() < 0.4) ov[ev.id] = r() < 0.5;
      d.ov = ov;
    }
    if (r() < 0.2) d.replan = { at: 600 + Math.floor(r() * 100) * 5, studied: Math.floor(r() * 50) * 5, lunch: r() < 0.5, dinner: r() < 0.2, sport: r() < 0.1 };
    if (E.dow(ds) === 0 && r() < 0.4) d.ethique = r() < 0.5;
    days[ds] = d;
  }
  return (ds) => days[ds] || null;
}

const PROFILES = {
  "réglages de base": [{}, () => null],
  "cours théoriques + rythme court": [{ attendTheory: true, appuiMath: false, session: 60, pause: 15, travel: 45, targetH: 10 }, () => null],
  "guidance mardi, permanence vendredi": [{ guidChimDay: 2, permPhysDay: 5, permPhysStart: "12:30", permPhysDur: 90, appuiBio: false }, () => null],
  "week-end personnalisé": [{ concoursStart: "09:30", ethiqueEvery: 2, chimOrga: 120, concoursSat: 150, revSat: 90, wake: "06:45" }, () => null],
  "saisies aléatoires #1": [{}, randomDays(1)],
  "saisies aléatoires #2": [{ travel: 20, lunch: 60, bigPause: 30, targetH: 8.5 }, randomDays(42)],
  "levers à la minute, débuts l'après-midi": [{ prep: 17 }, randomDays(7, { anyMinute: true })]
};

// La v1 n'a ni heure de fin, ni lieux, ni durée minimale de session, ni objectifs de la semaine :
// on les désactive pour comparer (et on garde le trajet de la v1, 30 min).
const V1 = { endAt: "", weekdayPlace: "maison", minSession: 0, goals: { base: [], weeks: {} } };
// (key : la v2 identifie un créneau par son contenu ; legacyKey reprend la clé de la v1, comparée à sa place)
const NEW_KEYS = ["endAt", "endSet", "workEnd", "fit", "place", "placeSet", "placeInfo", "at0", "walls", "notes", "closedAt", "key"];
// retire les clés à valeur undefined (JSON) et les champs ajoutés en v2, pour comparer les données
// v1 : « · reporté » s'accumulait quand une tâche était reportée plusieurs fois (corrigé en v2) ;
// deux tâches qui ne différaient que par là sont maintenant une seule tâche
const once = (v) => (typeof v === "string" ? v.replace(/( · reporté)+/g, " · reporté") : v);
function mergeTasks(tasks) {
  const out = [];
  for (const t of tasks) {
    const last = out[out.length - 1];
    if (last && last.title === t.title) last.min += t.min;
    else out.push({ ...t });
  }
  return out;
}
const plain = (x) => JSON.parse(JSON.stringify(x, (k, v) =>
  NEW_KEYS.includes(k) ? undefined : k === "tasks" && Array.isArray(v) ? mergeTasks(v.map((t) => ({ ...t, title: once(t.title) }))) : once(v)));
// la clé « type@HH:MM » de la v1 est devenue legacyKey en v2 ; le message « X (10:00) est déjà passé »
// est devenu « Séance déjà passée : X (10:00), pas comptée. » (accord)
const MISSED = /^(.*) \((\d\d:\d\d)\) est déjà passé : pas compté\.$/;
const v1 = (x) => JSON.parse(JSON.stringify(x, (k, v) =>
  typeof v === "string" && MISSED.test(v) ? v.replace(MISSED, "Séance déjà passée : $1 ($2), pas comptée.")
    : v && typeof v === "object" && !Array.isArray(v) && typeof v.key === "string" && typeof v.kind === "string" ? { ...v, legacyKey: v.key } : v));

describe("parité avec la v1", () => {
  for (const [name, [profile, getDay]] of Object.entries(PROFILES)) {
    const settings = { travel: 30, ...profile, ...V1 };
    it(`planDay — ${name}`, () => {
      for (const ds of ALL) {
        expect(plain(E.planDay(ds, settings, getDay)), ds).toEqual(plain(v1(Legacy.planDay(ds, settings, getDay))));
      }
    });
    it(`planWeek — ${name}`, () => {
      for (const ds of ALL.filter((d) => E.dow(d) === 1)) {
        expect(plain(E.planWeek(ds, settings, getDay)), ds).toEqual(plain(v1(Legacy.planWeek(ds, settings, getDay))));
      }
    });
  }
});
