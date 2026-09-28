// Objectifs de la semaine : annales, théorie à rattraper, exercices… placés sur le temps d'étude libre.
import { SUBJ } from "./labels.js";

export const GOAL_KINDS = {
  annale: { name: "Annale", hours: 4, detail: "Conditions d'examen, chrono en main, puis correction complète (fiche d'erreurs)" },
  theorie: { name: "Théorie à rattraper", hours: 2, detail: "Lire le cours, fiche résumé, cartes Anki" },
  exos: { name: "Exercices", hours: 2, detail: "Sans regarder la solution, puis corriger" },
  autre: { name: "Autre", hours: 1, detail: "" }
};
// matières proposées pour un objectif
export const GOAL_SUBJECTS = ["CHIM", "PHYS", "MATH", "BIO", "CHQ2", "MEDIG"];

// « chimie », « chimie Q2 », « MEDIG » : minuscule initiale, sigles gardés
const lower = (subj) => {
  const n = SUBJ[subj] || subj;
  return /^[A-Z]{2}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
};

/** Intitulé d'un objectif (n / count pour les objectifs répétés). */
export function goalTitle(g, n = 1) {
  const count = Math.max(1, Math.round(+g.count || 1));
  const num = count > 1 ? " " + n + "/" + count : "";
  const label = g.label ? " · " + g.label : "";
  switch (g.kind) {
    case "annale": return "Annale de " + lower(g.subj) + num + label;
    case "theorie": return "Théorie de " + lower(g.subj) + num + label;
    case "exos": return "Exercices de " + lower(g.subj) + num + label;
    default: return (g.label || "Objectif · " + lower(g.subj)) + num;
  }
}

/** Liste des objectifs d'une semaine (clé = lundi) : ceux de la semaine s'ils existent, sinon les habituels. */
export function goalsOfWeek(mon, S) {
  const G = S.goals || {};
  const own = G.weeks && G.weeks[mon];
  return Array.isArray(own) ? own : Array.isArray(G.base) ? G.base : [];
}

/**
 * Unités à placer dans la semaine (une par annale, etc.), avec le temps restant `left`.
 * Les matières alternent (chimie 1, physique 1, maths 1, chimie 2…) pour ne pas en laisser une de côté.
 */
export function goalUnits(mon, S) {
  const lists = [];
  for (const g of goalsOfWeek(mon, S)) {
    const count = Math.max(1, Math.round(+g.count || 1)), min = Math.round((+g.hours || 0) * 12) * 5; // multiple de 5 min
    if (min <= 0 || !SUBJ[g.subj]) continue;
    const detail = (GOAL_KINDS[g.kind] || GOAL_KINDS.autre).detail, list = [];
    for (let n = 1; n <= count; n++) list.push({ gid: g.id, subj: g.subj, left: min, total: min, title: goalTitle(g, n), detail });
    lists.push(list);
  }
  const units = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) units.push(l[i]);
  return units;
}

// Un objectif se fait en gros blocs d'un seul tenant : une annale de 4h = 2 blocs de 2h.
export const GOAL_BLOCK = 120;

/** Durées des blocs d'un objectif de `min` minutes (blocs égaux d'au plus 2h, au moins `floor`). */
export function goalBlocks(min, floor = 0) {
  const n = Math.max(1, Math.ceil(min / GOAL_BLOCK)), out = [];
  let rest = min;
  for (let i = n; i > 0; i--) {
    const b = Math.max(floor, Math.round(rest / i / 5) * 5);
    out.push(b);
    rest -= b;
  }
  return out;
}

/** Intitulé d'un bloc : « Annale de chimie 1/2 · 1re partie » si l'objectif se fait en plusieurs blocs. */
export function blockTitle(u, done, floor = 0) {
  const lens = goalBlocks(u.total, floor);
  if (lens.length < 2) return u.title;
  let part = 1, acc = 0;
  for (const b of lens) {
    if (acc + b > done) break;
    acc += b;
    part++;
  }
  return u.title + " · " + (part === 1 ? "1re" : Math.min(part, lens.length) + "e") + " partie";
}
