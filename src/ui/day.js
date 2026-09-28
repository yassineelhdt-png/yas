// Vue « Jour » : en-tête (lever, chiffres, progression), carte « Maintenant », frise, panneau latéral.
import { html, nothing, noChange } from "lit-html";
import { live } from "lit-html/directives/live.js";
import * as E from "../engine/index.js";
import { state, S, getDay, saveDay, toast } from "../store.js";
import { longDate, cv, mainTask, shownTasks, isDone } from "./format.js";
import { icons } from "./icons.js";
import { goalsCard } from "./goals.js";

const PILL = { SEM: "Séminaire", EX: "Exercices", TP: "TP", APPUI: "Appui", TEST: "Interro", INFO: "Infos", VISITE: "Copies", GUID: "Guidance", PERM: "Permanence", TH: "Théorie" };
const MAJOR = new Set(["study", "fixed", "exam"]);

// ---------- libellés ----------
const placeShort = (key) => E.PLACES[key]?.short || key;

function minorLabel(it, st, res = {}) {
  switch (it.kind) {
    case "prep":
      if (!it.long) return ["Réveil & préparation", "Eau, petit-déj, bureau prêt, téléphone en mode concentration"];
      if (res.startSet) return ["Avant de commencer", "Tu as choisi de commencer à " + E.hm(res.start)];
      return ["Avant de partir", res.placeInfo ? res.placeInfo.short + " ouvre à " + E.hm(res.placeInfo.open) : ""];
    case "pause": return ["Pause", "Debout, eau, loin des écrans"];
    case "bigpause": return ["Grande pause", "Marche dehors ou collation"];
    case "lunch": return ["Déjeuner" + (it.loc === "campus" ? " · campus" : ""), it.note || ""];
    case "dinner": return ["Dîner", ""];
    case "sport": return ["Sport + douche", st.sport + " min de sport, puis la douche · dernier truc de la journée"];
    case "travel":
      if (it.dir === "home" && it.closing) return ["Départ : " + placeShort(res.place) + " ferme", "Retour à la maison, tu continues là-bas"];
      if (it.dir === "home" && it.leave) return ["Retour à la maison", "Le trajet te sert de pause : tu finis la journée à la maison"];
      if (it.dir === "home") return ["Retour à la maison", "Sport en rentrant"];
      if (it.dir === "place") return ["Trajet vers " + placeShort(it.at), it.at === "erasme" ? "Tu restes sur place entre les cours" : ""];
      if (it.dir === "back" && it.at) return ["Trajet vers " + placeShort(it.at), "Après les séances"];
      if (it.dir !== "to") return ["Retour", "Anki sur le téléphone possible (non compté)"];
      return ["Trajet vers Erasme", (it.dest ? it.destLabel + " · " + it.dest : "") + (it.snack ? ". Prends une collation : tu mangeras après les séances" : "") + (it.late ? ". Pars tout de suite" : "")];
    case "settle": return ["Te poser à la maison", "Douche rapide, bureau prêt, puis tu reprends"];
    case "free":
      if (it.slack) return ["Temps libre", "De la marge pour finir à l'heure : repos, marche, appel…"];
      return [it.done ? "Libre" : "Transition", it.note || (it.done ? "Ton quota du jour est atteint" : "Range, prépare tes affaires")];
  }
  return [it.kind, ""];
}

/** Titre court d'un créneau, quel que soit son type */
function itemTitle(it, st, res) {
  if (it.kind === "study") return mainTask(it)?.title || "Étude";
  if (it.kind === "exam") return it.title;
  if (it.kind === "fixed") return E.evLabel(it);
  return minorLabel(it, st, res)[0];
}

function itemColor(it) {
  if (it.kind === "study") return cv(mainTask(it)?.subj || it.subj);
  if (it.kind === "fixed" || it.kind === "exam") return cv(it.subj);
  if (it.kind === "sport") return "var(--c-sport)";
  return "var(--c-break)";
}

function modeText(res) {
  if (res.mode === "concours") return "Concours blanc" + (res.ethique ? " + éthique" : "");
  if (res.mode === "samedi") return "Chimie Q2 + rattrapage";
  if (res.mode === "conge") return res.closed || "Congé";
  return res.blocus ? "Blocus" : "Semaine de cours";
}

