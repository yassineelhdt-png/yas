// Modifier la journée : supprimer un créneau, changer sa matière ou ses heures, en ajouter un.
// La première modification fige le plan du jour (day.custom) ; « Revenir au plan automatique » l'efface.
import { html, nothing } from "lit-html";
import * as E from "../engine/index.js";
import { state, getDay, saveDay, toast, notify } from "../store.js";
import { cv, mainTask, shownTasks, shortDay } from "./format.js";
import { icons } from "./icons.js";

// dernière modification (pour « Annuler ») et confirmation du retour au plan automatique
let undo = null;
let askReset = false;

/** Créneaux modifiables du jour affiché : ceux déjà figés, sinon le plan calculé, figé maintenant. */
const listOf = (res) => (getDay(state.date) || {}).custom?.items || E.freezeDay(res);

/** Le créneau `it` (de res.items) dans la liste figée. */
function find(list, it) {
  return it.cid ? list.find((x) => x.cid === it.cid) : list.find((x) => x.key === it.key && x.s === it.s);
}

function commit(res, next, msg, ovPatch, keep) {
  const ds = state.date, d = getDay(ds) || {};
  const prev = listOf(res);
  undo = { ds, custom: d.custom, ov: d.ov, done: d.done };
  // (JSON : pas de champ « undefined », refusé par la base de synchronisation)
  // (une replanification est gardée : ce qui la précède reste passé, le « déjà étudié » compte)
  const patch = { custom: { items: JSON.parse(JSON.stringify(next)), at: new Date().toISOString() } };
  if (ovPatch) patch.ov = { ...d.ov, ...ovPatch };
  // une clé neuve (créneau ajouté, partie d'un créneau coupé) n'hérite pas de la coche d'un créneau supprimé
  const old = new Set(prev.map((it) => it.key));
  const stale = d.done ? next.filter((it) => !old.has(it.key) && d.done[it.key]).map((it) => it.key) : [];
  if (stale.length) {
    patch.done = { ...d.done };
    for (const k of stale) delete patch.done[k];
  }
  saveDay(ds, patch);
  // ce que le nouveau créneau a pris à ses voisins
  const byCid = new Map(next.map((x) => [x.cid, x]));
  const gone = [], cut = [];
  for (const o of prev) {
    if (o.cid === keep || ["free", "pause", "bigpause", "settle"].includes(o.kind)) continue;
    const n = byCid.get(o.cid);
    if (!n) { if (keep !== undefined) gone.push(itemName(o)); }
    else if (n.e - n.s < o.e - o.s) cut.push(itemName(o) + " (" + E.dur(n.e - n.s) + ")");
  }
  const side = (gone.length ? " · retiré : " + gone.join(", ") : "") + (cut.length ? " · raccourci : " + cut.join(", ") : "");
  if (msg) toast(msg + side);
}

/** Plus aucune séance à l'unif dans la journée : les trajets vers / depuis les séances n'ont plus lieu d'être. */
function dropTrips(list) {
  if (list.some((x) => x.kind === "fixed" && x.type !== "PERSO")) return list;
  return list.filter((x) => !(x.kind === "travel" && (x.dir === "to" || x.dir === "back")));
}

export function itemName(it) {
  if (it.kind === "study") return mainTask(it)?.title || "Étude";
  if (it.kind === "fixed") return E.evLabel(it);
  if (it.kind === "exam") return it.title;
  return { pause: "Pause", bigpause: "Grande pause", lunch: "Déjeuner", dinner: "Dîner", sport: "Sport", travel: "Trajet", prep: "Préparation", settle: "Te poser", free: "Temps libre" }[it.kind] || "Créneau";
}

const unifEvent = (it) => it.kind === "fixed" && it.type !== "PERSO";

