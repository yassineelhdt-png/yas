// Plan d'un jour et d'une semaine.
import H from "../data/index.js";
import { m, hm, dur, hdur, addDays, dow, monday, daysBetween } from "./time.js";
import { withDefaults } from "./settings.js";
import { SUBJ, evLabel } from "./labels.js";
import { weekNo, isBlocus, dayEvents, buildHard } from "./events.js";
import { fitDay, goHome } from "./fit.js";
import { rotKey, prepFor, assign, assignGrouped } from "./tasks.js";
import { PLACES, placeInfo } from "./places.js";
import { goalUnits, goalBlocks, blockTitle, GOAL_BLOCK } from "./goals.js";

const noDay = () => null;
// au plus deux blocs d'objectif (2 × 2h) par jour
const MAX_GOAL_BLOCKS = 2;
const minSession = (S) => +(S.minSession || 0) || 50;
const byStart = (a, b) => a.s - b.s;
// heure arrondie aux 5 minutes suivantes (les horaires calculés restent ronds)
const ceil5Of = (t) => Math.ceil(t / 5) * 5;
// règles de la v2 (heures rondes, sessions minimales…) ; minSession = 0 : exactement comme la v1
const v2 = (S) => +S.minSession > 0;

/** Lieu du jour : choix du jour, sinon lun–ven hors congés = lieu des réglages, sinon la maison. */
function placeOfDay(ds, w, S, day) {
  if (PLACES[day.place]) return { key: day.place, set: true };
  if (typeof day.lib === "boolean") return { key: day.lib ? "erasme" : "maison", set: true }; // ancienne version
  if (w < 1 || w > 5 || H.closed[ds] || S.weekdayLib === false) return { key: "maison", set: false };
  return { key: PLACES[S.weekdayPlace] ? S.weekdayPlace : "maison", set: false };
}

/**
 * Début de journée : préparation, trajet vers le lieu (pas avant l'ouverture).
 * Si le lieu ouvre tard, on étudie d'abord à la maison puis on part (trajet imposé = « wall »).
 * Retourne { start, pre, walls, at } — at : lieu où l'on est au début de l'étude.
 */
function morning(res, S, day, P, hard) {
  const W = res.wake, prep = +S.prep, ceil5 = v2(S) ? ceil5Of : (t) => t;
  const prepItem = (e) => (e > W ? [{ kind: "prep", s: W, e, long: e - W > prep + 10 }] : []);
  const ready = day.start ? m(day.start) : ceil5(W + prep); // prêt à étudier chez soi
  if (!P) return { start: ready, pre: prepItem(ready), walls: [], at: "maison" };

  const wanted = day.start ? m(day.start) : ceil5(W + prep + P.travel); // arrivée souhaitée sur place
  let arrive = Math.max(wanted, P.open, ceil5(W + P.travel));
  const first = hard[0];
  // (hors Erasme) moins d'une heure sur place avant de partir en séance : on va directement à la séance
  if (first && !P.campus && first.s < arrive + 60 && first.s >= arrive) {
    const back = hard.find((h) => h.kind === "travel" && h.dir === "back");
    if (back) back.at = P.key;
    return { start: ready, pre: prepItem(ready), walls: [], at: "maison" };
  }
  if (first && first.s < arrive) {
    if (P.campus) {
      // séance à Erasme avant l'arrivée prévue : on arrive pour la séance
      if (!day.start) arrive = Math.max(ceil5(W + P.travel), first.s);
    } else {
      // on part de la maison pour la séance, puis on rejoint le lieu du jour
      const back = hard.find((h) => h.kind === "travel" && h.dir === "back");
      if (back) back.at = P.key;
      return { start: ready, pre: prepItem(ready), walls: [], at: "maison" };
    }
  }
  const leave = arrive - P.travel;
  const trip = { kind: "travel", dir: "place", at: P.key, s: leave, e: arrive };
  if (arrive > wanted && leave - ready >= minSession(S)) {
    return { start: ready, pre: prepItem(ready), walls: [{ ...trip, wall: true }], at: "maison" };
  }
  return { start: arrive, pre: [...prepItem(leave), trip], walls: [], at: P.key };
}

/**
 * Journée simulée et calée sur l'heure de fin.
 * Sur un lieu : on rentre finir à la maison quand il reste environ `homeTail` min d'étude (le trajet
 * sert de pause) ; au plus tard à la fermeture (trajet + se poser, puis la suite à la maison).
 * Si la journée finit sur place : jamais après la fermeture, puis retour à la maison avant le sport.
 */
