// Lieux de travail : horaires d'ouverture et trajet depuis la maison (réglables dans les réglages).
import { m } from "./time.js";

// clés des réglages pour chaque lieu ; Erasme partage le trajet des séances (réglage `travel`)
export const PLACES = {
  maison: { name: "Maison", short: "Maison" },
  erasme: { name: "Bibliothèque d'Erasme", short: "Erasme", open: "erasmeOpen", close: "erasmeClose", travel: "travel", campus: true },
  p4p: { name: "Play4Peace", short: "Play4Peace", open: "p4pOpen", close: "p4pClose", travel: "p4pTravel" },
  uz: { name: "Bibliothèque de l'UZ", short: "UZ", open: "uzOpen", close: "uzClose", travel: "uzTravel" }
};
export const PLACE_KEYS = Object.keys(PLACES);

/** Lieu complet avec horaires en minutes, ou null pour la maison. */
export function placeInfo(key, S) {
  const p = PLACES[key];
  if (!p || key === "maison") return null;
  return { key, name: p.name, short: p.short, campus: !!p.campus, open: m(S[p.open]), close: m(S[p.close]), travel: +S[p.travel] };
}
