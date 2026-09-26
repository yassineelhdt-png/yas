import { pd } from "../engine/index.js";

export const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MOISC = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "Lundi 28 septembre" */
export function longDate(ds) {
  const d = pd(ds);
  return JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()];
}

/** "Lun 28" */
export function shortDay(ds) {
  const d = pd(ds);
  return JOURS[d.getDay()].slice(0, 3) + " " + d.getDate();
}

/** "28 sept." */
export function dayMonth(ds) {
  const d = pd(ds);
  return d.getDate() + " " + MOISC[d.getMonth()];
}

const COLORS = {
  CHIM: "--c-chim", PHYS: "--c-phys", MATH: "--c-math", BIO: "--c-bio", BIO2: "--c-bio", MEDIG: "--c-medig",
  CHQ2: "--c-chq2", CONC: "--c-conc", RAIS: "--c-rais", ETH: "--c-eth", REV: "--c-rev"
};

/** Couleur CSS d'une matière */
export const cv = (s) => "var(" + (COLORS[s] || "--c-rev") + ")";

/** Tâche principale (la plus longue) d'une session d'étude */
export const mainTask = (it) => (it.tasks || []).reduce((a, t) => (!a || t.min > a.min ? t : a), null);
