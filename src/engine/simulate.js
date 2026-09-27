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
// de journée sur une heure précise (voir fitDay dans fit.js).
// `init` : état au début (déjà étudié, repas pris, lieu…), plus deux options :
// - leave { tail, travel } : sur un lieu, on rentre à la maison dès qu'il reste `tail` min d'étude ou
//   moins (après les séances) ; le trajet sert de pause et la fin se fait à la maison ;
// - blocks [min…] : blocs d'objectif (ex. annale : 2 × 120 min) posés d'un seul tenant, dès que possible.
export function simulateDay(start, hard, S, init = {}, tune = {}) {
  const target = tune.target ?? +S.targetH * 60;
  const L = tune.lunch ?? +S.lunch, D = tune.dinner ?? +S.dinner, P = tune.pause ?? +S.pause, BP = tune.bigPause ?? +S.bigPause;
  const SP = +S.sport + +S.shower, SES = +S.session, T = +S.travel;
  // durée minimale d'une session (0 = règles de la v1, qui acceptaient des sessions de quelques minutes)
  const MIN = tune.minSession ?? +(S.minSession || 0);

  let t = start;
  let studied = init.studied || 0, streak = init.streak || 0, sinceBig = init.sinceBig || 0;
  let lunch = !!init.lunch, dinner = !!init.dinner, sport = !!init.sport, onCampus = false;
  const items = [], missed = [];
  let hi = 0, guard = 0;

  const push = (it) => { if (it.e > it.s) items.push(it); };
  // lieu d'étude hors séances (maison, erasme, p4p, uz) ; « campus » entre deux séances à Erasme
  let base = init.at || "maison";
  const loc = () => (onCampus ? "campus" : base);
  const markMissed = (h) => missed.push({ ...h, missed: true });
  const leave = init.leave || null;
  const blocks = [...(init.blocks || [])];
  let goalN = 0;
  // plus rien d'imposé avant la fin, à part le départ à la fermeture du lieu
  const onlyClosing = () => { for (let k = hi; k < hard.length; k++) if (!hard[k].closing) return false; return true; };

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
    if (nh && nh.closing) nh = null; // la fermeture du lieu n'est pas une séance
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

    // déjà rentré à la maison : la fermeture du lieu ne concerne plus la journée
    if (nh && nh.closing && nh.kind === "travel" && base === "maison" && !onCampus) {
      while (hard[hi] && hard[hi].closing) hi++;
      continue;
    }

    // objectif atteint avant la fermeture du lieu : la journée s'arrête là (retour ensuite)
    if (nh && nh.closing && nh.kind === "travel" && target - studied - remFixed() <= 0) break;

    // horaire imposé par un lieu (trajet vers le lieu, départ à la fermeture, se poser en rentrant) : jamais sauté
    if (nh && nh.wall && t >= nh.s) {
      const d = nh.e - nh.s;
      push({ ...nh, s: t, e: t + d });
      t += d; streak = 0; hi++;
      if (nh.at) base = nh.at;
      continue;
    }

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
        push({ kind: "travel", dir: "back", s: t, e: t + T, at: nh.at });
        t += T; onCampus = false; streak = 0; hi++;
        if (nh.at) base = nh.at; // après la séance, direction le lieu de travail du jour
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
    if (selfLeft <= 0 && (!nh || onlyClosing())) break;

    // fin de journée à la maison : on part juste après une session, le trajet sert de pause
    // (une dernière session qu'on ne peut pas couper en deux se fait aussi à la maison)
    const lastOne = selfLeft < 2 * MIN && leave && leave.tail >= MIN;
    if (leave && base !== "maison" && !onCampus && streak > 0 && selfLeft > 0 && (selfLeft <= leave.tail || lastOne) && onlyClosing()) {
      push({ kind: "travel", dir: "home", at: "maison", leave: true, s: t, e: t + leave.travel });
      t += leave.travel; streak = 0; base = "maison";
      continue;
    }

    const la = lunchAt(nh), da = dinnerAt(selfLeft, nh);
    if (!lunch && t >= la - 10 && gap >= 30) { meal("lunch", Math.min(L, gap)); continue; }
    if (!dinner && t >= da - 10 && gap >= 30) { meal("dinner", Math.min(D, gap)); continue; }

    // le sport est toujours le dernier élément de la journée : en cours de journée, une grande pause sépare les blocs
    const nextMeal = Math.min(la, da);
    // (pas juste après le retour à la maison : le trajet sert déjà de pause)
    if (sinceBig >= (lunch ? 180 : 240) && nextMeal - t > 45 && gap >= BP && selfLeft > 30 && !items.at(-1)?.leave) {
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
    const toLunch = !lunch && la > t ? la - t : Infinity;
    const toDinner = !dinner && isFinite(da) && da > t ? da - t : Infinity;
    len = Math.min(len, toLunch, toDinner);
    const room = Math.min(gap, toLunch, toDinner); // jusqu'à la prochaine séance ou le prochain repas
    // bloc d'objectif (annale…) : d'un seul tenant, au début d'une session, s'il tient avant la suite
    if (blocks.length && streak === 0 && room >= blocks[0] && (selfLeft === blocks[0] || selfLeft - blocks[0] >= MIN)) {
      const b = blocks.shift();
      push({ kind: "study", s: t, e: t + b, loc: loc(), goal: goalN++ });
      t += b; studied += b; streak += b; sinceBig += b;
      continue;
    }
    if (MIN > 0 && len < MIN) {
      // pas de session de quelques minutes
      if (gap < MIN && nh.closing && nh.kind === "travel") { // le lieu ferme bientôt : autant rentrer maintenant
        for (; hard[hi] && hard[hi].closing; hi++) {
          const w = hard[hi], d = w.e - w.s;
          push({ ...w, s: t, e: t + d });
          t += d;
          if (w.at) base = w.at;
        }
        streak = 0;
        continue;
      }
      if (gap < MIN) { // pas le temps avant la prochaine séance
        push({ kind: "free", s: t, e: nh.s, loc: loc() });
        t = nh.s; streak = 0;
        continue;
      }
      if (Math.min(toLunch, toDinner) < MIN) { // repas un peu avancé
        if (toLunch <= toDinner) meal("lunch", Math.min(L, gap));
        else meal("dinner", Math.min(D, gap));
        continue;
      }
      if (SES - streak < MIN) { // fin de session trop courte : pause d'abord
        push({ kind: "pause", s: t, e: t + Math.min(P, gap), loc: loc() });
        t += Math.min(P, gap); streak = 0;
        continue;
      }
      len = MIN; // reste de l'objectif : dernière session arrondie à la durée minimale
    } else if (MIN > 0 && len < selfLeft && selfLeft - len < MIN) {
      // il resterait une miette (< MIN) à la fin : deux sessions équilibrées, ou une un peu plus longue
      // (le repas attend quelques minutes si besoin, pas une séance)
      if (selfLeft >= 2 * MIN) len = Math.min(len, selfLeft - Math.floor(selfLeft / 2 / 5) * 5);
      else if (selfLeft <= gap) len = selfLeft;
    } else if (MIN > 0 && len === SES - streak && len < room) {
      // pas de miette avant la prochaine séance ou le prochain repas : deux sessions équilibrées
      const roomRest = room - len - P;
      if (roomRest > 0 && roomRest < MIN && room - P >= 2 * MIN) len = room - P - Math.floor((room - P) / 2 / 5) * 5;
    } else if (MIN <= 0) {
      if (len < 15 && gap <= len + 5 && selfLeft > len) {
        push({ kind: "free", s: t, e: nh.s, loc: loc() });
        t = nh.s; streak = 0;
        continue;
      }
      if (len <= 0) len = Math.max(1, Math.min(SES, selfLeft, gap));
    }
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
    if (last && last.kind === "study" && it.kind === "study" && last.e === it.s && last.loc === it.loc && it.e - last.s <= SES && last.goal == null && it.goal == null) last.e = it.e;
    else merged.push(it);
  }
  return { items: merged, missed, end: t, workEnd, studied, lunch, dinner, at: base };
}
