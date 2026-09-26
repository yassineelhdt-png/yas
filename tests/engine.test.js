import { describe, expect, it } from "vitest";
import * as E from "../src/engine/index.js";

const fin = (p) => E.hm(p.workEnd);
const days = [];
for (let d = "2026-09-28"; d <= "2027-01-10"; d = E.addDays(d, 1)) days.push(d);

describe("temps", () => {
  it("convertit heures ↔ minutes", () => {
    expect(E.m("07:30")).toBe(450);
    expect(E.hm(450)).toBe("07:30");
    expect(E.hm(1440 + 65)).toBe("01:05");
    expect(E.hm(-30)).toBe("23:30");
  });
  it("formate les durées", () => {
    expect(E.dur(95)).toBe("1h35");
    expect(E.dur(60)).toBe("1h");
    expect(E.dur(40)).toBe("40 min");
    expect(E.hdur(60)).toBe("1h00");
    expect(E.hdur(-5)).toBe("0h00");
  });
  it("gère les semaines", () => {
    expect(E.monday("2026-10-04")).toBe("2026-09-28"); // dimanche → lundi précédent
    expect(E.monday("2026-09-28")).toBe("2026-09-28");
    expect(E.weekNo("2026-09-30")).toBe(3);
    expect(E.addDays("2026-10-31", 1)).toBe("2026-11-01"); // passage à l'heure d'hiver
  });
});

describe("plan d'un jour (réglages de base)", () => {
  const plans = days.map((d) => E.planDay(d, {}));
  const compact = days.map((d) => E.planDay(d, { endAt: "", weekdayLib: false }));

  it("les créneaux se suivent sans se chevaucher", () => {
    for (const p of plans) {
      for (let i = 1; i < p.items.length; i++) {
        expect(p.items[i].s, `${p.date} #${i} ${p.items[i].kind}`).toBeGreaterThanOrEqual(p.items[i - 1].e);
      }
    }
  });

  it("atteint l'objectif de 9h nettes", () => {
    for (const p of plans) expect(p.net, p.date).toBeGreaterThanOrEqual(9 * 60);
  });

  it("finit toujours par le sport", () => {
    for (const p of [...plans, ...compact]) expect(p.items.at(-1).kind, p.date).toBe("sport");
  });

  it("atteint aussi 9h sans heure de fin (comme la v1)", () => {
    for (const p of compact) expect(p.net, p.date).toBeGreaterThanOrEqual(9 * 60);
  });

  it("choisit le bon mode", () => {
    expect(E.planDay("2026-10-03", {}).mode).toBe("samedi");
    expect(E.planDay("2026-10-04", {}).mode).toBe("concours");
    expect(E.planDay("2026-11-11", {}).mode).toBe("conge");
    expect(E.planDay("2026-10-05", {}).mode).toBe("semaine");
    expect(E.planDay("2026-12-21", {}).blocus).toBe(true);
  });

  it("met l'éthique un dimanche sur quatre", () => {
    expect(E.planDay("2026-10-04", {}).ethique).toBe(true);
    expect(E.planDay("2026-10-11", {}).ethique).toBe(false);
    expect(E.planDay("2026-11-01", {}).ethique).toBe(true);
  });
});

describe("saisies du jour", () => {
  it("un lever tardif fait manquer les séances passées", () => {
    const p = E.planDay("2026-10-05", {}, () => ({ wake: "19:00" }));
    expect(p.missed.length).toBeGreaterThan(0);
    expect(p.warnings.some((w) => w.includes("déjà passé"))).toBe(true);
  });

  it("une présence désactivée retire la séance du plan", () => {
    const base = E.planDay("2026-10-05", {});
    const tp = base.events.find((e) => e.type === "TP");
    expect(tp.attend).toBe(true);
    const p = E.planDay("2026-10-05", {}, () => ({ ov: { [tp.id]: false } }));
    expect(p.items.some((it) => it.id === tp.id)).toBe(false);
  });

  it("la replanification garde ce qui est déjà fait", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ replan: { at: 780, studied: 120, lunch: true } }));
    expect(p.replanAt).toBe(780);
    expect(p.items.some((it) => it.kind === "replan")).toBe(true);
    expect(p.items.filter((it) => it.past).every((it) => it.e <= 780)).toBe(true);
  });
});