function runDay(res, S, start, hard, init) {
  const P = res.placeInfo, E = res.endAt;
  if (!P) return fitDay(start, hard, S, init, E);
  const C = P.close, tail = +S.homeTail || 0;
  const closing = C > start
    ? [{ kind: "travel", dir: "home", wall: true, closing: true, at: "maison", s: C, e: C + P.travel }, { kind: "settle", wall: true, closing: true, s: C + P.travel, e: C + P.travel + +S.prep }]
    : [];
  const all = [...hard, ...closing].sort(byStart);
  const ini = tail > 0 ? { ...init, leave: { tail, travel: P.travel } } : init;
  // sans fin prévue à la maison, on ne continue après la fermeture que si ça vaut une vraie session
  const stay = E != null && E > C && tail <= 0 && E - (C + P.travel + +S.prep) < minSession(S);
  let r = stay ? { ...fitDay(start, all, S, ini, C), closedAt: C } : fitDay(start, all, S, ini, E);
  // fini sur place : le calage ne doit pas dépasser la fermeture
  if (!stay && E != null && E > C && r.at !== "maison" && r.workEnd > C) r = { ...fitDay(start, all, S, ini, C), closedAt: C };
  return r.at && r.at !== "maison" ? goHome(r, P.travel) : r;
}

/** Où l'on est à l'instant `time` d'une journée déjà simulée. */
function whereAt(items, time, first) {
  let at = first;
  for (const it of items) {
    if (it.s >= time) break;
    if (it.at && it.e <= time) at = it.at;
  }
  return at;
}
const freshWeekMin = () => ({ CHIM: 0, PHYS: 0, MATH: 0, BIO: 0 });

/** Partie éthique ce dimanche ? (réglage manuel du jour, sinon 1 dimanche sur N) */
export function isEthique(ds, S, day) {
  if (day && typeof day.ethique === "boolean") return day.ethique;
  // premier dimanche du cycle : l'ancre, ou le dimanche qui la suit ; cycle en semaines entières
  const every = Math.max(1, Math.round(+S.ethiqueEvery) || 1);
  const anchor = addDays(S.ethiqueAnchor, (7 - dow(S.ethiqueAnchor)) % 7);
  const n = daysBetween(anchor, ds);
  return n >= 0 && n % (7 * every) === 0;
}

// ---------- dimanche : concours blanc ----------
function planSunday(res, S, day, pre, weekMin) {
  res.mode = "concours";
  const eth = isEthique(res.date, S, day);
  res.ethique = eth;
  const preItems = [];
  let t = res.start;
  if (S.concoursStart && m(S.concoursStart) > t) {
    pre.push({ kind: "free", s: t, e: m(S.concoursStart), note: "Petit-déj · mise en condition" });
    t = m(S.concoursStart);
  }
  preItems.push({ kind: "exam", subj: "CONC", s: t, e: t + 180, title: "Concours blanc · partie 1 — sciences", detail: "Bio · chimie · physique · maths. Conditions réelles : chrono, pas de téléphone, pas de pause." });
  t += 180;
  preItems.push({ kind: "lunch", s: t, e: t + +S.concoursPause, note: "Pause " + dur(+S.concoursPause) + " avec repas, comme le jour J" });
  t += +S.concoursPause;
  preItems.push({ kind: "exam", subj: "RAIS", s: t, e: t + +S.raisonnement, title: "Partie 2 — raisonnement", detail: "Chrono, conditions d'examen" });
  t += +S.raisonnement;
  let did = 180 + +S.raisonnement;
  if (eth) {
    preItems.push({ kind: "exam", subj: "ETH", s: t, e: t + +S.ethique, title: "Partie 2 — éthique & empathie", detail: "Épreuve mensuelle" });
    t += +S.ethique;
    did += +S.ethique;
  }
  const queue = [
    { subj: "RAIS", kind: "corr", title: "Correction · raisonnement" + (eth ? " + éthique" : ""), detail: "À chaud : comprendre le piège de chaque question ratée", min: eth ? 50 : 30 },
    { subj: "CONC", kind: "corr", title: "Correction · partie sciences", detail: "Chaque erreur : pourquoi, notion en cause, règle à retenir → fiche d'erreurs", min: 150 },
    { subj: "CONC", kind: "remed", title: "Remédiation ciblée", detail: "Revoir la théorie des notions les plus ratées, refaire les questions fausses", min: 999 }
  ];
  const r = runDay(res, S, t, res.walls.filter((h) => h.s >= t), { studied: did, lunch: true, streak: +S.session, sinceBig: did - 180, at: res.at0 });
  res.items = [...pre, ...preItems, ...r.items];
  res.end = r.end;
  res.workEnd = r.workEnd;
  res.fit = r.fit;
  finish(res, S, queue, weekMin);
  res.backlogOut = [];
  return res;
}

