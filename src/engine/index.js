// Moteur de planification « 9h nettes » — pur JS, sans DOM.
// Entrée : une date + réglages + données du jour (heure de lever, présences…).
// Sortie : la liste ordonnée des créneaux de la journée.
export { default as H } from "../data/index.js";
export { m, hm, dur, hdur, pd, fd, addDays, dow, monday, daysBetween, todayStr, nowMin } from "./time.js";
export { DEFAULTS, withDefaults } from "./settings.js";
export { SUBJ, TYPE, evLabel } from "./labels.js";
export { weekNo, isBlocus, dayEvents } from "./events.js";
export { planDay, planWeek, isEthique } from "./plan.js";
export { PLACES, PLACE_KEYS, placeInfo } from "./places.js";
export { CUSTOM_SUBJECTS, customName, studyTitle, freezeDay, editDay, gaps } from "./custom.js";
export { GOAL_KINDS, GOAL_SUBJECTS, goalTitle, goalsOfWeek, goalUnits } from "./goals.js";
