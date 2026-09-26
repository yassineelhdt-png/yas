// Plan d'un jour et d'une semaine.
import H from "../data/index.js";
import { m, hm, dur, hdur, addDays, dow, monday, daysBetween } from "./time.js";
import { withDefaults } from "./settings.js";
import { SUBJ, evLabel } from "./labels.js";
import { weekNo, isBlocus, dayEvents, buildHard } from "./events.js";
import { fitDay, goHome } from "./fit.js";
import { rotKey, prepFor, assign, assignGrouped } from "./tasks.js";

const noDay = () => null;

/** Journée simulée et calée sur l'heure de fin ; à la bibliothèque, retour à la maison avant le sport. */
function runDay(res, S, start, hard, init) {
  if (!res.atLib) return fitDay(start, hard, S, init, res.endAt);
  return goHome(fitDay(start, hard, S, { ...init, at: "bibli" }, res.endAt), +S.travel);
}
const freshWeekMin = () => ({ CHIM: 0, PHYS: 0, MATH: 0, BIO: 0 });

/** Partie éthique ce dimanche ? (réglage manuel du jour, sinon 1 dimanche sur N) */
export function isEthique(ds, S, day) {
  if (day && typeof day.ethique === "boolean") return day.ethique;
  const n = daysBetween(S.ethiqueAnchor, ds);
  return n >= 0 && (n / 7) % +S.ethiqueEvery === 0;
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
  const r = runDay(res, S, t, [], { studied: did, lunch: true, streak: +S.session, sinceBig: did - 180 });
  res.items = [...pre, ...preItems, ...r.items];
  res.end = r.end;
  res.workEnd = r.workEnd;
  res.fit = r.fit;
  finish(res, S, queue, weekMin);
  res.backlogOut = [];
  return res;
}