// ---------- samedi : chimie Q2 + prépa concours + rattrapage ----------
/**
 * Annale du samedi : ce qui reste des objectifs de la semaine, jusqu'à `annaleSat` minutes
 * (en blocs de 2h, posés le matin). Rien si la semaine a déjà tout placé.
 */
function saturdayBlocks(goals, S) {
  const cap = Math.max(0, +S.annaleSat || 0), floor = minSession(S), out = [];
  let used = 0;
  for (const u of goals || []) {
    if (u.left <= 0) continue;
    for (const b of goalBlocks(u.left, floor)) {
      if (out.length >= MAX_GOAL_BLOCKS || used + b > cap) return out;
      out.push(b);
      used += b;
    }
  }
  return out;
}

function saturdayQueue(res, S, getDay, backlog, goalMin = 0) {
  res.mode = "samedi";
  // avec l'annale du samedi, le reste de la journée (chimie Q2, prépa concours, révision) est réduit d'autant
  const full = +S.chimOrga + +S.chimMin + +S.concoursSat + +S.revSat;
  const k = goalMin > 0 && full > 0 ? Math.max(0, full - goalMin) / full : 1;
  const cut = (x) => (k === 1 ? +x : Math.round((+x * k) / 5) * 5);
  const cs = cut(S.concoursSat), cp = Math.round(cs / 2 / 5) * 5;
  const extra = backlog.map((x) => x.title.replace(" · reporté", "").replace(" du jour", "").replace(/^Cours/, "cours") + " (" + x.min + " min)");
  const mon = addDays(res.date, 2);
  for (const e of dayEvents(mon, S, (getDay(mon) || {}).ov)) {
    if (!e.attend) continue;
    const p = prepFor(e);
    if (p && p.min >= 30) extra.push(p.title.toLowerCase() + " de lundi");
  }
  res.satExtra = extra;
  return [
    { subj: "CHQ2", kind: "q2", title: "Chimie Q2 · organique", detail: "Nouvelle matière puis exercices, sans regarder la solution (avec ton artefact)", min: cut(S.chimOrga) },
    { subj: "CHQ2", kind: "q2", title: "Chimie Q2 · minérale", detail: "Oxydoréduction et acide-base : équilibrer des redox, pH, tampons", min: cut(S.chimMin) },
    { subj: "PHYS", kind: "conc", title: "Prépa concours · physique", detail: "Questions type concours, chrono en main", min: cp },
    { subj: "MATH", kind: "conc", title: "Prépa concours · maths", detail: "Questions type concours, chrono en main", min: cs - cp },
    { subj: "REV", kind: "rev", title: "Révision de la semaine", detail: "Anki + fiches de la semaine (bio, chimie, physique, maths)" + (extra.length ? ". D'abord : " + extra.join(", ") : ""), min: cut(S.revSat) }
  ].filter((q) => q.min > 0);
}

