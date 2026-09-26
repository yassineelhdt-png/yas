// Simulation minute par minute d'une journée « 9h nettes ».
// Entrée : heure de début, éléments durs (séances + trajets), réglages, état initial.
// Sortie : créneaux ordonnés (étude, pauses, repas, trajets, séances, sport).

// Repères horaires (minutes depuis minuit)
const LUNCH_MIN = 675;   // 11:15 — déjeuner le plus tôt possible avant une séance
const LUNCH_PREF = 720;  // 12:00
const LUNCH_LATE = 795;  // 13:15
const DIN_PREF = 1140;   // 19:00
const DIN_LATE = 1230;   // 20:30

// `tune` (facultatif) remplace l'objectif net et la durée des pauses / repas : sert à caler la fin
// de journée sur une heure précise (voir fitDay dans plan.js).
export function simulateDay(start, hard, S, init = {}, tune = {}) {
  const target = tune.target ?? +S.targetH * 60;
  const L = tune.lunch ?? +S.lunch, D = tune.dinner ?? +S.dinner, P = tune.pause ?? +S.pause, BP = tune.bigPause ?? +S.bigPause;
  const SP = +S.sport + +S.shower, SES = +S.session, T = +S.travel;

  let t = start;
  let studied = init.studied || 0, streak = init.streak || 0, sinceBig = init.sinceBig || 0;
  let lunch = !!init.lunch, dinner = !!init.dinner, sport = !!init.sport, onCampus = false;
  const items = [], missed = [];
  let hi = 0, guard = 0;

  const push = (it) => { if (it.e > it.s) items.push(it); };
  // lieu d'étude hors séances : la maison, ou la bibliothèque d'Erasme (init.at = "bibli", pas de trajets)
  const home = init.at || "maison";
  const loc = () => (onCampus ? "campus" : home);
  const markMissed = (h) => missed.push({ ...h, missed: true });

  // minutes de séances fixes encore à venir (elles comptent dans l'objectif)
  function remFixed() {
    let s = 0;
    for (let k = hi; k < hard.length; k++) {
      const h = hard[k];
      if (h.counts) s += Math.max(0, h.e - Math.max(h.s, t));
    }
    return s;
  }
  function lunchAt(nh) {
    if (lunch) return Infinity;
    let at = Math.min(Math.max(LUNCH_PREF, t + Math.max(0, 180 - sinceBig)), LUNCH_LATE);
    // une séance arrive avant la fin du repas : manger avant de partir si la fenêtre finit tard
    if (nh && !nh.shiftable && nh.s < at + L) {
      let b;
      if (nh.winEnd >= 870) { // fenêtre qui finit après 14:30
        b = Math.max(nh.s - L, 660);
        if (nh.s - b >= 30) at = Math.min(at, b);
      } else if (nh.winEnd >= 810) { // fenêtre qui finit après 13:30
        b = nh.s - L;
        if (b >= LUNCH_MIN) at = Math.min(at, b);
      }
    }
    return at;
  }
  function dinnerAt(selfLeft, nh) {
    if (dinner) return Infinity;
    // on termine avant de manger… sauf si la journée doit finir tard (tune.dine) : dîner pendant le programme
    if (!nh && selfLeft <= 60 && !tune.dine) return Infinity;
    return Math.min(Math.max(DIN_PREF, t + Math.max(0, 90 - sinceBig)), DIN_LATE);
  }
  function meal(kind, len) {
    push({ kind, s: t, e: t + len, loc: loc() });
    t += len; streak = 0; sinceBig = 0;
    if (kind === "lunch") lunch = true; else dinner = true;
  }

  while (guard++ < 500) {
    const nh = hard[hi];

    // séance déjà terminée (lever tardif) → manquée
    if (nh && nh.kind === "fixed" && nh.e <= t) { markMissed(nh); hi++; continue; }

    // en retard pour partir : on part maintenant si la fenêtre a encore des séances
    if (nh && nh.kind === "travel" && nh.dir === "to" && t > nh.s) {
      let still = false;
      for (let q = hi + 1; q < hard.length && hard[q].kind === "fixed"; q++) if (hard[q].e > t + T) still = true;
      if (!still) {
        hi++;
        while (hi < hard.length && hard[hi].kind === "fixed") markMissed(hard[hi++]);
        if (hard[hi] && hard[hi].dir === "back") hi++;
        continue;
      }
      push({ kind: "travel", dir: "to", s: t, e: t + T, late: true, dest: nh.dest, destLabel: nh.destLabel });
      t += T; onCampus = true; streak = 0; hi++;
      continue;
    }

    if (nh && t >= nh.s) {
      if (nh.kind === "travel" && nh.dir === "back") {
        if (!lunch && t >= lunchAt(null) - 10) { meal("lunch", L); continue; }
        push({ kind: "travel", dir: "back", s: t, e: t + T });
        t += T; onCampus = false; streak = 0; hi++;
        continue;
      }
      if (nh.kind === "travel") {
        push({ kind: "travel", dir: "to", s: nh.s, e: nh.e, snack: !lunch && nh.winEnd >= 810 && t < 720, dest: nh.dest, destLabel: nh.destLabel });
        t = nh.e; onCampus = true; streak = 0; hi++;
        continue;
      }
      const s = Math.max(nh.s, t);
      push({ ...nh, s, late: !init.replan && s > nh.s0 + 5 });
      studied += nh.e - s; sinceBig += nh.e - s; streak = SES; t = nh.e; hi++;
      continue;
    }

    const gap = nh ? nh.s - t : Infinity;
    const selfLeft = target - studied - remFixed();
    if (selfLeft <= 0 && !nh) break;

    const la = lunchAt(nh), da = dinnerAt(selfLeft, nh);
    if (!lunch && t >= la - 10 && gap >= 30) { meal("lunch", Math.min(L, gap)); continue; }
    if (!dinner && t >= da - 10 && gap >= 30) { meal("dinner", Math.min(D, gap)); continue; }

    // le sport est toujours le dernier élément de la journée : en cours de journée, une grande pause sépare les blocs
    const nextMeal = Math.min(la, da);
    if (sinceBig >= (lunch ? 180 : 240) && nextMeal - t > 45 && gap >= BP && selfLeft > 30) {
      // fin de journée tardive : la grande pause du soir est le dîner
      if (tune.dine && !dinner && t >= 1080 && gap >= 30) { meal("dinner", Math.min(D, gap)); continue; }
      push({ kind: "bigpause", s: t, e: t + BP, loc: loc() });
      t += BP; streak = 0; sinceBig = 0;
      continue;
    }

    if (streak >= SES && selfLeft > 0) {
      if (!lunch && t >= 690 && la - t <= 30 && gap >= 30) { meal("lunch", Math.min(L, gap)); continue; }
      if (!dinner && t >= 1110 && da - t <= 30 && gap >= 30) { meal("dinner", Math.min(D, gap)); continue; }
      if (gap >= P) {
        push({ kind: "pause", s: t, e: t + P, loc: loc() });
        t += P; streak = 0;
        continue;
      }
      push({ kind: "free", s: t, e: nh.s, loc: loc() });
      t = nh.s; streak = 0;
      continue;
    }

    if (selfLeft <= 0) {
      push({ kind: "free", s: t, e: nh.s, loc: loc(), done: true });
      t = nh.s;
      continue;
    }

    let len = Math.min(SES - streak, selfLeft, gap);
    if (!lunch && la > t) len = Math.min(len, la - t);
    if (!dinner && isFinite(da) && da > t) len = Math.min(len, da - t);
    if (len < 15 && gap <= len + 5 && selfLeft > len) {
      push({ kind: "free", s: t, e: nh.s, loc: loc() });
      t = nh.s; streak = 0;
      continue;
    }
    if (len <= 0) len = Math.max(1, Math.min(SES, selfLeft, gap));
    push({ kind: "study", s: t, e: t + len, loc: loc() });
    t += len; studied += len; streak += len; sinceBig += len;
  }

  const workEnd = t; // fin du programme (avant le sport)
  if (!sport) {
    push({ kind: "sport", s: t, e: t + SP });
    t += SP;
  }

  // fusion des sessions d'étude contiguës (sans dépasser une session max)
  const merged = [];
  for (const it of items) {
    const last = merged[merged.length - 1];
    if (last && last.kind === "study" && it.kind === "study" && last.e === it.s && last.loc === it.loc && it.e - last.s <= SES) last.e = it.e;
    else merged.push(it);
  }
  return { items: merged, missed, end: t, workEnd, studied, lunch, dinner };
}