// ---------- samedi : chimie Q2 + prépa concours + rattrapage ----------
function saturdayQueue(res, S, getDay, backlog) {
  res.mode = "samedi";
  const cs = +S.concoursSat, cp = Math.round(cs / 2 / 5) * 5;
  const extra = backlog.map((x) => x.title.replace(" · reporté", "").replace(" du jour", "").replace(/^Cours/, "cours") + " (" + x.min + " min)");
  const mon = addDays(res.date, 2);
  for (const e of dayEvents(mon, S, (getDay(mon) || {}).ov)) {
    if (!e.attend) continue;
    const p = prepFor(e);
    if (p && p.min >= 30) extra.push(p.title.toLowerCase() + " de lundi");
  }
  res.satExtra = extra;
  return [
    { subj: "CHQ2", kind: "q2", title: "Chimie Q2 · organique", detail: "Nouvelle matière puis exercices, sans regarder la solution (avec ton artefact)", min: +S.chimOrga },
    { subj: "CHQ2", kind: "q2", title: "Chimie Q2 · minérale", detail: "Oxydoréduction et acide-base : équilibrer des redox, pH, tampons", min: +S.chimMin },
    { subj: "PHYS", kind: "conc", title: "Prépa concours · physique", detail: "Questions type concours, chrono en main", min: cp },
    { subj: "MATH", kind: "conc", title: "Prépa concours · maths", detail: "Questions type concours, chrono en main", min: cs - cp },
    { subj: "REV", kind: "rev", title: "Révision de la semaine", detail: "Anki + fiches de la semaine (bio, chimie, physique, maths)" + (extra.length ? ". D'abord : " + extra.join(", ") : ""), min: +S.revSat }
  ];
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
    const c = { ...x, kind: "backlog", title: x.title.replace(" du jour", "") + " · reporté" };
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

function planOne(ds, S, getDay, backlog, weekMin) {
  const day = getDay(ds) || {};
  const w = dow(ds);
  const wake = m(day.wake || S.wake);
  // journée à la bibliothèque d'Erasme : choix du jour, sinon lun–ven hors congés (réglage)
  const atLib = typeof day.lib === "boolean" ? day.lib : !!S.weekdayLib && w >= 1 && w <= 5 && !H.closed[ds];
  const trip = atLib ? +S.travel : 0; // trajet du matin vers la bibliothèque
  // début de l'étude : saisi, sinon lever + préparation (+ trajet) ; jamais avant d'avoir pu arriver
  const start = Math.max(day.start ? m(day.start) : wake + +S.prep + trip, wake + trip);
  // heure de fin : celle du jour, sinon celle des réglages (vide = dès que l'objectif est atteint)
  const endStr = day.end || S.endAt;
  const res = {
    date: ds, dow: w, week: weekNo(ds), wake, start, startSet: !!day.start,
    endAt: endStr ? m(endStr) : null, endSet: !!day.end, atLib, libSet: typeof day.lib === "boolean",
    closed: H.closed[ds] || null, blocus: isBlocus(ds), events: [], warnings: []
  };
  const leave = start - trip;
  const pre = leave > wake ? [{ kind: "prep", s: wake, e: leave, long: leave - wake > +S.prep + 10 }] : [];
  if (trip > 0) pre.push({ kind: "travel", dir: "to", lib: true, s: leave, e: start });
  if (w === 0) return planSunday(res, S, day, pre, weekMin);

  res.events = dayEvents(ds, S, day.ov);
  let hard = [], queue;
  if (w === 6) queue = saturdayQueue(res, S, getDay, backlog);
  else {
    queue = weekdayQueue(res, S, getDay, backlog);
    // à la bibliothèque d'Erasme, les séances sont sur place : pas de trajets entre elles
    hard = buildHard(res.events, atLib ? { ...S, travel: 0 } : S);
  }

  const rp = day.replan;
  if (rp && typeof rp.at === "number") {
    // replanification : ce qui précède `at` est figé (passé), la suite est recalculée
    const full = runDay(res, S, start, hard, {});
    const before = [];
    for (const it of full.items) {
      if (it.s >= rp.at) continue;
      const c = { ...it, past: true };
      if (c.e > rp.at) c.e = rp.at;
      before.push(c);
    }
    const r = runDay(res, S, rp.at, hard.filter((h) => h.e > rp.at), {
      replan: true, studied: rp.studied || 0, lunch: !!rp.lunch, dinner: !!rp.dinner, sport: !!rp.sport, streak: 0, sinceBig: rp.sinceBig || 0
    });
    res.missed = r.missed;
    res.items = [...pre, ...before, { kind: "replan", s: rp.at, e: rp.at, studied: rp.studied || 0 }, ...r.items];
    res.end = r.end;
    res.workEnd = r.workEnd;
    res.fit = r.fit;
    res.replanAt = rp.at;
    res.replanStudied = rp.studied || 0;
  } else {
    const r = runDay(res, S, start, hard, {});
    res.missed = r.missed;
    res.items = [...pre, ...r.items];
    res.end = r.end;
    res.workEnd = r.workEnd;
    res.fit = r.fit;
  }
  res.backlogOut = finish(res, S, queue, weekMin);
  return res;
}

/** Remplit les sessions, numérote les blocs, calcule les totaux et les alertes. */
function finish(res, S, queue, weekMin) {
  // segments = suites de sessions d'étude non coupées par une séance / une épreuve
  let seg = 0, had = false;
  for (const it of res.items) {
    if (it.kind === "study") { it.seg = seg; had = true; }
    else if ((it.kind === "fixed" || it.kind === "exam" || it.kind === "replan") && had) { seg++; had = false; }
  }
  const chunks = res.items.filter((it) => it.kind === "study");
  const grouped = res.mode === "semaine" || res.mode === "conge";
  const carry = (grouped ? assignGrouped : assign)(chunks, queue, weekMin, res.blocus);
  if (chunks.length && res.mode !== "concours") chunks[0].note = "Commence par 10 min d'Anki : rappel actif d'hier";

  // ce qui compte dans l'objectif net
  let net = 0;
  const byS = {};
  for (const it of res.items) {
    it.key = it.kind + "@" + hm(it.s) + (it.id ? "#" + it.id : "");
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
  if (fit?.mode === "squeeze") {
    // seulement ce qui existe dans la journée
    const b = fit.breaks, parts = [], has = (k) => res.items.some((it) => it.kind === k && !it.past);
    if ((has("lunch") && b.lunch < +S.lunch) || (has("dinner") && b.dinner < +S.dinner)) parts.push("repas de " + Math.min(b.lunch, b.dinner) + " min");
    if (has("bigpause") && b.bigPause < +S.bigPause) parts.push("grande pause de " + b.bigPause + " min");
    if (has("pause") && b.pause < +S.pause) parts.push("pauses de " + b.pause + " min");
    if (!parts.length) parts.push("pauses raccourcies");
    res.warnings.push("Pour faire tes " + S.targetH + "h avant " + hm(fit.endAt) + " : " + parts.join(", ") + ".");
  }
  if (fit?.mode === "cut") res.warnings.push("Pour finir à " + hm(fit.endAt) + ", tu fais " + hdur(net) + " nettes au lieu de " + S.targetH + "h. Commence plus tôt ou recule l'heure de fin.");
  if (fit?.mode === "late") res.warnings.push("Tes séances à l'unif finissent après " + hm(fit.endAt) + " : impossible de finir à cette heure-là.");
  if (fit?.mode === "invalid") res.warnings.push("L'heure de fin (" + hm(fit.endAt) + ") est avant le début : elle est ignorée.");
  if (res.end > 23 * 60) res.warnings.push("La journée finit après 23h. Lève-toi plus tôt demain pour garder tes " + S.sleepH + "h de sommeil.");
  for (const it of res.missed || []) res.warnings.push(evLabel(it) + " (" + hm(it.s0 || it.s) + ") est déjà passé : pas compté.");
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

// Lundi → `until` en une passe : le report (backlog) et l'équilibre des matières (weekMin)
// se transmettent d'un jour à l'autre.
function weekPass(mon, until, S, getDay) {
  const out = [], weekMin = freshWeekMin();
  let backlog = [];
  for (let d = mon; d <= until; d = addDays(d, 1)) {
    const r = planOne(d, S, getDay, backlog, weekMin);
    backlog = r.backlogOut || [];
    r.backlogCarried = backlog;
    out.push(r);
  }
  return out;
}
