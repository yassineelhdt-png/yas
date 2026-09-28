// Vue « Semaine » : agenda des 7 jours, répartition par matière, séances suivies.
import { html, nothing } from "lit-html";
import * as E from "../engine/index.js";
import { cv, shortDay, dayMonth, mainTask } from "./format.js";
import { icons } from "./icons.js";
import { goalsCard } from "./goals.js";

const HR = 38; // hauteur d'une heure (px)
const TOTAL_ORDER = ["CHIM", "PHYS", "MATH", "BIO", "CHQ2", "CONC", "RAIS", "ETH", "REV", "MEDIG"];
const NAMES = { CHIM: "Chimie", PHYS: "Physique", MATH: "Maths", BIO: "Bio", CHQ2: "Chimie Q2", CONC: "Concours", RAIS: "Raisonnement", ETH: "Éthique", REV: "Révision", MEDIG: "MEDIG" };

function block(it, y) {
  if (it.kind === "replan" || it.e <= it.s) return nothing;
  const top = y(it.s), ht = Math.max(2, y(it.e) - top - 1);
  let cls = "blk", lab = "", sub = "", c = "var(--c-break)";
  if (it.kind === "study") {
    const t = mainTask(it);
    c = cv(t ? t.subj : it.subj);
    lab = t ? t.title : "";
  } else if (it.kind === "fixed") {
    cls += " fx"; c = cv(it.subj); lab = E.evLabel(it); sub = (it.room || "").split(" · ")[0];
  } else if (it.kind === "exam") {
    cls += " fx"; c = cv(it.subj); lab = it.title;
  } else if (it.kind === "sport") {
    cls += " sp"; lab = "Sport";
  } else {
    cls += " brk";
    lab = it.kind === "lunch" ? "Déjeuner" : it.kind === "dinner" ? "Dîner" : it.kind === "travel" ? "Trajet" : "";
  }
  const tip = E.hm(it.s) + "–" + E.hm(it.e) + " " + lab + (sub ? " · " + sub : "");
  let text = nothing;
  if (ht >= 20) text = ht >= 34 && sub ? html`${lab}<small>${sub}</small>` : sub ? lab + " · " + sub : lab;
  // --l : lignes de texte qui tiennent dans le bloc (12,6 px par ligne)
  const lines = Math.max(1, Math.floor((ht - 4) / 12.6));
  return html`<div class=${cls} style="top:${top.toFixed(1)}px;height:${ht.toFixed(1)}px;--c:${c};--l:${lines}" title=${tip}>${text}</div>`;
}

export function weekView(week, nav) {
  const mon = week[0].date, sun = week[6].date, today = E.todayStr(), nm = E.nowMin();
  let minS = 1440, maxE = 0;
  for (const r of week) for (const it of r.items) { minS = Math.min(minS, it.s); maxE = Math.max(maxE, it.e); }
  const h0 = Math.floor(minS / 60), h1 = Math.ceil(maxE / 60), H = (h1 - h0) * HR;
  const y = (x) => ((x - h0 * 60) / 60) * HR;
  const wn = E.weekNo(mon);

  const hours = [];
  for (let k = h0; k <= h1; k++) hours.push(html`<span style="top:${(k - h0) * HR}px">${String(k % 24).padStart(2, "0")}h</span>`);

  // totaux
  const tot = {};
  let net = 0, fixed = 0;
  for (const r of week) {
    net += r.net;
    for (const [k, v] of Object.entries(r.bySubject)) tot[k] = (tot[k] || 0) + v;
    for (const it of r.items) if (it.kind === "fixed" && it.counts) fixed += it.e - it.s;
  }
  const mx = Math.max(1, ...TOTAL_ORDER.map((k) => tot[k] || 0));
  const seances = week.flatMap((r) => r.items.filter((it) => it.kind === "fixed").map((it) => html`
    <div class="ev" style="--c:${cv(it.subj)}"><div class="t"><i></i>${E.evLabel(it)}</div><div class="d">${shortDay(r.date)} · ${E.hm(it.s)}–${E.hm(it.e)}${it.room ? " · " + it.room : ""}</div></div>`));

  return html`
    <div class="weekhead">
      <h1>${dayMonth(mon)} → ${dayMonth(sun)}</h1>
      <div class="navbtns">
        <button class="nb" @click=${() => nav.go(-7)} aria-label="Semaine précédente" title="Semaine précédente (←)">${icons.prev()}</button>
        <button class="nb" @click=${() => nav.go(7)} aria-label="Semaine suivante" title="Semaine suivante (→)">${icons.next()}</button>
        ${today >= mon && today <= sun ? nothing : html`<button class="btn ghost" @click=${() => nav.go(0)}>Cette semaine</button>`}
      </div>
      ${wn >= 3 && wn <= 16 ? html`<span class="chip mono">S${wn}</span>` : nothing}
    </div>
    <div class="wscroll card">
      <div class="wgrid" style="--hr:${HR}px">
        <div class="corner"></div>
        ${week.map((r) => html`
          <div class="whead ${r.date === today ? "today" : ""}">
            <button @click=${() => nav.openDay(r.date)}>${shortDay(r.date)}<small>${E.hm(r.studyStart < 1e9 ? r.studyStart : r.start)} → ${E.hm(r.workEnd)}</small></button>
          </div>`)}
        <div class="hours" style="height:${H}px">${hours}</div>
        ${week.map((r) => html`
          <div class="track ${r.date === today ? "today" : ""}" style="height:${H}px">
            ${r.items.map((it) => block(it, y))}
            ${r.date === today && nm >= h0 * 60 && nm <= h1 * 60 ? html`<div class="nowline" style="top:${y(nm).toFixed(1)}px"></div>` : nothing}
          </div>`)}
      </div>
      <div class="legend">
        ${TOTAL_ORDER.filter((k) => tot[k]).map((k) => html`<span style="--c:${cv(k)}"><i></i>${NAMES[k]}</span>`)}
        <span style="--c:var(--c-sport)"><i></i>Sport</span>
        <span>Bloc plein = séance à l'unif</span>
      </div>
    </div>
    <div class="wcards">
      ${goalsCard(week, { onEdit: nav.editGoals })}
      <div class="card">
        <h2>Répartition de la semaine</h2>
        <p class="sub">${E.hdur(net)} nettes au total, dont ${E.hdur(fixed)} en séances à l'unif.</p>
        <div class="totals">
          ${TOTAL_ORDER.filter((k) => tot[k]).map((k) => html`
            <div class="tot" style="--c:${cv(k)}"><span>${NAMES[k]}</span><div class="b"><span style="width:${((tot[k] / mx) * 100).toFixed(1)}%"></span></div><em>${E.hdur(tot[k])}</em></div>`)}
        </div>
      </div>
      <div class="card">
        <h2>Séances de la semaine</h2>
        ${seances.length
          ? html`<p class="sub">Celles que tu as activées.</p>${seances}`
          : html`<p class="sub">Aucune séance à l'unif cette semaine : tout le temps est pour l'étude perso.</p>`}
      </div>
    </div>`;
}