// ---------- lundi → vendredi (et jours de congé) ----------
function weekdayQueue(res, S, getDay, backlog) {
  res.mode = res.closed ? "conge" : "semaine";
  const queue = [], shortQ = [];
  // préparer les séances de demain
  const tm = addDays(res.date, 1);
  if (dow(tm) >= 1 && dow(tm) <= 5) {
    for (const e of dayEvents(tm, S, (getDay(tm) || {}).ov)) {
      if (!e.attend) continue;
      const p = prepFor(e);
      if (!p) continue;
      p.title += " de demain";
      if (p.min < 30) p.after = 840; // les petites préparations après 14h
      (p.min >= 30 ? queue : shortQ).push(p);
    }
  }
  // ce qui n'a pas tenu hier passe en tête
  for (const x of backlog) {
    // « · reporté » une seule fois, même si la tâche est reportée plusieurs jours de suite
    const c = { ...x, kind: "backlog", title: x.title.replace(" du jour", "").replace(/( · reporté)+$/, "") + " · reporté" };
    delete c.after;
    queue.push(c);
  }
  // cours théoriques non suivis : à rattraper le jour même, après l'heure du cours
  for (const e of res.events) {
    if (e.type !== "TH" || e.attend) continue;
    const nm = SUBJ[e.subj] || e.subj;
    queue.push({
      subj: e.subj, kind: "th", carry: true, after: e.e,
      title: "Cours de " + (e.subj === "MEDIG" ? nm : nm.toLowerCase()) + " du jour" + (e.note ? " (" + e.note + ")" : ""),
      detail: "Slides ou podcast ×1,5 → fiche résumé → 5 cartes Anki",
      min: e.subj === "MEDIG" ? 45 : 90
    });
  }
  queue.push(...shortQ);
  return queue;
}

/**
 * Blocs d'objectif à placer aujourd'hui (durées, dans l'ordre des objectifs). Le premier bloc passe dès
 * qu'il reste au moins 2h d'étude perso à côté ; le second seulement si la file du jour (préparations,
 * cours à rattraper, reports) tient encore.
 */
function dayBlocks(goals, S, queue, hard, start) {
  if (!goals || !goals.length) return [];
  let self = +S.targetH * 60;
  for (const h of hard) if (h.counts) self -= Math.max(0, h.e - Math.max(h.s, start));
  const need = queue.reduce((a, q) => a + q.min, 0);
  const out = [], floor = minSession(S);
  let used = 0;
  for (const u of goals) {
    if (u.left <= 0) continue;
    for (const b of goalBlocks(u.left, floor)) {
      const ok = out.length === 0 ? self - b >= GOAL_BLOCK : used + b <= self - need;
      if (out.length >= MAX_GOAL_BLOCKS || !ok) return out;
      out.push(b);
      used += b;
    }
  }
  return out;
}