export const edit = {
  get on() { return !!state.editing; },
  toggle() {
    state.editing = !state.editing;
    state.sheet = null;
    askReset = false;
    notify();
  },
  canUndo: () => !!undo && undo.ds === state.date,
  undo() {
    if (!undo || undo.ds !== state.date) return;
    saveDay(undo.ds, { custom: undo.custom, ov: undo.ov, done: undo.done });
    undo = null;
    toast("Modification annulée");
  },
  get askReset() { return askReset; },
  askResetOn(on) { askReset = on; notify(); },
  reset() {
    const d = getDay(state.date) || {};
    undo = { ds: state.date, custom: d.custom, ov: d.ov, done: d.done };
    askReset = false;
    state.sheet = null;
    saveDay(state.date, { custom: undefined });
    toast("Plan automatique rétabli");
  },
  remove(res, it) {
    const list = listOf(res), c = find(list, it);
    if (!c) return;
    const next = E.editDay(list, { type: "remove", cid: c.cid });
    commit(res, unifEvent(it) ? dropTrips(next) : next, itemName(it) + " : supprimé", unifEvent(it) ? { [it.id]: false } : null);
    state.sheet = null;
  },
  /** Séance de l'unif : « j'y vais » (remise dans la journée) ou « je n'y vais pas » (retirée). */
  attend(res, ev) {
    const list = listOf(res), parts = list.filter((x) => x.kind === "fixed" && x.id === ev.id);
    // (séance coupée en deux par un ajout : toutes ses parties sortent de la journée)
    if (parts.length) return commit(res, dropTrips(parts.reduce((l, c) => E.editDay(l, { type: "remove", cid: c.cid }), list)), E.evLabel(ev) + " : tu n'y vas pas", { [ev.id]: false });
    const item = { kind: "fixed", id: ev.id, subj: ev.subj, type: ev.type, s: ev.s, e: ev.e, room: ev.room, theme: ev.theme, note: ev.note, key: "fixed#" + ev.id };
    const next = E.editDay(list, { type: "put", item });
    commit(res, next, E.evLabel(ev) + " : tu y vas", { [ev.id]: true }, next.find((x) => x.kind === "fixed" && x.id === ev.id)?.cid);
  },
  open(it, title) {
    const t = it.kind === "study" ? shownTasks(it) : [];
    const one = t.length === 1 ? t[0] : null;
    const subj = one ? (E.CUSTOM_SUBJECTS.includes(one.subj) ? one.subj : one.subj === "BIO2" ? "BIO" : "") : "";
    state.sheet = { cid: it.cid, key: it.key, s0: it.s, title, subj, label: one ? one.title : "", subj0: subj, label0: one ? one.title : "" };
    notify();
  },
  add(s, e) {
    state.sheet = { add: true, kind: "study", subj: "", label: "", s, e };
    notify();
  },
  close() {
    state.sheet = null;
    notify();
  }
};

// ---------- fiche de modification ----------
const DURS = [[30, "30 min"], [60, "1h"], [90, "1h30"], [120, "2h"]];
const KINDS = [["study", "Étude"], ["fixed", "Séance"], ["pause", "Pause"], ["meal", "Repas"]];
const hmOf = (t) => E.hm(((t % 1440) + 1440) % 1440);
const snap = (t) => Math.round(t / 5) * 5; // (champs au pas de 5 min)

function setDur(e, d) {
  const f = e.target.form, s = f.elements.s.value;
  if (!s) return;
  f.elements.e.value = hmOf(E.m(s) + d);
}

function submit(e, res, it) {
  e.preventDefault();
  const sh = state.sheet, f = new FormData(e.target);
  let s = E.m(String(f.get("s") || ""));
  const e0 = E.m(String(f.get("e") || ""));
  if (!Number.isFinite(s) || !Number.isFinite(e0)) return toast("Indique le début et la fin");
  // créneau après minuit (00:30 du lendemain) : il garde sa place en fin de journée
  const base = (sh.add ? sh.s : it.s) >= 1440 ? 1440 : 0;
  s += base;
  let end = e0 + base;
  if (end <= s && end - base < 360) end += 1440; // fin après minuit
  if (end - s < 5) return toast("La fin doit être après le début");
  const subj = String(f.get("subj") || ""), label = String(f.get("label") || "").trim();
  const list = listOf(res);
  if (sh.add) {
    const kind = sh.kind || "study";
    if (kind === "study" && !subj) return toast("Choisis une matière");
    if (subj === "AUTRE" && !label) return toast("Donne un nom (ex. Médecine)");
    if (kind === "fixed" && !label) return toast("Donne un nom à la séance");
    const next = E.editDay(list, { type: "add", kind, subj: subj || "AUTRE", label, s, e: end });
    commit(res, next, "Ajouté : " + E.hm(s) + "–" + hmOf(end), null, next.find((x) => !list.some((y) => y.cid === x.cid))?.cid);
  } else {
    const c = find(list, it);
    if (!c) return edit.close();
    const op = { type: "update", cid: c.cid, s, e: end };
    if (it.kind === "study" && subj && (subj !== sh.subj0 || label !== sh.label0)) {
      if (subj === "AUTRE" && !label) return toast("Donne un nom (ex. Médecine)");
      Object.assign(op, { subj, label });
    }
    if (it.kind === "fixed" && it.type === "PERSO") op.label = label;
    const next = E.editDay(list, op);
    // rien n'a changé : on ferme sans figer la journée
    if (JSON.stringify(next) === JSON.stringify(list)) return edit.close();
    commit(res, next, "Modifié : " + itemName(it), null, c.cid);
  }
  state.sheet = null;
  notify();
}

