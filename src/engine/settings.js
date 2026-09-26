// Réglages par défaut du planning. Durées en minutes, sauf mention contraire.
export const DEFAULTS = Object.freeze({
  // Journée
  wake: "07:30", prep: 20, targetH: 9, sleepH: 8,
  // Rythme
  session: 90, pause: 10, bigPause: 20, lunch: 45, dinner: 45, sport: 30, shower: 15,
  // Unif · Erasme
  travel: 30,
  guidChimDay: 4, guidChimDur: 120,
  permPhysDay: 3, permPhysStart: "10:00", permPhysDur: 120,
  appuiMath: true, appuiBio: true, attendTheory: false,
  // Week-end
  concoursStart: "", ethiqueAnchor: "2026-10-04", ethiqueEvery: 4,
  raisonnement: 60, ethique: 60, concoursPause: 90,
  chimOrga: 150, chimMin: 90, concoursSat: 180, revSat: 120
});

/** Réglages complets : valeurs de l'utilisateur par-dessus les valeurs par défaut. */
export function withDefaults(s) {
  const o = { ...DEFAULTS };
  if (s) for (const k in s) if (s[k] !== undefined && s[k] !== null) o[k] = s[k];
  return o;
}