// ---------- champs d'heure ----------
// On enregistre une fois la saisie finie (sortie du champ, Entrée, ou 1,2 s sans rien taper), pas à
// chaque chiffre : sur PC, taper « 1005 » passe par 01:00 puis 10:00, ce qui décalait tout le plan.
const timers = new WeakMap();
function timeField(id, value, commit) {
  const fire = (el) => {
    clearTimeout(timers.get(el));
    timers.delete(el);
    if (el.value) commit(el.value);
  };
  const later = (e) => {
    const el = e.target;
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(() => fire(el), 1200));
  };
  return html`<input type="time" id=${id} step="300" .value=${document.activeElement?.id === id ? noChange : live(value)}
    @change=${later} @blur=${(e) => timers.has(e.target) && fire(e.target)} @keydown=${(e) => e.key === "Enter" && fire(e.target)}>`;
}

// ---------- actions ----------
const act = {
  wake(value) {
    const d = getDay(state.date) || {};
    if (!value || value === (d.wake || S().wake)) return;
    const patch = { wake: value };
    if (d.start && E.m(d.start) < E.m(value)) patch.start = undefined;
    saveDay(state.date, patch);
  },
  start(value) {
    if (!value || value === (getDay(state.date) || {}).start) return;
    saveDay(state.date, { start: value, replan: undefined });
    toast("Programme calé sur " + value);
  },
  wakeNow() {
    const n = Math.floor(E.nowMin() / 5) * 5, d = getDay(state.date) || {}, patch = { wake: E.hm(n), replan: undefined };
    if (d.start && E.m(d.start) < n) patch.start = undefined;
    saveDay(state.date, patch);
    toast("Levé à " + E.hm(n) + " : journée calculée");
  },
  startNow() {
    const n = Math.min(Math.ceil(E.nowMin() / 5) * 5, 1435); // pas « 00:00 » à 23:58
    saveDay(state.date, { start: E.hm(n), replan: undefined });
    toast("Programme calé sur " + E.hm(n));
  },
  end(value) {
    if (!value || value === (getDay(state.date) || {}).end) return;
    saveDay(state.date, { end: value });
    toast("Fin calée sur " + value);
  },
  endAuto() {
    saveDay(state.date, { end: undefined });
    const st = S();
    toast(st.endAt ? "Fin automatique : " + st.endAt : "Fin automatique : dès que l'objectif est atteint");
  },
  startAuto() {
    saveDay(state.date, { start: undefined });
    toast("Début automatique : lever + " + S().prep + " min");
  },
  toggleDone(it) {
    const done = { ...(getDay(state.date) || {}).done };
    if (isDone(done, it)) {
      delete done[it.key];
      if (it.legacyKey) delete done[it.legacyKey];
    } else {
      done[it.key] = true;
      navigator.vibrate?.(12);
    }
    saveDay(state.date, { done });
  },
  toggleEvent(ev) {
    const ov = { ...(getDay(state.date) || {}).ov };
    ov[ev.id] = !ev.attend;
    saveDay(state.date, { ov });
  },
  toggleEthique(on) { saveDay(state.date, { ethique: !on }); },
  setPlace(key) {
    saveDay(state.date, { place: key, lib: undefined });
    toast(key === "maison" ? "Journée à la maison" : "Journée à " + E.PLACES[key].short);
  },
  placeAuto() {
    saveDay(state.date, { place: undefined, lib: undefined });
    toast("Lieu habituel rétabli");
  },
  replanClear() {
    state.replanOpen = false;
    saveDay(state.date, { replan: undefined });
    toast("Plan initial rétabli");
  },
  replanSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get("at")) return toast("Indique l'heure de reprise");
    const at = E.m(f.get("at"));
    const studied = (+f.get("h") || 0) * 60 + (+f.get("m") || 0);
    state.replanOpen = false;
    saveDay(state.date, { replan: { at, studied, lunch: f.has("lunch"), sport: f.has("sport"), dinner: f.has("dinner") } });
    toast("Suite de la journée recalculée");
  }
};