function planOne(ds, S, getDay, backlog, weekMin, goals) {
  const day = getDay(ds) || {};
  const w = dow(ds);
  const wake = m(day.wake || S.wake);
  const place = placeOfDay(ds, w, S, day);
  const res = {
    date: ds, dow: w, week: weekNo(ds), wake, startSet: !!day.start, endSet: !!day.end,
    place: place.key, placeSet: place.set, placeInfo: placeInfo(place.key, S),
    closed: H.closed[ds] || null, blocus: isBlocus(ds), events: [], warnings: []
  };

  let hard = [], queue;
  if (w !== 0) {
    res.events = dayEvents(ds, S, day.ov);
    // à Erasme, les séances sont sur place : pas de trajets entre elles
    if (w !== 6) hard = buildHard(res.events, res.placeInfo?.campus ? { ...S, travel: 0 } : S);
  }
  const mo = morning(res, S, day, res.placeInfo, hard);
  const start = mo.start;
  res.start = start;
  res.at0 = mo.at;
  res.walls = mo.walls;
  // heure de fin : celle du jour, sinon celle des réglages (vide = dès que l'objectif est atteint) ;
  // une heure du petit matin (ex. 00:30) veut dire après minuit
  let end = (day.end || S.endAt) ? m(day.end || S.endAt) : null;
  if (end != null && end <= start && end < 360) end += 1440;
  res.endAt = end;
  const pre = mo.pre;
  if (w === 0) return planSunday(res, S, day, pre, weekMin);

  const satBlocks = w === 6 ? saturdayBlocks(goals, S) : [];
  if (w === 6) queue = saturdayQueue(res, S, getDay, backlog, satBlocks.reduce((a, b) => a + b, 0));
  else queue = weekdayQueue(res, S, getDay, backlog);
  hard = [...hard, ...mo.walls].sort(byStart);
  // commencer l'après-midi : déjeuner déjà pris
  const init = { at: mo.at, lunch: v2(S) && start >= 810 };
  // objectifs de la semaine (annales…) : en gros blocs, sur le temps qui reste après la file du jour ;
  // le samedi, ce qui reste de la semaine (annaleSat)
  const blocks = res.mode === "semaine" || res.mode === "conge" ? dayBlocks(goals, S, queue, hard, start) : satBlocks;
  init.blocks = blocks;

  const rp = day.replan;
  if (rp && typeof rp.at === "number") {
    // replanification : ce qui précède `at` est figé (passé), la suite est recalculée
    const full = runDay(res, S, start, hard, init);
    const before = [];
    for (const it of full.items) {
      if (it.s >= rp.at) continue;
      const c = { ...it, past: true };
      if (c.e > rp.at) c.e = rp.at;
      before.push(c);
    }
    // trajet vers / depuis un lieu pas encore fini à la reprise (celui du matin, ou le retour à la
    // maison) : il continue, et on n'étudie pas « sur place » avant d'être arrivé
    const all = [...pre, ...full.items];
    const trips = all.filter((it) => it.kind === "travel" && it.at && it.e > rp.at && (pre.includes(it) || (it.leave && it.s < rp.at)));
    const pre2 = trips.length ? pre.filter((it) => it.s < rp.at).map((it) => (it.e > rp.at ? { ...it, e: rp.at } : it)) : pre;
    const hard2 = [
      ...hard.filter((h) => h.e > rp.at).map((h) => (h.wall && h.s < rp.at ? { ...h, s: rp.at } : h)),
      ...trips.map((it) => ({ kind: "travel", dir: it.dir, at: it.at, leave: it.leave, wall: true, s: Math.max(it.s, rp.at), e: it.e }))
    ].sort(byStart);
    // bloc d'objectif coupé par la reprise : sa fin reste à faire, en premier
    const pastBlocks = before.filter((it) => it.kind === "study" && it.goal != null).length;
    const cut = full.items.find((it) => it.kind === "study" && it.goal != null && it.s < rp.at && it.e > rp.at);
    const left = cut ? [Math.max(minSession(S), Math.ceil((cut.e - rp.at) / 5) * 5)] : [];
    const r = runDay(res, S, rp.at, hard2, {
      replan: true, blocks: [...left, ...blocks.slice(pastBlocks)], studied: rp.studied || 0, lunch: !!rp.lunch, dinner: !!rp.dinner, sport: !!rp.sport, streak: 0, sinceBig: rp.sinceBig || 0,
      at: trips.length ? whereAt(all, rp.at, "maison") : whereAt(full.items, rp.at, mo.at)
    });
    res.missed = r.missed;
    res.items = [...pre2, ...before, { kind: "replan", s: rp.at, e: rp.at, studied: rp.studied || 0 }, ...r.items];
    res.end = r.end;
    res.workEnd = r.workEnd;
    res.fit = r.fit;
    res.closedAt = r.closedAt;
    res.replanAt = rp.at;
    res.replanStudied = rp.studied || 0;
  } else {
    const r = runDay(res, S, start, hard, init);
    res.missed = r.missed;
    res.items = [...pre, ...r.items];
    res.end = r.end;
    res.workEnd = r.workEnd;
    res.fit = r.fit;
    res.closedAt = r.closedAt;
  }
  res.backlogOut = finish(res, S, queue, weekMin, goals);
  return res;
}

/** Titre de la tâche la plus longue d'une session (la première en cas d'égalité). */
function mainTitle(it) {
  let best = null;
  for (const t of it.tasks || []) if (!best || t.min > best.min) best = t;
  return best ? best.title : "";
}

/** Bloc d'objectif : prochain objectif de la semaine qui reste à faire (false s'il n'y en a plus). */
function placeGoal(ch, goals, weekMin, S) {
  const u = (goals || []).find((x) => x.left > 0);
  if (!u) return false;
  const len = ch.e - ch.s, done = u.total - u.left;
  ch.tasks = [{ subj: u.subj, kind: "goal", gid: u.gid, title: blockTitle(u, done, minSession(S)), detail: u.detail, min: len }];
  ch.subj = u.subj;
  u.left = Math.max(0, u.left - len);
  const k = rotKey(u.subj);
  if (weekMin[k] !== undefined) weekMin[k] += len;
  return true;
}

