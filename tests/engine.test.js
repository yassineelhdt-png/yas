import { describe, expect, it } from "vitest";
import * as E from "../src/engine/index.js";

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
    for (const p of plans) expect(p.items.at(-1).kind, p.date).toBe("sport");
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
