// Journée modifiée à la main : le plan calculé est figé en une liste de créneaux que l'on peut
// supprimer, changer (matière, intitulé, heures) ou compléter. Ce qui est supprimé ne compte plus,
// ni dans le jour ni dans la semaine.
import { SUBJ } from "./labels.js";

// matières proposées pour un créneau d'étude (AUTRE : nom libre, ex. « Médecine »)
export const CUSTOM_SUBJECTS = ["CHIM", "PHYS", "MATH", "BIO", "CHQ2", "MEDIG", "CONC", "REV", "AUTRE"];
export const CUSTOM_NAMES = { CONC: "Concours médecine", AUTRE: "Autre" };

// champs calculés par le moteur, recalculés à l'affichage
const DERIVED = ["counts", "bloc", "seg", "legacyKey", "past", "conflict", "s0"];
// créneaux « de remplissage » : on les retire sans rien dire quand un autre créneau prend leur place
const FILLER = new Set(["pause", "bigpause", "free", "settle"]);
const MIN_LEN = 5;

const num = (cid) => +String(cid).replace(/\D/g, "") || 0;
const nextCid = (items) => "c" + (items.reduce((a, it) => Math.max(a, num(it.cid)), 0) + 1);
const byStart = (a, b) => a.s - b.s || a.e - b.e;

/** Nom d'une matière dans l'éditeur (« Concours médecine », « Autre »…). */
export const customName = (subj) => CUSTOM_NAMES[subj] || SUBJ[subj] || subj;

/** Intitulé par défaut d'un créneau d'étude d'une matière. */
export function studyTitle(subj, label = "") {
  const name = String(label || "").trim();
  if (subj === "AUTRE") return name || "Autre";
  if (subj === "CONC") return name || "Prépa concours médecine";
  return name ? name : SUBJ[subj] || subj;
}

/**
 * Fige un plan calculé (res.items) en créneaux modifiables. Les coches restent attachées
 * (même clé) ; ce qui a été replanifié devient un créneau ordinaire.
 */
export function freezeDay(res) {
  const out = [];
  let n = 0;
  for (const it of res.items) {
    // (temps libre : les trous de la journée figée le sont déjà)
    if (it.kind === "replan" || it.kind === "free" || it.e <= it.s) continue;
    if (it.kind === "fixed" && it.missed) continue; // séance manquée : pas dans la journée
    const c = { ...it, cid: "c" + ++n };
    for (const k of DERIVED) delete c[k];
    delete c.missed;
    if (c.tasks) c.tasks = c.tasks.map((t) => ({ ...t }));
    out.push(c);
  }
  return out;
}

/** Tâches d'une session ramenées à `len` minutes (en proportion, par pas de 5 min). */
function scaleTasks(tasks, len) {
  const total = tasks.reduce((a, t) => a + t.min, 0);
  if (!tasks.length || total <= 0) return tasks;
  const out = tasks.map((t) => ({ ...t, min: Math.round((t.min * len) / total / 5) * 5 }));
  const diff = len - out.reduce((a, t) => a + t.min, 0);
  out[out.length - 1].min += diff;
  return out.filter((t) => t.min > 0);
}

/** Créneau aux nouvelles heures (les tâches d'une session suivent la durée). */
function resized(it, s, e) {
  const c = { ...it, s, e };
  if (c.tasks) c.tasks = scaleTasks(c.tasks, e - s);
  return c;
}

/**
 * Place `it` dans la journée : il garde ses heures, les autres créneaux qui le chevauchent sont
 * raccourcis, coupés en deux ou retirés.
 */
function fit(items, it) {
  const out = [];
  for (const o of items) {
    if (o.cid === it.cid) continue;
    if (o.e <= it.s || o.s >= it.e) { out.push(o); continue; }
    if (FILLER.has(o.kind) && o.s >= it.s) {
      // pause recouverte : ce qui dépasse après reste une pause
      if (o.e > it.e && o.e - it.e >= MIN_LEN) out.push(resized(o, it.e, o.e));
      continue;
    }
    if (o.s < it.s && o.s + MIN_LEN <= it.s) out.push(resized(o, o.s, it.s));
    if (o.e > it.e && o.e - it.e >= MIN_LEN) {
      const right = resized(o, it.e, o.e);
      if (o.s < it.s) { right.cid = nextCid([...items, ...out, it]); right.key = "custom#" + right.cid; }
      out.push(right);
    }
  }
  out.push(it);
  return out.sort(byStart);
}

/** Créneau d'étude d'une matière (remplace le contenu). */
function studyItem(base, subj, label, s, e) {
  const title = studyTitle(subj, label);
  return { ...base, kind: "study", s, e, subj, note: undefined, goal: undefined, tasks: [{ subj, kind: "custom", title, min: e - s }] };
}

/**
 * Modifications d'une journée figée (fonction pure : renvoie une nouvelle liste).
 * - { type: "remove", cid }
 * - { type: "update", cid, s?, e?, subj?, label? } — subj change le contenu d'une session d'étude
 * - { type: "add", kind: "study" | "fixed" | "pause" | "meal", s, e, subj?, label? }
 * - { type: "put", item } — un créneau tout fait (ex. séance de l'unif remise dans la journée)
 */
export function editDay(items, op) {
  const list = items.map((it) => ({ ...it }));
  if (op.type === "remove") return list.filter((it) => it.cid !== op.cid);
  const s = Math.round(+op.s / 5) * 5, e = Math.round(+op.e / 5) * 5;
  if (op.type === "update") {
    const cur = list.find((it) => it.cid === op.cid);
    if (!cur) return list;
    const S = Number.isFinite(s) ? s : cur.s, E = Number.isFinite(e) ? e : cur.e;
    if (E - S < MIN_LEN) return list;
    let it;
    if (cur.kind === "study" && op.subj) it = studyItem(cur, op.subj, op.label, S, E);
    else {
      it = resized(cur, S, E);
      if (cur.kind === "fixed" && cur.type === "PERSO" && op.label !== undefined) it.title = String(op.label).trim() || "Séance";
    }
    return fit(list, it);
  }
  if (op.type === "put") {
    // remettre une séance de l'unif dans la journée (« J'y vais »)
    const it = { ...op.item, cid: op.item.cid || nextCid(list) };
    if (!(it.e - it.s >= MIN_LEN)) return list;
    return fit(list, it);
  }
  if (op.type === "add") {
    if (!(e - s >= MIN_LEN)) return list;
    const cid = nextCid(list), base = { cid, key: "custom#" + cid, loc: "maison" };
    let it;
    if (op.kind === "fixed") {
      it = { ...base, kind: "fixed", type: "PERSO", id: "perso-" + cid, subj: op.subj || "AUTRE", title: String(op.label || "").trim() || "Séance", room: "", s, e };
    } else if (op.kind === "pause") it = { ...base, kind: "pause", s, e };
    else if (op.kind === "meal") it = { ...base, kind: s >= 960 ? "dinner" : "lunch", s, e };
    else it = studyItem(base, op.subj || "REV", op.label, s, e);
    return fit(list, it);
  }
  return list;
}

/** Créneaux libres de la journée figée (trous d'au moins 10 min entre deux créneaux). */
export function gaps(items, from, to) {
  const out = [];
  let t = from;
  for (const it of [...items].sort(byStart)) {
    if (it.s - t >= 10) out.push({ s: t, e: it.s });
    t = Math.max(t, it.e);
  }
  if (to != null && to - t >= 10) out.push({ s: t, e: to });
  return out;
}
