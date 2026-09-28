import { pd } from "../engine/index.js";

export const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MOISC = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const dayNum = (d) => (d.getDate() === 1 ? "1er" : String(d.getDate()));

/** "Lundi 28 septembre", "Jeudi 1er octobre" */
export function longDate(ds) {
  const d = pd(ds);
  return JOURS[d.getDay()] + " " + dayNum(d) + " " + MOIS[d.getMonth()];
}

/** "Lun 28" */
export function shortDay(ds) {
  const d = pd(ds);
  return JOURS[d.getDay()].slice(0, 3) + " " + d.getDate();
}

/** "28 sept.", "1er oct." */
export function dayMonth(ds) {
  const d = pd(ds);
  return dayNum(d) + " " + MOISC[d.getMonth()];
}

/** Créneau coché ? (clé actuelle, ou ancienne clé « type@HH:MM » des coches faites avant) */
export const isDone = (done, it) => !!(done && (done[it.key] || (it.legacyKey && done[it.legacyKey])));

const COLORS = {
  CHIM: "--c-chim", PHYS: "--c-phys", MATH: "--c-math", BIO: "--c-bio", BIO2: "--c-bio", MEDIG: "--c-medig",
  CHQ2: "--c-chq2", CONC: "--c-conc", RAIS: "--c-rais", ETH: "--c-eth", REV: "--c-rev"
};

/** Couleur CSS d'une matière */
export const cv = (s) => "var(" + (COLORS[s] || "--c-rev") + ")";

/**
 * Tâches d'une session telles qu'affichées : les miettes (< 10 min) sont ajoutées à la tâche
 * voisine (la précédente, sinon la suivante) plutôt que montrées seules.
 */
export function shownTasks(it) {
  const tasks = (it.tasks || []).map((t) => ({ ...t }));
  if (tasks.length < 2) return tasks;
  const out = [];
  let carry = 0; // miettes en tête de session, reportées sur la tâche suivante
  for (const t of tasks) {
    if (t.min < 10 && out.length) out[out.length - 1].min += t.min;
    else if (t.min < 10) carry += t.min;
    else {
      t.min += carry;
      carry = 0;
      out.push(t);
    }
  }
  if (!out.length) return tasks; // que des miettes : on les garde telles quelles
  if (carry) out[out.length - 1].min += carry;
  return out;
}

/** Tâche principale (la plus longue) d'une session d'étude */
export const mainTask = (it) => shownTasks(it).reduce((a, t) => (!a || t.min > a.min ? t : a), null);
