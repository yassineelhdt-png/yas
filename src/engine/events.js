// Séances à l'unif d'un jour donné, et conversion en éléments « durs » (avec trajets).
import H from "../data/index.js";
import { m, hm, pd, addDays, dow, monday } from "./time.js";
import { evLabel } from "./labels.js";

/** Numéro de semaine du quadrimestre (S3 = première semaine de cours). */
export const weekNo = (ds) => Math.round((pd(monday(ds)) - pd(H.semesterStart)) / 864e5 / 7) + 2;

export const isBlocus = (ds) => ds >= H.blocusFrom;

function defaultAttend(type, subj, vete, S) {
  // cours théoriques : choix par matière (Réglages), sinon le choix général
  if (type === "TH") {
    const th = S.attendTh || {};
    return typeof th[subj] === "boolean" ? th[subj] : !!S.attendTheory;
  }
  if (type === "TUT") return !!S.tutoBio;
  if (type === "PERM" && subj === "MATH") return !!S.permMath;
  if (type === "VISITE") return false;
  if (type === "APPUI") {
    if (vete) return false;
    if (subj === "MATH") return !!S.appuiMath;
    if (subj === "BIO") return !!S.appuiBio;
    return true;
  }
  return true; // SEM, EX, TP, TEST, INFO
}

/** Créneau de guidance chimie ce jour-là (connu ou supposé), sinon null. */
function guidSlot(ds) {
  if (H.closed[ds]) return null;
  const g = H.guidChim.find((x) => x[0] === ds);
  if (g) return { s: m(g[1]), e: m(g[2]), room: H.rooms[g[3]] || g[3], assumed: false };
  if (ds > H.guidChimKnownUntil && ds <= H.permPhys.until) {
    const a = H.guidChimAssumed[dow(ds)];
    if (a) return { s: m(a[0]), e: m(a[1]), room: "local à confirmer", assumed: true };
  }
  return null;
}

/** Permanence de physique ce jour-là, sinon null. */
function permSlot(ds) {
  const w = dow(ds), P = H.permPhys;
  if (H.closed[ds] || w === 0 || w === 6 || ds < P.from || ds > P.until) return null;
  return { s: m(P.start), e: m(P.end), room: H.rooms[P.room] };
}

/** Jour de la semaine retenu pour la guidance chimie et la permanence physique (repli si fermé). */
function weekPicks(ds, S) {
  const mon = monday(ds);
  const byCloseness = (pref, cands) => cands.slice().sort((a, b) => Math.abs(a - pref) - Math.abs(b - pref) || a - b);
  const firstOpen = (pref, cands, slot) => {
    for (const wd of byCloseness(pref, cands)) {
      const d = addDays(mon, wd - 1);
      if (slot(d)) return d;
    }
    return null;
  };
  return {
    chim: firstOpen(+S.guidChimDay, [2, 3, 4], guidSlot),
    phys: firstOpen(+S.permPhysDay, [1, 2, 3, 4, 5], permSlot)
  };
}

/**
 * Séances du jour, triées. `ov` = présences forcées par l'utilisateur ({ id: bool }).
 * Chaque séance a `def` (présence par défaut) et `attend` (présence effective).
 */