/** Valeurs proposées dans le formulaire de replanification */
function replanDefaults(res, at, done) {
  let studied = res.replanStudied || 0;
  const any = res.items.some((it) => it.counts && isDone(done, it));
  for (const it of res.items) {
    if (!it.counts || it.s >= at) continue;
    // si des créneaux sont cochés, on ne compte que ceux-là ; sinon tout ce qui est passé
    if (!any || isDone(done, it)) studied += Math.min(it.e, at) - it.s;
  }
  const did = (k) => res.items.some((it) => it.kind === k && it.e <= at);
  return { studied, lunch: did("lunch"), sport: did("sport"), dinner: did("dinner") };
}

// ---------- morceaux de la vue ----------
function nowCard(res, st, nm) {
  const items = res.items.filter((it) => it.e > it.s && !it.past);
  if (!items.length) return nothing;
  const cur = items.find((it) => nm >= it.s && nm < it.e);
  const next = items.find((it) => it.s >= (cur ? cur.e : nm) && it !== cur);
  let body;
  if (cur) {
    const left = cur.e - nm, pct = ((nm - cur.s) / (cur.e - cur.s)) * 100;
    const sub = cur.kind === "fixed" ? cur.room : cur.kind === "study" ? mainTask(cur)?.detail : cur.kind === "exam" ? cur.detail : minorLabel(cur, st, res)[1];
    body = html`
      <div class="now-l1"><span class="now-kicker">En ce moment</span><span class="now-left mono">encore ${E.dur(left)}</span></div>
      <div class="now-title">${itemTitle(cur, st, res)}</div>
      ${sub ? html`<div class="now-sub">${sub}</div>` : nothing}
      <div class="now-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="now-times mono"><span>${E.hm(cur.s)}</span><span>${E.hm(cur.e)}</span></div>`;
  } else if (nm < items[0].s) {
    body = html`
      <div class="now-l1"><span class="now-kicker">Pas encore commencé</span><span class="now-left mono">dans ${E.dur(items[0].s - nm)}</span></div>
      <div class="now-title">${itemTitle(items[0], st, res)} à ${E.hm(items[0].s)}</div>`;
  } else {
    body = html`
      <div class="now-l1"><span class="now-kicker">Journée terminée</span></div>
      <div class="now-title">${E.hdur(res.net)} nettes au programme. Bravo.</div>`;
  }
  const c = cur ? itemColor(cur) : "var(--accent)";
  return html`
    <button class="card nowcard" style="--c:${c}" @click=${() => document.querySelector(".row.now, .row.next")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
      ${body}
      ${next && cur ? html`<div class="now-next"><span class="lbl">Ensuite</span> <b>${itemTitle(next, st, res)}</b> <span class="mono">${E.hm(next.s)}</span></div>` : nothing}
    </button>`;
}

