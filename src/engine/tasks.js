// Contenu des sessions d'étude : quoi travailler dans chaque créneau.
import { SUBJ, evLabel } from "./labels.js";

// Matières qui tournent pour équilibrer la semaine
export const ROT = ["CHIM", "PHYS", "MATH", "BIO"];
const ROT_TXT = {
  CHIM: ["Exercices de chimie", "Séries du séminaire + anciens examens, chrono en main"],
  PHYS: ["Exercices de physique", "Refaire les exercices sans la solution, puis corriger"],
  MATH: ["Exercices de maths", "Séries + méthodes à connaître par cœur"],
  BIO: ["Bio · fiches + Anki", "Mémorisation active : schémas à redessiner, cartes Anki"]
};

export const rotKey = (sj) => (sj === "BIO2" ? "BIO" : sj);

function rotTask(k, min, blocus) {
  const [title, detail] = ROT_TXT[k];
  return blocus
    ? { subj: k, kind: "rot", title: "Révision examen · " + SUBJ[k].toLowerCase(), detail: "Synthèses, anciens examens, points faibles", min }
    : { subj: k, kind: "rot", title, detail, min };
}

/** Matière de rotation la moins travaillée cette semaine. */
function rotItem(weekMin, blocus) {
  let best = ROT[0];
  for (const s of ROT) if ((weekMin[s] || 0) < (weekMin[best] || 0)) best = s;
  return rotTask(best, 90, blocus);
}

/** Préparation nécessaire avant une séance (null si rien à préparer). */
export function prepFor(ev) {
  const n = (SUBJ[ev.subj] || "").toLowerCase();
  switch (ev.type) {
    case "SEM":
    case "EX": return { subj: ev.subj, kind: "prep", title: "Préparer le séminaire de " + n, detail: "Faire la série avant la séance, noter ce qui bloque", min: 60 };
    case "TP": return { subj: ev.subj, kind: "prep", title: "Préparer le TP de " + n, detail: "Lire le protocole, répondre aux questions préalables", min: 30 };
    case "TEST": return { subj: ev.subj, kind: "prep", title: "Réviser l'interro de " + n, detail: "Exercices types, formules, anciens tests", min: 120 };
    case "APPUI":
    case "GUID":
    case "PERM": return { subj: ev.subj, kind: "prep", title: "Questions pour " + evLabel(ev).toLowerCase(), detail: "Lister précisément ce que tu veux demander", min: 15 };
    default: return null;
  }
}

const mainSubject = (ch) => (ch.tasks.length ? ch.tasks.reduce((a, x) => (x.min > a.min ? x : a)).subj : "REV");

/**
 * Remplissage simple, dans l'ordre de la file (samedi, dimanche).
 * Retourne ce qui doit être reporté au lendemain.
 */
export function assign(chunks, queue, weekMin, blocus) {
  for (const ch of chunks) {
    let rem = ch.e - ch.s;
    ch.tasks = [];
    while (rem > 0) {
      const now = ch.e - rem;
      let qi = queue.findIndex((q) => !q.after || q.after <= now + 15);
      if (qi < 0) { queue.push(rotItem(weekMin, blocus)); qi = queue.length - 1; }
      const q = queue[qi], take = Math.min(q.min, rem);
      const last = ch.tasks[ch.tasks.length - 1];
      if (last && last.title === q.title) last.min += take;
      else if (take < 15 && last && q.min > take) {
        // miette : on l'ajoute à la tâche précédente
        last.min += take; rem -= take; q.min -= take;
        if (q.min < 10) queue.splice(qi, 1);
        continue;
      } else ch.tasks.push({ subj: q.subj, kind: q.kind, title: q.title, detail: q.detail, min: take });
      const rk = rotKey(q.subj);
      if (weekMin[rk] !== undefined) weekMin[rk] += take;
      q.min -= take; rem -= take;
      if (q.min < 10) queue.splice(qi, 1);
    }
    ch.subj = mainSubject(ch);
  }
  return queue.filter((q) => q.carry && q.min >= 20);
}

