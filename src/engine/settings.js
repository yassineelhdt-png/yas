// Réglages par défaut du planning. Durées en minutes, sauf mention contraire.
export const DEFAULTS = Object.freeze({
  // Journée — endAt : heure de fin du programme (vide = dès que l'objectif est atteint)
  wake: "07:30", prep: 20, targetH: 9, sleepH: 8, endAt: "21:00",
  // Rythme — minSession : durée minimale d'une session d'étude (0 = comme la v1)
  session: 90, minSession: 50, pause: 10, bigPause: 20, lunch: 45, dinner: 45, sport: 30, shower: 15,
  // Lieux — weekdayPlace : lieu du lundi au vendredi hors congés (maison | erasme | p4p | uz) ;
  // travel : trajet maison ↔ Erasme (aller simple), aussi pour aller aux séances ;
  // homeTail : étude gardée pour la maison en fin de journée (0 = rester sur place jusqu'à la fin)
  weekdayPlace: "erasme", homeTail: 90,
  travel: 25, erasmeOpen: "08:00", erasmeClose: "20:45",
  p4pOpen: "09:00", p4pClose: "23:00", p4pTravel: 25,
  uzOpen: "08:00", uzClose: "22:00", uzTravel: 50,
  // Unif · Erasme
  guidChimDay: 4, guidChimDur: 120,
  permPhysDay: 3, permPhysStart: "10:00", permPhysDur: 120,
  appuiMath: true, appuiBio: true, attendTheory: false,
  // Week-end
  concoursStart: "", ethiqueAnchor: "2026-10-04", ethiqueEvery: 4,
  raisonnement: 60, ethique: 60, concoursPause: 90,
  chimOrga: 150, chimMin: 90, concoursSat: 180, revSat: 120,
  // Objectifs de la semaine — base : chaque semaine ; weeks : semaines personnalisées (clé = lundi)
  // objectif : { id, kind: annale | theorie | exos | autre, subj, count, hours, label }
  goals: Object.freeze({
    base: Object.freeze([
      { id: "annale-chim", kind: "annale", subj: "CHIM", count: 2, hours: 4, label: "" },
      { id: "annale-phys", kind: "annale", subj: "PHYS", count: 2, hours: 4, label: "" },
      { id: "annale-math", kind: "annale", subj: "MATH", count: 1, hours: 4, label: "" }
    ]),
    weeks: Object.freeze({})
  })
});

/** Réglages complets : valeurs de l'utilisateur par-dessus les valeurs par défaut. */
export function withDefaults(s) {
  const o = { ...DEFAULTS };
  if (s) for (const k in s) if (s[k] !== undefined && s[k] !== null) o[k] = s[k];
  return o;
}