describe("heure de fin", () => {
  const at = (p, kind) => p.items.find((it) => it.kind === kind);

  // journée pleine de cours : l'objectif est atteint à la fin des séances, rien à étirer
  const doneAtLastClass = (p) => {
    const lastFixed = p.items.findLastIndex((it) => it.kind === "fixed");
    return lastFixed >= 0 && !p.items.slice(lastFixed).some((it) => it.kind === "study");
  };

  it("finit à 21:00 par défaut, avec 9h nettes, en étirant les pauses", () => {
    for (const d of days) {
      const p = E.planDay(d, {});
      if (!doneAtLastClass(p)) expect(fin(p), d).toBe("21:00");
      expect(p.workEnd, d).toBeLessThanOrEqual(21 * 60);
      expect(p.net, d).toBeGreaterThanOrEqual(9 * 60);
      expect(p.fit.mode, d).toBe("stretch");
    }
    const p = E.planDay("2026-10-06", {});
    expect(at(p, "pause").e - at(p, "pause").s).toBeGreaterThan(10);
  });

  it("commence à 9h → fini à 21h", () => {
    for (const d of days) expect(fin(E.planDay(d, {}, () => ({ start: "09:00" }))), d).toBe("21:00");
  });

  it("mange le soir pendant le programme quand on finit après 20h", () => {
    for (const d of days) {
      const p = E.planDay(d, {});
      if (p.workEnd < 20 * 60) continue;
      const meal = p.items.find((it) => (it.kind === "dinner" || it.kind === "lunch") && it.s >= 17 * 60 + 30);
      expect(meal, d).toBeTruthy();
      expect(meal.e, d).toBeLessThanOrEqual(p.workEnd);
    }
  });

  it("pas de double trajet : après un retour d'Erasme, pas de « retour de la bibliothèque »", () => {
    for (const d of days) {
      const it = E.planDay(d, {}).items;
      for (let i = 1; i < it.length; i++) expect(it[i - 1].kind === "travel" && it[i].kind === "travel", d).toBe(false);
    }
  });

  it("heure de fin du jour : prioritaire sur les réglages", () => {
    const p = E.planDay("2026-10-05", {}, () => ({ start: "09:00", end: "23:00" }));
    expect(fin(p)).toBe("23:00");
    expect(p.net).toBeGreaterThanOrEqual(9 * 60);
    expect(p.endSet).toBe(true);
  });

  it("un peu juste : repas raccourcis d'abord, les 9h sont gardées", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ start: "10:30" }));
    expect(p.fit.mode).toBe("squeeze");
    expect(fin(p)).toBe("21:00");
    expect(p.net).toBeGreaterThanOrEqual(9 * 60);
    expect(p.fit.breaks.pause).toBe(10); // les petites pauses ne bougent pas tant que les repas suffisent
    for (const it of p.items) if (it.kind === "lunch" || it.kind === "dinner") expect(it.e - it.s).toBeGreaterThanOrEqual(30);
    expect(p.warnings.some((w) => w.startsWith("Pour faire tes 9h avant 21:00 : repas de 30 min"))).toBe(true);
  });

  it("trop peu de temps : objectif réduit et alerte", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ start: "12:00", end: "21:00" }));
    expect(p.fit.mode).toBe("cut");
    expect(p.workEnd).toBeLessThanOrEqual(21 * 60);
    expect(p.net).toBeLessThan(9 * 60);
    expect(p.warnings.some((w) => w.startsWith("Pour finir à 21:00"))).toBe(true);
  });

  it("fin avant le début : ignorée avec une alerte", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ start: "09:00", end: "08:00" }));
    expect(p.fit.mode).toBe("invalid");
    expect(p.warnings.some((w) => w.includes("avant le début"))).toBe(true);
  });

  it("en semaine : retour de la bibliothèque puis sport ; le week-end : sport directement", () => {
    const wk = E.planDay("2026-10-06", {});
    const tail = wk.items.slice(-2).map((it) => it.kind + (it.dir ? "/" + it.dir : ""));
    expect(tail).toEqual(["travel/home", "sport"]);
    expect(wk.items.at(-2).s).toBe(wk.workEnd);
    for (const d of ["2026-10-10", "2026-10-11"]) expect(E.planDay(d, {}).items.at(-2).kind, d).not.toBe("travel");
  });
});

describe("journée à la bibliothèque d'Erasme", () => {
  const trips = (p) => p.items.filter((it) => it.kind === "travel");

  it("lun–ven : un trajet le matin, un le soir, aucun entre les cours", () => {
    for (const d of days) {
      const p = E.planDay(d, {});
      if (!p.atLib) continue;
      const t = trips(p);
      expect(t.map((x) => x.dir), d).toEqual(["to", "home"]);
      expect(t[0].e, d).toBe(p.start); // on arrive à la bibli au moment de commencer
      expect(p.items.filter((it) => it.kind === "study").every((it) => it.loc === "bibli"), d).toBe(true);
    }
  });

  it("week-end et congés : à la maison, trajets seulement pour les séances", () => {
    for (const d of ["2026-10-10", "2026-10-11", "2026-11-11", "2026-12-24"]) {
      const p = E.planDay(d, {});
      expect(p.atLib, d).toBe(false);
      expect(p.items.some((it) => it.lib || it.dir === "home"), d).toBe(false);
    }
  });

  it("début automatique : lever + préparation + trajet", () => {
    const p = E.planDay("2026-10-06", {});
    expect(E.hm(p.start)).toBe("08:20");
    expect(E.hm(E.planDay("2026-10-10", {}).start)).toBe("07:50");
  });

  it("choix du jour prioritaire : maison un mardi, bibli un samedi", () => {
    const home = E.planDay("2026-10-06", {}, () => ({ lib: false }));
    expect(home.atLib).toBe(false);
    expect(home.libSet).toBe(true);
    expect(trips(home).some((t) => t.dir === "to" && !t.lib)).toBe(true); // trajet pour l'appui de midi
    const sat = E.planDay("2026-10-10", {}, () => ({ lib: true }));
    expect(trips(sat).map((t) => t.dir)).toEqual(["to", "home"]);
  });

  it("réglage désactivé : comme avant, à la maison", () => {
    expect(E.planDay("2026-10-06", { weekdayLib: false }).atLib).toBe(false);
  });

  it("la replanification garde l'heure de fin", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ replan: { at: 900, studied: 240, lunch: true } }));
    expect(fin(p)).toBe("21:00");
  });

  it("les créneaux ne se chevauchent pas, quelle que soit l'heure de fin", () => {
    for (const end of ["19:00", "20:00", "20:45", "21:00", "22:00", "23:00"]) {
      for (const d of days) {
        const p = E.planDay(d, {}, () => ({ start: "09:00", end }));
        for (let i = 1; i < p.items.length; i++) expect(p.items[i].s, `${d} ${end} #${i}`).toBeGreaterThanOrEqual(p.items[i - 1].e);
        expect(p.workEnd, `${d} ${end}`).toBeLessThanOrEqual(E.m(end) + (p.fit.mode === "late" ? 600 : 0));
      }
    }
  });
});