/**
 * Semaine : chaque matière forme UN bloc continu dans la journée (on n'y revient jamais).
 * Les « segments » sont les suites de sessions d'étude non coupées par une séance à l'unif.
 * Retourne ce qui doit être reporté au lendemain.
 */
export function assignGrouped(chunks, queue, weekMin, blocus, strict = false) {
  const groups = {}, order = [];
  for (const q0 of queue) {
    const q = { ...q0 };
    const key = rotKey(q.subj);
    let g = groups[key];
    if (!g) {
      g = groups[key] = { key, tasks: [], req: 0, after: 0, prio: 0, readyPart: false, done: false };
      order.push(key);
    }
    g.tasks.push(q);
    g.req += q.min;
    if (q.kind === "th" && q.after) g.after = Math.max(g.after, q.after);
    if (q.kind === "backlog" || (q.kind === "prep" && q.min >= 30)) g.readyPart = true;
    const prio = q.kind === "prep" && q.min >= 30 ? 3 : q.subj === "MEDIG" ? 0 : q.kind === "th" || q.kind === "backlog" ? 2 : 1;
    g.prio = Math.max(g.prio, prio);
  }

  let segs = [];
  for (const ch of chunks) {
    const i = ch.seg || 0;
    if (!segs[i]) segs[i] = { chunks: [], cap: 0 };
    segs[i].chunks.push(ch);
    segs[i].cap += ch.e - ch.s;
    ch.tasks = [];
  }
  segs = segs.filter(Boolean);
  const C = segs.reduce((a, x) => a + x.cap, 0);
  const nT = Math.max(order.length, Math.min(4, Math.round(C / 135)));
  const level = Math.round(C / Math.max(1, nT) / 5) * 5; // durée cible d'un bloc de rotation
  const carry = [];

  const isRot = (k) => ROT.includes(k);
  const ready = (g, now) => !g.after || g.after <= now + 15 || g.readyPart;
  function rotPick() {
    let best = null;
    for (const k of ROT) {
      if (groups[k]) continue;
      if (!best || (weekMin[k] || 0) < (weekMin[best] || 0)) best = k;
    }
    return best;
  }

  segs.forEach((sg, si) => {
    let ci = 0, off = 0, rem = sg.cap, lastKey = null, futureMax = 0;
    for (let j = si + 1; j < segs.length; j++) futureMax = Math.max(futureMax, segs[j].cap);
    const nowT = () => { const ch = sg.chunks[ci]; return ch ? ch.s + off : 1e9; };
    const filler = () => si === segs.length - 1 && si > 0
      ? { subj: "REV", kind: "rev", title: "Bilan du jour · Anki + fiches", detail: "Relire les fiches faites aujourd'hui, cartes Anki du jour" }
      : { subj: "REV", kind: "rev", title: "Rappel actif · Anki", detail: "Cartes en retard, toutes matières" };
    // pose `min` minutes de la tâche t0 à la suite dans le segment
    function lay(t0, min) {
      while (min > 0 && ci < sg.chunks.length) {
        const ch = sg.chunks[ci], room = ch.e - ch.s - off, take = Math.min(room, min), last = ch.tasks[ch.tasks.length - 1];
        if (last && last.title === t0.title) last.min += take;
        else ch.tasks.push({ subj: t0.subj, kind: t0.kind, title: t0.title, detail: t0.detail, min: take });
        const rk = rotKey(t0.subj);
        if (weekMin[rk] !== undefined) weekMin[rk] += take;
        min -= take; off += take; rem -= take;
        if (off >= ch.e - ch.s) { ci++; off = 0; }
      }
    }

    let guard = 0;
    while (rem > 0 && guard++ < 40) {
      const now = nowT();
      const cands = order.filter((k) => !groups[k].done);
      const stuck = cands.filter((k) => groups[k].req > futureMax && groups[k].req > rem && rem >= 30 && groups[k].prio >= 2);
      const fullyReady = (k) => (!groups[k].after || groups[k].after <= now + 15 ? 1 : 0);
      const fit = cands
        .filter((k) => groups[k].req <= rem && ready(groups[k], now))
        .sort((a, b) => fullyReady(b) - fullyReady(a) || groups[b].prio - groups[a].prio);

      let pick = null;
      if (fit.length && (groups[fit[0]].prio > 0 || !stuck.length)) pick = fit[0];
      if (!pick && stuck.length) pick = stuck[0];
      if (!pick && rem >= 45) {
        const rk = rotPick();
        if (rk) { pick = rk; groups[rk] = { key: rk, tasks: [], req: 0, after: 0, prio: 1, done: false }; }
      }
      if (!pick) {
        const any = cands.filter((k) => groups[k].req <= rem);
        if (any.length) pick = any[0];
      }
      if (!pick) {
        if (lastKey && isRot(lastKey)) lay(rotTask(lastKey, rem, blocus), rem);
        else lay(filler(), rem);
        break;
      }

      const g = groups[pick];
      let A = Math.min(isRot(pick) ? Math.max(g.req, level) : g.req, rem);
      const tail = rem - A;
      if (tail > 0 && tail < 45 && isRot(pick) && !cands.some((k) => k !== pick && groups[k].req <= tail)) A = rem;
      // caler la fin du bloc sur une fin de session (pas de miettes de 5 min)
      if (A < rem) {
        let need = A, c2 = ci, o2 = off;
        while (c2 < sg.chunks.length) {
          const len2 = sg.chunks[c2].e - sg.chunks[c2].s - o2;
          if (need <= len2) break;
          need -= len2; c2++; o2 = 0;
        }
        if (c2 < sg.chunks.length) {
          const endOff = o2 + need, chLen = sg.chunks[c2].e - sg.chunks[c2].s, r2 = chLen - endOff;
          if (r2 > 0 && r2 < 20 && A + r2 <= rem) A += r2;
          else if (endOff > 0 && endOff < 20 && o2 === 0 && A - endOff >= Math.max(30, isRot(pick) ? Math.min(g.req, A) : g.req)) A -= endOff;
        }
      }

      const byKind = (f) => g.tasks.filter(f);
      const bl = byKind((t) => t.kind === "backlog");
      const th = byKind((t) => t.kind === "th");
      const pr = byKind((t) => t.kind === "prep" && t.min >= 30);
      const sq = byKind((t) => t.kind === "prep" && t.min < 30);
      const ex = A > g.req && isRot(pick) ? [rotTask(pick, A - g.req, blocus)] : [];
      const thReady = !g.after || g.after <= now + 15;
      // (règles v2) la préparation de la séance de demain a une échéance : elle passe avant les reports
      const seq = strict
        ? (thReady ? [...pr, ...bl, ...th, ...ex, ...sq] : [...pr, ...bl, ...ex, ...th, ...sq])
        : thReady ? [...bl, ...th, ...pr, ...ex, ...sq] : [...bl, ...pr, ...ex, ...th, ...sq];
      let left = A;
      for (const t0 of seq) {
        // (règles v2) un cours du jour n'est jamais placé avant la fin du cours : il passe à demain
        if (strict && t0.kind === "th" && t0.after && nowT() < t0.after - 15) {
          if (t0.min >= 20) carry.push({ ...t0 });
          continue;
        }
        const take = Math.min(t0.min, left);
        if (take > 0) { lay(t0, take); left -= take; }
        if (t0.min - take >= 20 && (t0.kind === "th" || t0.kind === "backlog")) carry.push({ ...t0, min: t0.min - take });
      }
      if (left > 0) lay(isRot(pick) ? rotTask(pick, left, blocus) : filler(), left);
      g.done = true;
      lastKey = pick;
    }
  });

  for (const k of order) {
    if (groups[k].done) continue;
    for (const t0 of groups[k].tasks) if ((t0.kind === "th" || t0.kind === "backlog") && t0.min >= 20) carry.push(t0);
  }
  for (const ch of chunks) ch.subj = mainSubject(ch);
  return carry.map((c) => { c.carry = true; return c; });
}
