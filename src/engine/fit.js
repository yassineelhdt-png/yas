// Caler la journée sur une heure de fin (ex. la bibliothèque ferme à 21:00).
// - De la marge : pauses et repas s'allongent, puis le reste se loge avant la dernière session.
// - Pas assez de temps : l'objectif net baisse pour finir à l'heure.
import { simulateDay } from "./simulate.js";

// fin à 20:00 ou plus tard : le dîner a lieu pendant le programme (sinon il tomberait après le sport)
const DINE_IF_END_AFTER = 1200;
// durées maximales quand on étire les pauses (min)
const CAPS = { pause: 30, bigPause: 60, lunch: 75, dinner: 75 };
// durées minimales quand on raccourcit les pauses pour caser l'objectif avant l'heure de fin (min)
const FLOORS = { pause: 5, bigPause: 10, lunch: 30, dinner: 30 };
const MAX_STEP = 45;
// pas de 5 min : les heures restent rondes (10:10, pas 10:08)
const STEP = 5;
// au-delà de cette marge (pauses déjà au maximum), on finit plus tôt plutôt que d'ajouter du temps libre
const MAX_SLACK = 60;
const BREAKS = new Set(["pause", "bigpause", "lunch", "dinner"]);
// rien ne se décale avant ces éléments : séances, épreuves, trajets (dont le retour à la maison)
const BARRIERS = new Set(["fixed", "exam", "travel", "settle"]);

/** Durées des pauses et repas étirées de `e` minutes (la grande pause deux fois plus), plafonnées. */
function stretched(S, e) {
  const up = (v, add, cap) => Math.min(v + add, Math.max(v, cap));
  return {
    pause: up(+S.pause, e, CAPS.pause),
    bigPause: up(+S.bigPause, 2 * e, CAPS.bigPause),
    lunch: up(+S.lunch, e, CAPS.lunch),
    dinner: up(+S.dinner, e, CAPS.dinner)
  };
}
/**
 * Durées raccourcies de `e` minutes, avec un minimum : d'abord les repas et la grande pause,
 * les petites pauses seulement une fois les repas au minimum.
 */
function squeezed(S, e) {
  const down = (v, sub, floor) => Math.max(v - sub, Math.min(v, floor));
  const mealRoom = Math.max(+S.lunch - FLOORS.lunch, +S.dinner - FLOORS.dinner, 0);
  return {
    pause: down(+S.pause, Math.max(0, e - mealRoom), FLOORS.pause),
    bigPause: down(+S.bigPause, 2 * e, FLOORS.bigPause),
    lunch: down(+S.lunch, e, FLOORS.lunch),
    dinner: down(+S.dinner, e, FLOORS.dinner)
  };
}
const sameBreaks = (a, b) => a.pause === b.pause && a.bigPause === b.bigPause && a.lunch === b.lunch && a.dinner === b.dinner;

/**
 * Ajoute `extra` minutes avant la dernière suite de sessions (après la dernière séance, le dernier
 * trajet) : la dernière pause s'allonge, ou un bloc « Temps libre » s'insère si la marge est grande.
 * Tout ce qui suit est décalé d'autant.
 */
function pad(r, extra, br, dine) {
  const items = r.items;
  let bar = -1;
  items.forEach((it, i) => { if (BARRIERS.has(it.kind) && it.e > it.s) bar = i; });
  const firstStudy = items.findIndex((it, i) => i > bar && it.kind === "study");
  if (firstStudy < 0) return r;
  let lastStudy = firstStudy;
  items.forEach((it, i) => { if (it.kind === "study") lastStudy = i; });
  // dernière pause suivie d'au moins une session ; le dîner, s'il y en a un, pour une grande marge
  let j = -1, dinner = -1;
  for (let i = bar + 1; i < lastStudy; i++) {
    if (BREAKS.has(items[i].kind)) j = i;
    if (items[i].kind === "dinner") dinner = i;
  }
  if (extra >= 20 && dinner >= 0) j = dinner;

  const out = items.map((it) => ({ ...it }));
  let from; // premier élément à décaler
  if (j >= 0 && extra < 20) {
    out[j].e += extra;
    from = j + 1;
  } else {
    // le bloc libre prend la place de l'élément `at`, qui est décalé avec la suite
    const at = j >= 0 ? j + 1 : firstStudy;
    const s = out[at].s, loc = out[at].loc;
    const blocks = [{ kind: "free", slack: true, s, e: s + extra, loc }];
    // pas encore dîné et la marge tombe le soir : elle commence par le dîner
    const D = br.dinner;
    if (dine && dinner < 0 && !items.some((it) => it.kind === "dinner") && s + extra >= 1110 && extra >= Math.min(D, 45)) {
      // dîner aussi long que possible (jusqu'au plafond), le reste en temps libre (au moins 15 min) :
      // après le dîner, ou avant s'il serait trop tôt (avant 18h)
      const C = CAPS.dinner, d = extra <= C ? extra : extra - C >= 15 ? C : extra - 15;
      const meal = (a) => ({ kind: "dinner", s: a, e: a + d, loc });
      const rest = (a, b) => (b > a ? [{ kind: "free", slack: true, s: a, e: b, loc }] : []);
      blocks.splice(0, 1, ...(s >= 1080 ? [meal(s), ...rest(s + d, s + extra)] : [...rest(s, s + extra - d), meal(s + extra - d)]));
    }
    out.splice(at, 0, ...blocks);
    from = at + blocks.length;
  }
  for (let i = from; i < out.length; i++) { out[i].s += extra; out[i].e += extra; }
  return { ...r, items: out, workEnd: r.workEnd + extra, end: r.end + extra };
}

