// Le moteur réécrit doit produire exactement les mêmes plannings que la v1 (legacy/horaire-9h-v1.html),
// pour tous les jours du quadrimestre et plusieurs profils de réglages / saisies.
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

function randomDays(seed) {
  const r = rng(seed), days = {};
  for (const ds of ALL) {
    if (r() < 0.35) continue;
    const d = {};
    d.wake = E.hm(360 + Math.floor(r() * 60) * 5); // 06:00 → 10:55
    if (r() < 0.25) d.start = E.hm(E.m(d.wake) + 20 + Math.floor(r() * 12) * 5);
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
  "saisies aléatoires #2": [{ travel: 20, lunch: 60, bigPause: 30, targetH: 8.5 }, randomDays(42)]
};

// retire les clés à valeur undefined (JSON) pour comparer les données, pas la forme exacte des objets
const plain = (x) => JSON.parse(JSON.stringify(x));

describe("parité avec la v1", () => {
  for (const [name, [settings, getDay]] of Object.entries(PROFILES)) {
    it(`planDay — ${name}`, () => {
      for (const ds of ALL) {
        expect(plain(E.planDay(ds, settings, getDay)), ds).toEqual(plain(Legacy.planDay(ds, settings, getDay)));
      }
    });
    it(`planWeek — ${name}`, () => {
      for (const ds of ALL.filter((d) => E.dow(d) === 1)) {
        expect(plain(E.planWeek(ds, settings, getDay)), ds).toEqual(plain(Legacy.planWeek(ds, settings, getDay)));
      }
    });
  }
});