function subjectPicker(sh, it) {
  const multi = it && it.kind === "study" && shownTasks(it).length > 1;
  const pick = (v) => () => {
    sh.subj = v;
    // nouvelle matière : l'intitulé prévu ne correspond plus
    if (!sh.add) sh.label = v !== sh.subj0 ? "" : sh.label0;
    notify();
  };
  return html`
    <fieldset class="sh-f">
      <legend class="lbl">Matière</legend>
      <div class="subjs" role="radiogroup">
        ${multi ? html`<label class="sj keep ${sh.subj ? "" : "on"}"><input type="radio" name="subj" value="" .checked=${!sh.subj} @change=${pick("")}><span>Contenu prévu</span></label>` : nothing}
        ${E.CUSTOM_SUBJECTS.map((k) => html`
          <label class="sj ${sh.subj === k ? "on" : ""}" style="--c:${cv(k)}"><input type="radio" name="subj" value=${k} .checked=${sh.subj === k} @change=${pick(k)}><i></i><span>${E.customName(k)}</span></label>`)}
      </div>
      ${multi && !sh.subj ? html`<ul class="sh-tasks">${shownTasks(it).map((t) => html`<li style="--c:${cv(t.subj)}"><i></i>${t.title}<em>${t.min} min</em></li>`)}</ul>` : nothing}
    </fieldset>`;
}

export function editSheet(res) {
  const sh = state.sheet;
  if (!sh) return nothing;
  const it = sh.add ? null : res.items.find((x) => (sh.cid ? x.cid === sh.cid : x.key === sh.key && x.s === sh.s0));
  if (!sh.add && !it) return nothing;
  const kind = sh.add ? sh.kind : it.kind;
  const study = kind === "study", perso = sh.add ? kind === "fixed" : it.kind === "fixed" && it.type === "PERSO";
  const s = sh.add ? sh.s : it.s, e = sh.add ? sh.e : it.e;
  const title = sh.add ? "Ajouter un créneau" : sh.title || itemName(it);
  const labelPh = sh.subj === "AUTRE" ? "Nom (ex. Médecine)" : perso ? "Nom de la séance (ex. Cours de médecine)" : "Intitulé (facultatif) : exercices, chapitre 3…";
  return html`
    <div class="sheet-bg" @click=${edit.close}></div>
    <form class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="sheet-t" @submit=${(ev) => submit(ev, res, it)} @keydown=${(ev) => ev.key === "Escape" && edit.close()}>
      <div class="sh-h">
        <div><span class="lbl">${sh.add ? "Nouveau" : "Modifier"} · ${shortDay(state.date)}</span><h2 id="sheet-t">${title}</h2>
          ${it && it.kind === "fixed" && it.room ? html`<p class="sub">${it.room}</p>` : nothing}</div>
        <button type="button" class="nb" @click=${edit.close} aria-label="Fermer">${icons.close()}</button>
      </div>
      ${sh.add ? html`
        <div class="seg kinds" role="radiogroup" aria-label="Type de créneau">
          ${KINDS.map(([k, l]) => html`<button type="button" role="radio" aria-checked=${sh.kind === k ? "true" : "false"} @click=${() => { sh.kind = k; notify(); }}>${l}</button>`)}
        </div>
        <p class="sub sh-why">${kind === "pause" || kind === "meal" ? "Ne compte pas dans tes heures." : "Compte dans tes heures du jour et de la semaine."}</p>` : nothing}
      ${study || (sh.add && kind === "fixed") ? subjectPicker(sh, it) : nothing}
      ${study && (sh.subj || sh.add) || perso ? html`
        <label class="sh-f"><span class="lbl">${sh.subj === "AUTRE" || perso ? "Nom" : "Intitulé"}</span>
          <input type="text" name="label" maxlength="60" autocomplete="off" placeholder=${labelPh} .value=${perso && !sh.add ? it.title || "" : sh.label || ""} @input=${(ev) => { sh.label = ev.target.value; }}></label>` : nothing}
      <div class="sh-f">
        <span class="lbl">Heures</span>
        <div class="sh-times">
          <label>De <input type="time" name="s" step="300" required .value=${hmOf(snap(s))}></label>
          <label>à <input type="time" name="e" step="300" required .value=${hmOf(snap(e))}></label>
        </div>
        <div class="durs">${DURS.map(([d, l]) => html`<button type="button" class="chip" @click=${(ev) => setDur(ev, d)}>${l}</button>`)}</div>
      </div>
      <div class="sh-foot">
        ${it ? html`<button type="button" class="btn danger" @click=${() => edit.remove(res, it)}>${icons.trash()}<span>${unifEvent(it) ? "Je n'y vais pas" : "Supprimer"}</span></button>` : nothing}
        <span class="sp"></span>
        <button type="button" class="btn ghost" @click=${edit.close}>Annuler</button>
        <button type="submit" class="btn primary">${sh.add ? "Ajouter" : "Enregistrer"}</button>
      </div>
    </form>`;
}