export function dayEvents(ds, S, ov) {
  const out = [];
  for (const r of H.events) {
    if (r[0] !== ds) continue;
    out.push({
      id: r[0] + "_" + r[1].replace(":", "") + "_" + r[3] + "_" + r[4] + (r[7] ? "_V" : ""),
      s: m(r[1]), e: m(r[2]), subj: r[3], type: r[4],
      room: H.rooms[r[5]] || r[5] || "Local non indiqué sur TimeEdit",
      note: r[6] || "", vete: !!r[7], def: defaultAttend(r[4], r[3], r[7], S)
    });
  }
  // ajouts de la v2 (extraSessions = false : horaire de la v1, pour le test de parité)
  const extra = S.extraSessions !== false;
  // guidances de bio : thème du jour ; guidance 1 (jeudi) absente de TimeEdit ; séance des VETE en rechange
  for (const [n, theme, vete, bime] of H.bioGuid || []) {
    if (ds !== vete && ds !== bime) continue;
    const label = "Guidance " + n + " · " + theme;
    const own = out.find((ev) => ev.subj === "BIO" && ev.type === "APPUI" && !ev.vete && ev.s === m("12:00"));
    if (ds === bime && own) own.theme = label;
    else if (extra) {
      out.push({
        id: ds + "_1200_BIO_APPUI" + (ds === vete ? "_G" : ""), s: m("12:00"), e: m("14:00"), subj: "BIO", type: "APPUI",
        room: H.rooms.AUD, note: ds === vete ? "Séance des VETE : même guidance, sans inscription" : "", vete: ds === vete,
        theme: label, def: defaultAttend("APPUI", "BIO", ds === vete, S)
      });
    }
  }
  // séances de chaque semaine (ex. tutorat de bio du mercredi)
  for (const [subj, type, wd, s, e, room, from, until] of extra ? H.weekly || [] : []) {
    if (dow(ds) !== wd || ds < from || ds > until || H.closed[ds]) continue;
    out.push({
      id: ds + "_" + s.replace(":", "") + "_" + subj + "_" + type, s: m(s), e: m(e), subj, type,
      room: H.rooms[room] || room, note: "", vete: false, def: defaultAttend(type, subj, false, S)
    });
  }
  const picks = weekPicks(ds, S);
  const g = guidSlot(ds);
  if (g) {
    out.push({
      id: ds + "_GUIDCHIM", s: g.s, e: Math.min(g.s + +S.guidChimDur, g.e), subj: "CHIM", type: "GUID",
      room: g.room, note: "Guidance SAA · créneau " + hm(g.s) + "–" + hm(g.e) + (g.assumed ? " (supposé)" : ""),
      assumed: g.assumed, def: picks.chim === ds, moved: picks.chim === ds && dow(ds) !== +S.guidChimDay
    });
  }
  const p = permSlot(ds);
  if (p) {
    const st = Math.max(p.s, Math.min(m(S.permPhysStart), p.e - 30));
    out.push({
      id: ds + "_PERMPHYS", s: st, e: Math.min(st + +S.permPhysDur, p.e), subj: "PHYS", type: "PERM",
      room: p.room, note: "Permanence ouverte " + hm(p.s) + "–" + hm(p.e), def: picks.phys === ds,
      moved: picks.phys === ds && dow(ds) !== +S.permPhysDay
    });
  }
  for (const ev of out) ev.attend = ov && Object.hasOwn(ov, ev.id) ? !!ov[ev.id] : ev.def;
  out.sort((a, b) => a.s - b.s || a.e - b.e);
  return out;
}

/**
 * Séances suivies → éléments « durs » du jour : séances fixes regroupées en fenêtres,
 * avec un trajet aller avant et un trajet retour après chaque fenêtre.
 */
export function buildHard(evs, S) {
  const att = evs.filter((e) => e.attend).sort((a, b) => a.s - b.s || a.e - b.e);
  const list = [];
  let lastE = -1;
  for (const ev of att) {
    let s = ev.s, conflict = false;
    if (s < lastE) { conflict = true; s = lastE; }
    if (s >= ev.e) { ev.conflict = true; continue; } // entièrement recouverte par une autre séance
    list.push({ ...ev, s, s0: ev.s, conflict });
    lastE = Math.max(lastE, ev.e);
  }
  const T = +S.travel, hard = [];
  let i = 0;
  while (i < list.length) {
    // une fenêtre = séances assez proches pour rester sur le campus entre elles
    let j = i;
    while (j + 1 < list.length && list[j + 1].s - list[j].e < 2 * T + 90) j++;
    const ws = list[i].s, we = list[j].e;
    if (T > 0) hard.push({ kind: "travel", dir: "to", s: ws - T, e: ws, winEnd: we, dest: list[i].room, destLabel: evLabel(list[i]) });
    for (let k = i; k <= j; k++) {
      Object.assign(list[k], { kind: "fixed", counts: true, winEnd: we });
      hard.push(list[k]);
    }
    if (T > 0) hard.push({ kind: "travel", dir: "back", s: we, e: we + T, shiftable: true, winEnd: we });
    i = j + 1;
  }
  return hard;
}