/**
 * Simule la journée en visant la fin à `endAt` (minutes depuis minuit ; null = pas d'heure de fin).
 * Retourne le résultat de simulateDay, plus `fit` : { mode, endAt, stretch?, target? }.
 * mode : stretch (pauses allongées) · squeeze (pauses raccourcies) · cut (objectif réduit)
 *        · late (séances fixes trop tardives) · invalid (fin avant le début).
 */
export function fitDay(start, hard, S, init, endAt) {
  if (endAt == null) return { ...simulateDay(start, hard, S, init), fit: null };
  const dine = endAt >= DINE_IF_END_AFTER;
  const sim = (tune) => simulateDay(start, hard, S, init, { dine, ...tune });
  const base = sim({});
  if (endAt <= start) return { ...base, fit: { mode: "invalid", endAt } };

  if (base.workEnd <= endAt) {
    let best = base, stretch = 0, prev = stretched(S, 0);
    for (let e = STEP; e <= MAX_STEP; e += STEP) {
      const br = stretched(S, e);
      if (sameBreaks(br, prev)) break; // tout est au plafond
      prev = br;
      const r = sim(br);
      if (r.workEnd > endAt) break;
      best = r;
      stretch = e;
    }
    const slack = endAt - best.workEnd;
    // le dîner pris pendant le programme occupe une partie de la marge
    const dinnerRoom = dine && !best.items.some((it) => it.kind === "dinner") ? CAPS.dinner : 0;
    const early = slack - dinnerRoom > MAX_SLACK;
    const r = slack > 0 && !early ? pad(best, slack, stretched(S, stretch), dine) : best;
    return { ...r, fit: { mode: "stretch", endAt, stretch, breaks: stretched(S, stretch), early } };
  }

  // un peu juste : pauses et repas raccourcis (jusqu'au minimum) pour garder l'objectif entier
  let prev = squeezed(S, 0);
  for (let e = STEP; e <= MAX_STEP; e += STEP) {
    const br = squeezed(S, e);
    if (sameBreaks(br, prev)) break;
    prev = br;
    let r = sim(br);
    if (r.workEnd <= endAt) {
      // un pas peut faire gagner beaucoup (une session de plus avant une séance) : on rend aux repas
      // et aux pauses ce qui n'est pas nécessaire
      let b = br;
      for (const k of ["pause", "bigPause", "dinner", "lunch"]) {
        while (b[k] + STEP <= +S[k]) {
          const nb = { ...b, [k]: b[k] + STEP }, r2 = sim(nb);
          if (r2.workEnd > endAt) break;
          b = nb;
          r = r2;
        }
      }
      const out = r.workEnd < endAt ? pad(r, endAt - r.workEnd, b, dine) : r;
      return { ...out, fit: { mode: "squeeze", endAt, squeeze: e, breaks: b } };
    }
  }

  // pas assez de temps : plus grand objectif (par pas de 5 min) qui finit avant endAt, pauses normales
  const at = (target) => sim({ target });
  const floor = Math.ceil((init.studied || 0) / 5);
  if (at(floor * 5).workEnd > endAt) return { ...base, fit: { mode: "late", endAt } };
  let lo = floor, hi = Math.floor((+S.targetH * 60) / 5);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at(mid * 5).workEnd <= endAt) lo = mid;
    else hi = mid;
  }
  const cut = at(lo * 5);
  const r = cut.workEnd < endAt ? pad(cut, endAt - cut.workEnd, stretched(S, 0), dine) : cut;
  return { ...r, fit: { mode: "cut", endAt, target: lo * 5 } };
}

/** En semaine : retour de la bibliothèque à la maison juste après la fin, puis le sport. */
export function goHome(r, minutes) {
  if (!(minutes > 0)) return r;
  // déjà sur le chemin de la maison (retour d'Erasme juste avant) : pas de second trajet
  const last = r.items.filter((it) => it.e <= r.workEnd && it.e > it.s).at(-1);
  if (last?.kind === "travel") return r;
  const items = r.items.map((it) => ({ ...it }));
  const trip = { kind: "travel", dir: "home", s: r.workEnd, e: r.workEnd + minutes };
  const sport = items.findIndex((it) => it.kind === "sport" && it.s >= r.workEnd);
  if (sport >= 0) {
    items.splice(sport, 0, trip);
    for (let i = sport + 1; i < items.length; i++) { items[i].s += minutes; items[i].e += minutes; }
    return { ...r, items, end: r.end + minutes };
  }
  items.push(trip);
  return { ...r, items, end: Math.max(r.end, trip.e) };
}
