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

const lower = (subj) => (SUBJ[subj] || subj).toLowerCase();

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

/** Unités à placer dans la semaine (une par annale, etc.), avec le temps restant `left`. */
export function goalUnits(mon, S) {
  const units = [];
  for (const g of goalsOfWeek(mon, S)) {
    const count = Math.max(1, Math.round(+g.count || 1)), min = Math.round((+g.hours || 0) * 60);
    if (min <= 0 || !SUBJ[g.subj]) continue;
    for (let n = 1; n <= count; n++) {
      units.push({ gid: g.id, subj: g.subj, left: min, total: min, title: goalTitle(g, n), detail: (GOAL_KINDS[g.kind] || GOAL_KINDS.autre).detail });
    }
  }
  return units;
}