/** Remplit les sessions, numérote les blocs, calcule les totaux et les alertes. */
function finish(res, S, queue, weekMin, goals) {
  // segments = suites de sessions d'étude non coupées par une séance / une épreuve
  // (un bloc d'objectif coupe aussi le segment : une matière ne l'enjambe pas)
  let seg = 0, had = false;
  for (const it of res.items) {
    if (it.kind === "study" && it.goal == null) { it.seg = seg; had = true; }
    else if ((it.kind === "fixed" || it.kind === "exam" || it.kind === "replan" || it.kind === "study") && had) { seg++; had = false; }
  }
  const all = res.items.filter((it) => it.kind === "study");
  const chunks = all.filter((it) => it.goal == null || !placeGoal(it, goals, weekMin, S));
  const grouped = res.mode === "semaine" || res.mode === "conge";
  const carry = grouped ? assignGrouped(chunks, queue, weekMin, res.blocus, v2(S)) : assign(chunks, queue, weekMin, res.blocus);
  // (pas au début d'une annale : conditions d'examen)
  if (chunks.length && res.mode !== "concours") chunks[0].note = "Commence par 10 min d'Anki : rappel actif d'hier";

  // clé d'un créneau pour les cases cochées : son contenu (séance, tâche principale), pas son heure,
  // pour qu'une coche reste sur le bon créneau quand le plan se décale (lever, lieu, présences).
  // legacyKey : ancienne clé « type@HH:MM », pour relire les coches faites avant.
  const seen = {};
  for (const it of res.items) {
    it.legacyKey = it.kind + "@" + hm(it.s) + (it.id ? "#" + it.id : "");
    const base = it.kind === "fixed" ? "fixed#" + it.id
      : it.kind === "exam" ? "exam#" + it.title
      : it.kind === "study" ? "study#" + (mainTitle(it) || "")
      : null;
    if (!base) { it.key = it.legacyKey; continue; }
    seen[base] = (seen[base] || 0) + 1;
    it.key = seen[base] > 1 ? base + "#" + seen[base] : base;
  }

  // (règles v2) préparation de demain qui n'a pas trouvé sa place : on le dit
  if (grouped && v2(S)) {
    const got = {};
    for (const ch of chunks) for (const t of ch.tasks || []) got[t.title] = (got[t.title] || 0) + t.min;
    for (const q of queue) {
      if (q.kind !== "prep" || q.min < 30 || (got[q.title] || 0) >= q.min - 10) continue;
      res.warnings.push(q.title + " : seulement " + (got[q.title] || 0) + " min sur " + q.min + " dans le plan. Garde-toi ce temps demain avant la séance.");
    }
  }

  // ce qui compte dans l'objectif net
  let net = 0;
  const byS = {};
  for (const it of res.items) {
    it.counts = !it.past && (it.kind === "study" || it.kind === "exam" || (it.kind === "fixed" && !it.missed));
    if (!it.counts) continue;
    net += it.e - it.s;
    if (it.tasks) for (const tk of it.tasks) { const k = rotKey(tk.subj); byS[k] = (byS[k] || 0) + tk.min; }
    else { const k = rotKey(it.subj || "REV"); byS[k] = (byS[k] || 0) + (it.e - it.s); }
  }

  // blocs, séparés par les repas, le sport et la grande pause
  let bloc = 1, inBloc = 0;
  for (const it of res.items) {
    if (it.kind === "lunch" || it.kind === "dinner" || it.kind === "sport" || it.kind === "bigpause") {
      if (inBloc) { bloc++; inBloc = 0; }
      it.bloc = 0;
    } else if (it.counts) { it.bloc = bloc; inBloc += it.e - it.s; }
    else it.bloc = inBloc ? bloc : 0;
  }
  const blocs = {};
  for (const it of res.items) if (it.counts && it.bloc) blocs[it.bloc] = (blocs[it.bloc] || 0) + (it.e - it.s);
  res.blocs = blocs;

  if (res.replanStudied) net += res.replanStudied;
  res.net = net;
  res.bySubject = byS;
  const counted = res.items.filter((it) => it.counts);
  res.studyEnd = counted.reduce((a, it) => Math.max(a, it.e), 0);
  res.studyStart = counted.reduce((a, it) => Math.min(a, it.s), 1e9);

  const fit = res.fit;
  // informations (pas des problèmes)
  res.notes = [];
  // séances sans interruption à midi : pas de vrai déjeuner possible, on prévient
  if (v2(S) && res.mode !== "concours" && res.start < 810 && res.workEnd > 840 && !res.items.some((it) => it.kind === "lunch")) {
    // suite de séances (moins de 30 min entre deux) qui couvre midi
    const fx = res.items.filter((it) => it.kind === "fixed").sort(byStart);
    const k = fx.findIndex((it) => it.s < 840 && it.e > 720);
    if (k >= 0) {
      let a = k, b = k;
      while (a > 0 && fx[a].s - fx[a - 1].e < 30) a--;
      while (b < fx.length - 1 && fx[b + 1].s - fx[b].e < 30) b++;
      res.notes.push("Pas de pause déjeuner : séances de " + hm(fx[a].s) + " à " + hm(fx[b].e) + " presque sans interruption. Prends un repas à emporter.");
    }
  }
  if (res.closedAt != null && res.placeInfo) res.notes.push(res.placeInfo.short + " ferme à " + hm(res.closedAt) + " : fin du programme à " + hm(res.workEnd) + ".");
  if (fit?.mode === "stretch" && fit.early) res.notes.push("Objectif atteint à " + hm(res.workEnd) + " : pas besoin de continuer jusqu'à " + hm(fit.endAt) + ".");
  if (fit?.mode === "squeeze") {
    // seulement ce qui existe dans la journée
    const b = fit.breaks, parts = [], has = (k) => res.items.some((it) => it.kind === k && !it.past);
    const meals = [has("lunch") && b.lunch < +S.lunch && b.lunch, has("dinner") && b.dinner < +S.dinner && b.dinner].filter(Boolean);
    if (meals.length) parts.push("repas de " + Math.min(...meals) + " min");
    if (has("bigpause") && b.bigPause < +S.bigPause) parts.push("grande pause de " + b.bigPause + " min");
    if (has("pause") && b.pause < +S.pause) parts.push("pauses de " + b.pause + " min");
    if (!parts.length) parts.push("pauses raccourcies");
    res.warnings.push("Pour faire tes " + S.targetH + "h avant " + hm(fit.endAt) + " : " + parts.join(", ") + ".");
  }
  if (fit?.mode === "cut") res.warnings.push("Pour finir à " + hm(fit.endAt) + ", tu fais " + hdur(net) + " nettes au lieu de " + S.targetH + "h. Commence plus tôt ou recule l'heure de fin.");
  if (fit?.mode === "late") res.warnings.push("Impossible de finir à " + hm(fit.endAt) + " : tes séances à l'unif (avec les trajets et le déjeuner) vont au-delà.");
  if (fit?.mode === "invalid") res.warnings.push("L'heure de fin (" + hm(fit.endAt) + ") tombe avant " + (res.mode === "concours" ? "la fin du concours blanc" : "le début") + " : elle est ignorée.");
  if (res.end > 23 * 60) res.warnings.push("La journée finit après 23h. Lève-toi plus tôt demain pour garder tes " + S.sleepH + "h de sommeil.");
  for (const it of res.missed || []) res.warnings.push("Séance déjà passée : " + evLabel(it) + " (" + hm(it.s0 || it.s) + "), pas comptée.");
  for (const it of res.items) if (it.conflict) res.warnings.push(evLabel(it) + " chevauche une autre séance : vérifie tes présences.");
  return carry;
}