function header(res, st, ctx) {
  const { ds, isToday, doneMin, target, bed } = ctx;
  const weekTxt = res.week >= 3 && res.week <= 16 ? "S" + res.week : "";
  const pct = Math.min(100, (doneMin / target) * 100);
  const blocs = Object.keys(res.blocs);
  return html`
    <section class="dayhead">
      <div class="datenav">
        <h1>${longDate(ds)}</h1>
        <div class="navbtns">
          <button class="nb" @click=${() => ctx.go(-1)} aria-label="Jour précédent" title="Jour précédent (←)">${icons.prev()}</button>
          <button class="nb" @click=${() => ctx.go(1)} aria-label="Jour suivant" title="Jour suivant (→)">${icons.next()}</button>
          ${isToday ? nothing : html`<button class="btn ghost" @click=${() => ctx.go(0)}>Aujourd'hui</button>`}
        </div>
        <div class="chips">
          ${weekTxt ? html`<span class="chip mono">${weekTxt}</span>` : nothing}
          <span class="chip mode-${res.mode}">${modeText(res)}</span>
        </div>
      </div>
      ${isToday ? nowCard(res, st, ctx.nm) : nothing}
      <div class="wake card">
        <div class="times">
          <label><span class="lbl">Levé à</span>${timeField("t-wake", E.hm(res.wake), act.wake)}</label>
          <label><span class="lbl">Je commence à</span>${timeField("t-start", E.hm(res.start), act.start)}</label>
          <label><span class="lbl">Je finis à</span>${timeField("t-end", E.hm(res.endAt ?? res.workEnd), act.end)}</label>
          <span class="auto">
            <span>Début ${res.startSet ? html`<button class="linkbtn" @click=${act.startAuto}>remettre en auto</button>` : "auto : lever + " + st.prep + " min" + (res.place !== "maison" ? " + trajet" : "")}</span>
            <span>Fin ${res.endSet ? html`<button class="linkbtn" @click=${act.endAuto}>remettre en auto</button>` : st.endAt ? "auto : " + st.endAt + " (réglages)" : "auto : objectif atteint"}</span>
          </span>
        </div>
        ${isToday ? html`<div class="wbtns"><button class="btn primary" @click=${act.wakeNow}>Je viens de me lever</button><button class="btn" @click=${act.startNow}>Je commence<span class="wide"> maintenant</span></button></div>` : nothing}
        <div class="facts">
          <div class="fact wide"><span class="lbl">Début</span><b>${res.studyStart < 1e9 ? E.hm(res.studyStart) : "—"}</b></div>
          <div class="fact wide"><span class="lbl">Fin</span><b>${E.hm(res.workEnd)}</b></div>
          <div class="fact"><span class="lbl">Net</span><b>${E.hdur(res.net)}</b></div>
          <div class="fact"><span class="lbl">Coucher</span><b>${E.hm(bed)}</b></div>
        </div>
        <div class="meter">
          <div class="row1"><span><b class="mono">${E.hdur(doneMin)}</b> cochées sur ${E.hdur(target)}</span><span>${doneMin >= target ? "Objectif atteint" : "reste " + E.hdur(target - doneMin)}</span></div>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${target} aria-valuenow=${doneMin}><span style="width:${pct.toFixed(1)}%"></span></div>
        </div>
      </div>
      ${blocs.length ? html`<div class="blocsum">${blocs.map((k) => html`<span>Bloc ${k} <b>${E.hdur(res.blocs[k])}</b></span>`)}</div>` : nothing}
      ${res.warnings.length ? html`<div class="warnbox" role="alert">${res.warnings.map((w) => html`<span>${w}</span>`)}</div>` : nothing}
      ${res.notes?.length ? html`<div class="notebox">${res.notes.map((n) => html`<span>${n}</span>`)}</div>` : nothing}
    </section>`;
}

/** Session d'une seule tâche : le titre suffit, on montre seulement la consigne (et « Objectif »). */
function taskDetail(t) {
  if (!t.detail && t.kind !== "goal") return nothing;
  return html`<div class="meta detail">${t.kind === "goal" ? html`<b class="gpill" style="--c:${cv(t.subj)}">Objectif</b>` : nothing}${t.detail ? html`<span>${t.detail}</span>` : nothing}</div>`;
}

function row(it, res, st, ctx, flags) {
  const d = it.e - it.s, major = MAJOR.has(it.kind);
  const done = isDone(ctx.done, it);
  const isNow = ctx.isToday && ctx.nm >= it.s && ctx.nm < it.e && !it.past;
  const cls = ["row", "k-" + it.kind, major ? "major" : "minor"];
  if (it.past) cls.push("past");
  if (isNow) cls.push("now");
  if (flags.next) cls.push("next");
  if (major && done) cls.push("done");
  const railH = major ? Math.max(40, Math.round(d * 0.95)) : Math.max(14, Math.round(d * 0.5));
  const progress = isNow ? (((ctx.nm - it.s) / d) * 100).toFixed(1) + "%" : "0%";

  let body;
  if (major) {
    const meta = [];
    let pill = nothing;
    if (it.kind === "exam") pill = html`<span class="pill">${it.subj === "CONC" ? "Concours" : "Partie 2"}</span>`;
    else if (it.kind === "fixed") {
      pill = html`<span class="pill">${PILL[it.type] || it.type}</span>`;
      const sub = E.H.subjects[it.subj];
      if (sub) meta.push(html`<span class="mono">${sub.code}</span>`);
      if (it.note && it.type !== "TH") meta.push(it.note);
      if (it.moved) meta.push("déplacé : jour habituel fermé");
      if (it.late) meta.push("tu arrives en cours de séance");
      if (it.missed) meta.push("manqué");
    }
    const metaHtml = meta.map((x) => html`<span>${x}</span>`);
    body = html`
      <div class="l1">
        <div class="ttl">${itemTitle(it, st, res)}</div>
        ${isNow ? html`<span class="nowtag">En cours</span>` : nothing}
        <span class="len">${E.dur(d)}</span>
        ${!it.past && !it.missed ? html`<button class="chk" aria-pressed=${done ? "true" : "false"} aria-label=${"Fait : " + itemTitle(it, st, res)} @click=${() => act.toggleDone(it)}>${icons.check()}</button>` : nothing}
      </div>
      ${it.kind === "fixed"
        ? html`<div class="where">${pill}<span class="lbl">Local</span><b>${it.room || "non indiqué"}</b></div>${meta.length ? html`<div class="meta">${metaHtml}</div>` : nothing}`
        : pill !== nothing || meta.length ? html`<div class="meta">${pill}${metaHtml}</div>` : nothing}
      ${it.kind === "study" && it.tasks && shownTasks(it).length === 1
        ? html`${taskDetail(shownTasks(it)[0])}${it.note ? html`<div class="note">${it.note}</div>` : nothing}
          ${it.loc === "campus" ? html`<div class="note">Sur le campus : bibliothèque ou salle d'étude</div>` : nothing}`
        : it.kind === "study" && it.tasks
        ? html`<ul class="tasks">${shownTasks(it).map((t) => html`<li style="--c:${cv(t.subj)}" class=${t.kind === "goal" ? "goal-task" : ""}><i></i><span>${t.title}${t.kind === "goal" ? html` <b class="gpill">Objectif</b>` : nothing}</span><em>${t.min} min</em>${t.detail ? html`<small>${t.detail}</small>` : nothing}</li>`)}</ul>
          ${it.note ? html`<div class="note">${it.note}</div>` : nothing}
          ${it.loc === "campus" ? html`<div class="note">Sur le campus : bibliothèque ou salle d'étude</div>` : nothing}`
        : nothing}
      ${it.kind === "exam" && it.detail ? html`<div class="meta detail"><span>${it.detail}</span></div>` : nothing}`;
  } else {
    const [title, sub] = minorLabel(it, st, res);
    body = html`<b>${title}</b><span class="mono dur">${E.dur(d)}</span>${isNow ? html`<span class="nowtag">Maintenant</span>` : nothing}${sub ? html`<small>${sub}</small>` : nothing}`;
  }
  return html`
    <div class=${cls.join(" ")} style="--c:${itemColor(it)};--p:${progress}">
      <div class="tm"><span>${E.hm(it.s)}</span>${major ? html`<span class="te">${E.hm(it.e)}</span>` : nothing}</div>
      <div class="rail" style="--h:${railH}px"></div>
      <div class="body">${body}</div>
    </div>`;
}

/** « , puis retour à la maison et sport jusqu'à 21:45 » : seulement ce qui vient vraiment après le programme. */
function endText(res) {
  const after = res.items.filter((it) => it.s >= res.workEnd && it.e > it.s);
  const home = after.some((it) => it.kind === "travel" && it.dir === "home");
  const sport = after.some((it) => it.kind === "sport");
  if (!home && !sport) return "";
  return ", puis " + [home && "retour à la maison", sport && "sport"].filter(Boolean).join(" et ") + " jusqu'à " + E.hm(res.end);
}

function timeline(res, st, ctx) {
  const out = [];
  let curBloc = -1;
  // prochain créneau à venir (pour la carte « Maintenant » quand rien n'est en cours)
  const nextIdx = ctx.isToday && !res.items.some((it) => ctx.nm >= it.s && ctx.nm < it.e && !it.past) ? res.items.findIndex((it) => it.s > ctx.nm && !it.past) : -1;
  res.items.forEach((it, i) => {
    if (it.kind === "replan") {
      out.push(html`<div class="replan-line">Replanifié à ${E.hm(it.s)} · ${E.hdur(it.studied)} déjà faites</div>`);
      curBloc = -1;
      return;
    }
    if (it.counts && it.bloc && it.bloc !== curBloc) {
      curBloc = it.bloc;
      out.push(html`<div class="bloc-h">Bloc ${it.bloc} <small>${E.hdur(res.blocs[it.bloc])} nettes</small></div>`);
    }
    out.push(row(it, res, st, ctx, { next: i === nextIdx }));
  });
  return html`
    <div class="tl">
      ${out}
      <div class="endrow">
        <b>${E.hm(res.workEnd)} · programme terminé</b>
        <span>${E.hdur(res.net)} nettes${endText(res)}. Coucher conseillé vers ${E.hm(ctx.bed)} pour ${st.sleepH}h de sommeil (lever ${E.hm(ctx.nextWake)} demain).</span>
      </div>
    </div>`;
}

function aside(res, st, ctx) {
  const { day, isToday, nm } = ctx;
  const cards = [];
  if (isToday || day.replan) {
    let inner;
    if (state.replanOpen) {
      const at = Math.max(res.start, isToday ? Math.floor(nm / 5) * 5 : day.replan ? day.replan.at : res.studyStart);
      const dflt = replanDefaults(res, at, ctx.done), s5 = Math.round(dflt.studied / 5) * 5;
      inner = html`
        <form class="rp" @submit=${act.replanSubmit}>
          <div class="f"><label>Reprise à <input type="time" name="at" step="300" required min=${E.hm(res.start)} value=${E.hm(at)}></label></div>
          <div class="f"><span>Déjà étudié</span>
            <input type="number" name="h" min="0" max="14" inputmode="numeric" value=${Math.floor(s5 / 60)} aria-label="Heures"> h
            <input type="number" name="m" min="0" max="55" step="5" inputmode="numeric" value=${s5 % 60} aria-label="Minutes"> min</div>
          <div class="f">
            <label class="ck"><input type="checkbox" name="lunch" ?checked=${dflt.lunch}> Déjeuner pris</label>
            <label class="ck"><input type="checkbox" name="sport" ?checked=${dflt.sport}> Sport fait</label>
            <label class="ck"><input type="checkbox" name="dinner" ?checked=${dflt.dinner}> Dîner pris</label>
          </div>
          <div class="f"><button class="btn primary" type="submit">Replanifier</button><button class="btn ghost" type="button" @click=${() => ctx.setReplanOpen(false)}>Fermer</button></div>
        </form>`;
    } else {
      inner = html`<div class="btnrow"><button class="btn primary" @click=${() => ctx.setReplanOpen(true)}>Replanifier depuis maintenant</button>${day.replan ? html`<button class="btn ghost" @click=${act.replanClear}>Revenir au plan initial</button>` : nothing}</div>`;
    }
    cards.push(html`<div class="card"><h2>Pris du retard ?</h2><p class="sub">Recalcule la suite de la journée à partir de maintenant, sans perdre ce qui est déjà fait.</p>${inner}</div>`);
  }
  const P = res.placeInfo;
  cards.push(html`
    <div class="card placecard"><h2>Où tu travailles</h2>
      <div class="seg places" role="radiogroup" aria-label="Lieu de travail">
        ${E.PLACE_KEYS.map((k) => html`<button role="radio" aria-checked=${res.place === k ? "true" : "false"} @click=${() => k !== res.place && act.setPlace(k)}>${E.PLACES[k].short}</button>`)}
      </div>
      <p class="sub">${P
        ? html`${P.name} · ouvert ${E.hm(P.open)}–${E.hm(P.close)} · trajet ${P.travel} min.
            ${P.campus ? " Tu restes sur place entre les cours." : " Les séances à Erasme ont leurs propres trajets."}`
        : "À la maison : trajets seulement pour les séances à l'unif."}
        ${res.placeSet ? html`<br><button class="linkbtn" @click=${act.placeAuto}>Revenir au lieu habituel</button>` : nothing}</p>
    </div>`);
  if (ctx.week) cards.push(goalsCard(ctx.week, { onEdit: ctx.editGoals, compact: true, day: ctx.ds }));
  if (res.mode === "concours") {
    cards.push(html`
      <div class="card"><h2>Dimanche concours</h2><p class="sub">Éthique & empathie : un dimanche sur ${st.ethiqueEvery}. Le raisonnement, tous les dimanches.</p>
        <div class="ev" style="--c:var(--c-eth)"><div class="t"><i></i>Partie éthique & empathie</div>
          <div class="d">${st.ethique} min après le raisonnement${typeof day.ethique === "boolean" ? " · réglé à la main" : " · selon le cycle"}</div>
          <button class="sw" role="switch" aria-checked=${res.ethique ? "true" : "false"} aria-label="Partie éthique ce dimanche" @click=${() => act.toggleEthique(res.ethique)}></button></div>
      </div>`);
  }
  if (res.events.length) {
    cards.push(html`
      <div class="card"><h2>Séances à l'unif</h2><p class="sub">Active ce à quoi tu vas : le plan se recalcule et le compte des 9h aussi.</p>
        ${res.events.map((ev) => {
          let desc = E.hm(ev.s) + "–" + E.hm(ev.e) + (ev.room ? " · " + ev.room : "");
          if (ev.type === "TH") desc += " · facultatif";
          if (ev.vete) desc += " · créneau partagé VETE";
          if (ev.assumed) desc += " · horaire supposé";
          if ((ev.type === "GUID" || ev.type === "PERM") && !ev.def) desc += " · autre créneau possible";
          return html`<div class="ev ${ev.attend ? "" : "off"}" style="--c:${cv(ev.subj)}"><div class="t"><i></i>${E.evLabel(ev)}</div><div class="d">${desc}</div>
            <button class="sw" role="switch" aria-checked=${ev.attend ? "true" : "false"} aria-label="J'y vais : ${E.evLabel(ev)}" @click=${() => act.toggleEvent(ev)}></button></div>`;
        })}
      </div>`);
  } else if (res.mode === "semaine" || res.mode === "conge") {
    const where = P ? "à " + P.short : "à la maison";
    cards.push(html`<div class="card"><h2>Pas de séance ${isToday ? "aujourd'hui" : "ce jour-là"}</h2><p class="sub">Journée complète ${where} : ${E.hdur(res.net)} d'étude perso.</p></div>`);
  }
  if (res.backlogCarried?.length && res.mode !== "samedi") {
    cards.push(html`
      <div class="card"><h2>Reporté à demain</h2><p class="sub">Ce qui n'a pas tenu aujourd'hui passe en tête de demain (puis au samedi).</p>
        ${res.backlogCarried.map((b) => html`<div class="ev" style="--c:${cv(b.subj)}"><div class="t"><i></i>${b.title}</div><div class="d">${b.min} min restantes</div></div>`)}
      </div>`);
  }
  return html`<aside class="aside">${cards}</aside>`;
}

// ---------- vue ----------
export function dayView(res, nav, week) {
  const st = S(), ds = state.date, day = getDay(ds) || {}, done = day.done || {};
  // programme qui déborde après minuit : la veille reste « aujourd'hui » jusqu'à sa fin
  const today = E.todayStr(), now = E.nowMin();
  const lateEve = ds === E.addDays(today, -1) && now < 360 && res.end > 1440 + now;
  const isToday = ds === today || lateEve, nm = lateEve ? now + 1440 : now;
  let doneMin = res.replanStudied || 0;
  for (const it of res.items) if (it.counts && isDone(done, it)) doneMin += it.e - it.s;
  const nextWake = E.m((getDay(E.addDays(ds, 1)) || {}).wake || st.wake);
  const ctx = {
    ds, day, done, isToday, nm, doneMin, target: st.targetH * 60, nextWake, bed: nextWake - st.sleepH * 60,
    go: nav.go, setReplanOpen: nav.setReplanOpen, week, editGoals: nav.editGoals
  };
  return html`
    ${header(res, st, ctx)}
    <div class="daygrid">
      ${timeline(res, st, ctx)}
      ${aside(res, st, ctx)}
    </div>`;
}
