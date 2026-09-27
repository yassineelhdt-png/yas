// Progression des objectifs de la semaine (vues Jour et Semaine).
import { html, nothing } from "lit-html";
import * as E from "../engine/index.js";
import { S, getDay } from "../store.js";
import { cv } from "./format.js";

/** Pour chaque objectif de la semaine : temps visé, planifié et coché (sessions marquées faites). */
export function goalProgress(week) {
  const list = E.goalsOfWeek(week[0].date, S());
  const byId = new Map(list.map((g) => [g.id, { g, target: Math.max(1, Math.round(+g.count || 1)) * Math.round((+g.hours || 0) * 60), planned: 0, done: 0, today: 0 }]));
  const today = E.todayStr();
  for (const r of week) {
    const done = (getDay(r.date) || {}).done || {};
    for (const it of r.items) {
      for (const t of it.tasks || []) {
        const p = t.kind === "goal" && byId.get(t.gid);
        if (!p) continue;
        p.planned += t.min;
        if (done[it.key]) p.done += t.min;
        if (r.date === today) p.today += t.min;
      }
    }
  }
  return [...byId.values()].filter((p) => p.target > 0);
}

/** Nom lisible d'un objectif : « 2 × Annale de chimie · 4h » */
export function goalName(g) {
  const count = Math.max(1, Math.round(+g.count || 1));
  const kind = E.GOAL_KINDS[g.kind] || E.GOAL_KINDS.autre;
  const subj = (E.SUBJ[g.subj] || g.subj).toLowerCase();
  const what = g.kind === "autre" ? g.label || "Objectif · " + subj : kind.name + " · " + subj + (g.label ? " · " + g.label : "");
  return (count > 1 ? count + " × " : "") + what + " · " + E.dur(Math.round((+g.hours || 0) * 60));
}

/** Carte « Objectifs de la semaine ». */
export function goalsCard(week, { onEdit, compact = false } = {}) {
  const prog = goalProgress(week);
  const wn = E.weekNo(week[0].date);
  const own = !!(S().goals?.weeks || {})[week[0].date];
  return html`
    <div class="card goalcard">
      <div class="goal-h"><h2>Objectifs de la semaine</h2>${onEdit ? html`<button class="linkbtn" @click=${onEdit}>Modifier</button>` : nothing}</div>
      <p class="sub">${wn >= 3 && wn <= 16 ? "S" + wn + " · " : ""}${own ? "objectifs propres à cette semaine" : "objectifs habituels"}. Placés sur ton temps libre, jamais pendant les séances.</p>
      ${prog.length ? prog.map((p) => {
        const miss = p.target - p.planned;
        return html`
          <div class="goal" style="--c:${cv(p.g.subj)}">
            <div class="goal-l1"><span>${goalName(p.g)}</span><em class="mono">${E.hdur(p.planned)} / ${E.hdur(p.target)}</em></div>
            <div class="goal-bar"><span class="pl" style="width:${Math.min(100, (p.planned / p.target) * 100).toFixed(1)}%"></span><span class="dn" style="width:${Math.min(100, (p.done / p.target) * 100).toFixed(1)}%"></span></div>
            ${compact ? (p.today ? html`<small>Aujourd'hui : ${E.hdur(p.today)}</small>` : nothing)
              : html`<small>${E.hdur(p.done)} cochées${miss > 0 ? " · il manque " + E.hdur(miss) + " de temps libre cette semaine" : ""}</small>`}
          </div>`;
      }) : html`<p class="sub">Aucun objectif pour cette semaine.</p>`}
    </div>`;
}