// ---------- API publique ----------

/** Plan complet d'un jour. En semaine, rejoue depuis lundi pour reporter ce qui n'a pas tenu. */
export function planDay(ds, rawSettings, getDay = noDay) {
  const S = withDefaults(rawSettings);
  if (dow(ds) === 0) return planOne(ds, S, getDay, [], {});
  return weekPass(monday(ds), ds, S, getDay).pop();
}

/** Plans des 7 jours de la semaine de `ds`, du lundi au dimanche. */
export function planWeek(ds, rawSettings, getDay = noDay) {
  const S = withDefaults(rawSettings);
  const mon = monday(ds);
  // le dimanche ne dépend pas du reste de la semaine
  return [...weekPass(mon, addDays(mon, 5), S, getDay), planOne(addDays(mon, 6), S, getDay, [], {})];
}

// Lundi → `until` en une passe : le report (backlog), l'équilibre des matières (weekMin) et ce qui
// reste des objectifs de la semaine (goals) se transmettent d'un jour à l'autre.
function weekPass(mon, until, S, getDay) {
  const out = [], weekMin = freshWeekMin(), goals = goalUnits(mon, S);
  let backlog = [];
  for (let d = mon; d <= until; d = addDays(d, 1)) {
    const r = planOne(d, S, getDay, backlog, weekMin, goals);
    backlog = r.backlogOut || [];
    r.backlogCarried = backlog;
    out.push(r);
  }
  return out;
}
