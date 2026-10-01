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

// en semaine, par défaut : journée à la bibliothèque d'Erasme (fermeture 20:45), fin à la maison à 21:00
const weekday = (d) => E.dow(d) >= 1 && E.dow(d) <= 5 && !E.H.closed[d];
const defaultEnd = () => "21:00";

describe("heure de fin", () => {
  const at = (p, kind) => p.items.find((it) => it.kind === kind);

  // journée pleine de cours : l'objectif est atteint à la fin des séances, rien à étirer
  const doneAtLastClass = (p) => {
    const lastFixed = p.items.findLastIndex((it) => it.kind === "fixed");
    return lastFixed >= 0 && !p.items.slice(lastFixed).some((it) => it.kind === "study");
  };

  it("finit à 21:00, avec 9h nettes, en étirant les pauses", () => {
    for (const d of days) {
      const p = E.planDay(d, {});
      if (!doneAtLastClass(p) && !p.fit.early) expect(fin(p), d).toBe(defaultEnd(d));
      expect(p.workEnd, d).toBeLessThanOrEqual(E.m(defaultEnd(d)));
      expect(p.net, d).toBeGreaterThanOrEqual(9 * 60);
      expect(p.fit.mode, d).toBe("stretch");
    }
    const p = E.planDay("2026-10-06", {});
    expect(at(p, "pause").e - at(p, "pause").s).toBeGreaterThan(10);
  });

  it("commence à 9h → fini à l'heure", () => {
    for (const d of days) {
      const p = E.planDay(d, {}, () => ({ start: "09:00" }));
      if (!doneAtLastClass(p) && !p.fit.early) expect(fin(p), d).toBe(defaultEnd(d));
    }
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

  it("pas deux trajets à la suite", () => {
    for (const d of days) {
      const it = E.planDay(d, {}).items;
      for (let i = 1; i < it.length; i++) expect(it[i - 1].kind === "travel" && it[i].kind === "travel", d).toBe(false);
    }
  });

  it("heure de fin du jour : prioritaire sur les réglages", () => {
    const p = E.planDay("2026-10-10", {}, () => ({ start: "09:00", end: "23:00" }));
    expect(fin(p)).toBe("23:00");
    expect(p.net).toBeGreaterThanOrEqual(9 * 60);
    expect(p.endSet).toBe(true);
  });

  it("un peu juste : repas raccourcis d'abord, les 9h sont gardées", () => {
    const p = E.planDay("2026-10-10", {}, () => ({ start: "10:00" }));
    expect(p.fit.mode).toBe("squeeze");
    expect(fin(p)).toBe("21:00");
    expect(p.net).toBeGreaterThanOrEqual(9 * 60);
    expect(p.fit.breaks.pause).toBe(10); // les petites pauses ne bougent pas tant que les repas suffisent
    for (const it of p.items) if (it.kind === "lunch" || it.kind === "dinner") expect(it.e - it.s).toBeGreaterThanOrEqual(30);
    expect(p.warnings.some((w) => w.startsWith("Pour faire tes 9h avant 21:00 : repas de"))).toBe(true);
  });

  it("trop peu de temps : objectif réduit et alerte", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ start: "12:00", end: "21:00" }));
    expect(p.fit.mode).toBe("cut");
    expect(p.workEnd).toBeLessThanOrEqual(21 * 60);
    expect(p.net).toBeLessThan(9 * 60);
    expect(p.warnings.some((w) => w.startsWith("Pour finir à 21:00"))).toBe(true);
  });

  it("fin avant le début : ignorée avec une alerte", () => {
    const p = E.planDay("2026-10-10", {}, () => ({ start: "09:00", end: "08:00" }));
    expect(p.fit.mode).toBe("invalid");
    expect(p.warnings.some((w) => w.includes("avant le début"))).toBe(true);
  });

  it("fin après minuit (00:30) : le lendemain, pas avant le début", () => {
    const p = E.planDay("2026-10-10", {}, () => ({ start: "14:00", end: "00:30" }));
    expect(p.endAt).toBe(24 * 60 + 30);
    expect(p.fit.mode).not.toBe("invalid");
  });

  it("la replanification garde l'heure de fin", () => {
    const p = E.planDay("2026-10-06", {}, () => ({ replan: { at: 900, studied: 240, lunch: true } }));
    expect(fin(p)).toBe("21:00");
  });

  it("les créneaux ne se chevauchent pas, quels que soient le lieu et l'heure de fin", () => {
    for (const place of ["maison", "erasme", "p4p", "uz"]) {
      for (const end of ["19:00", "20:45", "21:00", "22:00", "23:00", "00:00"]) {
        for (const d of days) {
          const p = E.planDay(d, {}, () => ({ start: "09:00", end, place }));
          for (let i = 1; i < p.items.length; i++) expect(p.items[i].s, `${d} ${place} ${end} #${i}`).toBeGreaterThanOrEqual(p.items[i - 1].e);
        }
      }
    }
  });
});

describe("lieux", () => {
  const trips = (p) => p.items.filter((it) => it.kind === "travel");
  const kinds = (p) => p.items.map((it) => it.kind + (it.dir ? "/" + it.dir : ""));

  it("lun–ven : Erasme, un trajet de 25 min le matin et un le soir, aucun entre les cours", () => {
    for (const d of days) {
      const p = E.planDay(d, {});
      if (!weekday(d)) continue;
      expect(p.place, d).toBe("erasme");
      const t = trips(p);
      expect(t.map((x) => x.dir), d).toEqual(["place", "home"]);
      expect(t[0].e - t[0].s, d).toBe(25);
      expect(t[0].e, d).toBe(p.start); // on arrive à la bibli au moment de commencer
    }
  });

  it("week-end et congés : à la maison", () => {
    for (const d of ["2026-10-10", "2026-10-11", "2026-11-11", "2026-12-24"]) {
      const p = E.planDay(d, {});
      expect(p.place, d).toBe("maison");
      expect(p.items.some((it) => it.dir === "place" || it.dir === "home"), d).toBe(false);
    }
  });

  it("début automatique : lever + préparation + trajet, jamais avant l'ouverture", () => {
    expect(E.hm(E.planDay("2026-10-06", {}).start)).toBe("08:15"); // 7:30 + 20 + 25
    expect(E.hm(E.planDay("2026-10-10", {}).start)).toBe("07:50");
    const uz = E.planDay("2026-10-06", {}, () => ({ place: "uz" }));
    expect(E.hm(uz.start)).toBe("08:40"); // 50 min de trajet
  });

  it("Erasme ferme à 20:45 : départ, 20 min pour se poser à la maison, reprise jusqu'à l'heure de fin", () => {
    const p = E.planDay("2026-10-05", {}, () => ({ start: "14:00", end: "00:00" }));
    const k = kinds(p);
    const close = p.items.find((it) => it.dir === "home" && it.closing);
    expect(E.hm(close.s)).toBe("20:45");
    const settle = p.items.find((it) => it.kind === "settle");
    expect(E.hm(settle.e)).toBe("21:30");
    const after = p.items.filter((it) => it.kind === "study" && it.s >= settle.e);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((it) => it.loc === "maison")).toBe(true);
    expect(fin(p)).toBe("00:00");
    expect(k.at(-1)).toBe("sport"); // pas de second retour : on est déjà à la maison
    expect(k.filter((x) => x === "travel/home").length).toBe(1);
  });

  it("fin de journée à la maison : on quitte Erasme avant la fermeture, le trajet sert de pause", () => {
    for (const d of days) {
      if (!weekday(d)) continue;
      const p = E.planDay(d, {});
      const i = p.items.findIndex((it) => it.dir === "home");
      const trip = p.items[i];
      expect(trip.s, d).toBeLessThanOrEqual(E.m("20:45"));
      // juste après une session ou une séance, jamais collé à une autre pause
      expect(["study", "fixed"], d).toContain(p.items[i - 1].kind);
      expect(["pause", "bigpause"], d).not.toContain(p.items[i + 1].kind);
      const after = p.items.slice(i + 1).filter((it) => it.kind === "study");
      if (trip.leave) {
        expect(after.length, d).toBeGreaterThan(0);
        expect(after.every((it) => it.loc === "maison"), d).toBe(true);
        expect(fin(p), d).toBe("21:00");
      } else expect(after.length, d).toBe(0); // objectif atteint avec la dernière séance
    }
  });

  it("réglage « rester sur place jusqu'à la fin » : fin à la fermeture d'Erasme", () => {
    const p = E.planDay("2026-10-05", { homeTail: 0 }, () => ({ end: "21:00" }));
    expect(fin(p)).toBe("20:45");
    expect(p.notes.some((n) => n.includes("Erasme ferme à 20:45"))).toBe(true);
    expect(p.items.filter((it) => it.kind === "study").every((it) => it.loc === "erasme")).toBe(true);
  });

  it("Play4Peace ouvre à 9:00 : étude à la maison d'abord, puis trajet", () => {
    const p = E.planDay("2026-10-10", {}, () => ({ place: "p4p", start: "07:40", end: "23:00" }));
    const trip = p.items.find((it) => it.dir === "place");
    expect(E.hm(trip.s)).toBe("08:35");
    expect(E.hm(trip.e)).toBe("09:00");
    expect(p.items.some((it) => it.kind === "study" && it.loc === "maison" && it.e <= trip.s)).toBe(true);
    const home = p.items.find((it) => it.leave);
    expect(p.items.filter((it) => it.kind === "study" && it.s >= trip.e && it.e <= home.s).every((it) => it.loc === "p4p")).toBe(true);
  });

  it("hors Erasme, séance peu après l'ouverture : on va directement à la séance, puis au lieu", () => {
    const p = E.planDay("2026-10-07", {}, () => ({ place: "p4p", start: "08:00" }));
    expect(p.items.some((it) => it.dir === "place")).toBe(false);
    expect(p.items.find((it) => it.dir === "back").at).toBe("p4p");
  });

  it("choix du jour prioritaire ; ancien réglage bibli oui / non respecté", () => {
    expect(E.planDay("2026-10-06", {}, () => ({ place: "maison" })).place).toBe("maison");
    expect(E.planDay("2026-10-10", {}, () => ({ place: "uz" })).place).toBe("uz");
    expect(E.planDay("2026-10-06", {}, () => ({ lib: false })).place).toBe("maison");
    expect(E.planDay("2026-10-06", { weekdayLib: false }).place).toBe("maison");
    expect(E.planDay("2026-10-06", { weekdayPlace: "p4p" }).place).toBe("p4p");
  });
});

describe("sessions", () => {
  it("jamais de session de moins de 50 min", () => {
    for (const place of ["maison", "erasme", "p4p", "uz"]) {
      for (const [start, end] of [[null, null], ["09:00", null], ["10:15", "22:00"], ["12:00", null], ["14:00", "00:00"]]) {
        for (const d of days) {
          const p = E.planDay(d, {}, () => ({ place, ...(start ? { start } : {}), ...(end ? { end } : {}) }));
          for (const it of p.items) if (it.kind === "study") expect(it.e - it.s, `${d} ${place} ${start} ${E.hm(it.s)}`).toBeGreaterThanOrEqual(50);
        }
      }
    }
  });

  it("horaires ronds : tout tombe sur des multiples de 5 min", () => {
    for (const place of ["maison", "erasme", "p4p", "uz"]) {
      for (const day of [{}, { wake: "07:37" }, { start: "09:00", end: "22:00" }, { end: "19:00" }]) {
        for (const d of days) {
          const p = E.planDay(d, {}, () => ({ place, ...day }));
          for (const it of p.items) {
            if (it.kind === "prep") continue; // commence au lever
            expect(it.s % 5, `${d} ${place} ${JSON.stringify(day)} ${it.kind} ${E.hm(it.s)}`).toBe(0);
            expect(it.e % 5, `${d} ${place} ${JSON.stringify(day)} ${it.kind} ${E.hm(it.e)}`).toBe(0);
          }
        }
      }
    }
  });

  it("pas d'objectif net largement dépassé", () => {
    for (const d of days) expect(E.planDay(d, {}).net, d).toBeLessThanOrEqual(9 * 60 + 15);
  });

  it("tutorat de bio : tous les mercredis 12:00–13:50 en G1-2-302, au choix", () => {
    const ev = (d, day) => E.planDay(d, {}, () => day).events.find((e) => e.type === "TUT");
    const t = ev("2026-10-07");
    expect([E.hm(t.s), E.hm(t.e), t.room, E.evLabel(t), t.attend]).toEqual(["12:00", "13:50", "G1-2-302", "Tutorat de bio", true]);
    expect(ev("2026-10-06")).toBeUndefined(); // mardi
    expect(ev("2026-10-07", { ov: { [t.id]: false } }).attend).toBe(false); // décoché ce jour-là
    expect(E.planDay("2026-10-07", { tutoBio: false }).events.find((e) => e.type === "TUT").attend).toBe(false);
    // pas de déjeuner possible entre les séances : l'app le dit
    expect(E.planDay("2026-10-07", {}).notes.some((n) => n.startsWith("Pas de pause déjeuner"))).toBe(true);
  });

  it("permanence de maths : tous les lundis 12:00–14:00, au choix", () => {
    const ev = (d, s = {}, day) => E.planDay(d, s, () => day).events.find((e) => e.type === "PERM" && e.subj === "MATH");
    const p = ev("2026-10-05");
    expect([E.hm(p.s), E.hm(p.e), p.room, E.evLabel(p), p.attend]).toEqual(["12:00", "14:00", "Local à confirmer", "Permanence maths", true]);
    for (const d of ["2026-10-12", "2026-11-16", "2026-12-14"]) expect(ev(d), d).toBeDefined();
    expect(ev("2026-10-06")).toBeUndefined(); // mardi
    expect(ev("2026-11-02")).toBeUndefined(); // jour de fermeture
    expect(ev("2026-10-05", {}, { ov: { [p.id]: false } }).attend).toBe(false); // décochée ce jour-là
    expect(ev("2026-10-05", { permMath: false }).attend).toBe(false);
    expect(ev("2026-10-05", { extraSessions: false })).toBeUndefined();
    // le lundi à l'unif, la permanence est bien dans la journée
    expect(E.planDay("2026-10-05", {}).items.some((it) => it.kind === "fixed" && it.type === "PERM" && it.subj === "MATH")).toBe(true);
  });

  it("guidances de bio (PDF du 22/09) : thème, guidance 1 du jeudi 1/10, séance des VETE en rechange", () => {
    const g = (d) => E.planDay(d, {}).events.filter((e) => e.subj === "BIO" && e.type === "APPUI" && E.hm(e.s) === "12:00");
    const [g1] = g("2026-10-01");
    expect([g1.theme.startsWith("Guidance 1 · Unicité du monde vivant"), g1.attend]).toEqual([true, true]);
    expect(g("2026-10-09")[0].theme).toMatch(/^Guidance 3 · Génétique des procaryotes/);
    const vete = g("2026-10-07").find((e) => e.vete);
    expect([vete.attend, vete.theme.startsWith("Guidance 2")]).toEqual([false, true]);
    // horaire de la v1 : pas d'ajout
    expect(E.planDay("2026-10-01", { extraSessions: false }).events.some((e) => e.type === "APPUI")).toBe(false);
  });

  it("cours théoriques : choix par matière, sinon le choix général", () => {
    const th = (d, S) => Object.fromEntries(E.planDay(d, S).events.filter((e) => e.type === "TH").map((e) => [e.subj, e.attend]));
    expect(th("2026-10-06", { attendTh: { MATH: true } })).toEqual({ BIO: false, MATH: true });
    expect(th("2026-10-06", { attendTheory: true, attendTh: { BIO: false } })).toEqual({ BIO: false, MATH: true });
  });

  it("« reporté » une seule fois dans les titres", () => {
    for (const d of days) {
      for (const it of E.planDay(d, {}).items) for (const t of it.tasks || []) expect(t.title, d).not.toMatch(/reporté · reporté/);
    }
  });
});

describe("objectifs de la semaine", () => {
  const goalMin = (week) => {
    const out = {};
    for (const r of week) for (const it of r.items) for (const t of it.tasks || []) if (t.kind === "goal") out[t.gid] = (out[t.gid] || 0) + t.min;
    return out;
  };

  it("les annales habituelles sont placées dans la semaine, sans dépasser l'objectif", () => {
    const total = (g) => Object.values(g).reduce((a, b) => a + b, 0);
    for (const mon of ["2026-10-05", "2026-11-09", "2026-12-07"]) {
      // semaine de cours (tutorat du mercredi, permanence de maths du lundi) : une annale de chimie entière
      const g = goalMin(E.planWeek(mon, {}));
      expect(g["annale-chim"], mon).toBeGreaterThanOrEqual(240);
      expect(g["annale-chim"], mon).toBeLessThanOrEqual(480);
      expect(g["annale-math"] || 0, mon).toBeLessThanOrEqual(240);
      // sans la permanence de maths : un bloc de 2h en plus, et de la physique
      const sans = goalMin(E.planWeek(mon, { permMath: false }));
      expect(sans["annale-phys"], mon).toBeGreaterThanOrEqual(120);
      expect(total(sans), mon).toBe(total(g) + 120);
    }
    // vacances : toutes les annales de la semaine
    expect(goalMin(E.planWeek("2026-12-21", {}))).toEqual({ "annale-chim": 480, "annale-phys": 480, "annale-math": 240 });
  });

  it("samedi : une annale le matin si la semaine n'a pas tout placé, le reste du samedi réduit d'autant", () => {
    const goalItems = (r) => r.items.filter((it) => (it.tasks || []).some((t) => t.kind === "goal"));
    for (const mon of ["2026-10-05", "2026-11-09", "2026-12-07"]) {
      const sat = E.planWeek(mon, {})[5], sd = sat.date;
      expect(sat.mode, sd).toBe("samedi");
      const g = goalItems(sat);
      // une annale entière : 1re partie en début de journée, 2e partie juste après la pause, avant le déjeuner
      expect(g.map((it) => it.e - it.s), sd).toEqual([120, 120]);
      expect(g[0].s, sd).toBe(sat.start);
      expect(g[0].tasks[0].title, sd).toMatch(/1re partie$/);
      expect(g[1].tasks[0].title, sd).toBe(g[0].tasks[0].title.replace("1re", "2e"));
      const lunch = sat.items.find((it) => it.kind === "lunch");
      expect(g[1].e, sd).toBeLessThanOrEqual(lunch.s);
      expect(g[1].s - g[0].e, sd).toBeLessThanOrEqual(40);
      // toujours 9h, avec la chimie Q2, la prépa concours et la révision (réduites)
      expect(sat.net, sd).toBe(540);
      const titles = sat.items.flatMap((it) => (it.tasks || []).map((t) => t.title));
      for (const t of ["Chimie Q2 · organique", "Chimie Q2 · minérale", "Prépa concours · physique", "Prépa concours · maths", "Révision de la semaine"]) expect(titles, sd).toContain(t);
    }
    // réglable : 0 = pas d'annale le samedi, le samedi habituel
    const off = E.planWeek("2026-10-05", { annaleSat: 0 })[5];
    expect(goalItems(off)).toEqual([]);
    const orga = (r) => r.items.flatMap((it) => it.tasks || []).filter((t) => t.title === "Chimie Q2 · organique").reduce((a, t) => a + t.min, 0);
    expect(orga(off)).toBeGreaterThanOrEqual(140);
    expect(orga(E.planWeek("2026-10-05", {})[5])).toBeLessThan(orga(off));
    // semaine de vacances : tout est déjà placé du lundi au vendredi, samedi habituel
    expect(goalItems(E.planWeek("2026-12-21", {})[5])).toEqual([]);
  });

  it("une annale de 4h = deux blocs de 2h d'un seul tenant", () => {
    for (const mon of ["2026-10-05", "2026-11-09", "2026-12-21"]) {
      const blocks = E.planWeek(mon, {}).flatMap((r) => r.items.filter((it) => (it.tasks || []).some((t) => t.kind === "goal")));
      expect(blocks.length, mon).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(b.e - b.s, mon).toBe(120);
        expect(b.tasks.length, mon).toBe(1);
        expect(b.tasks[0].title, mon).toMatch(/^Annale de (chimie|physique|maths)( \d\/\d)? · (1re|2e) partie$/);
      }
    }
  });

  it("jamais pendant la permanence ni la guidance : seulement dans les sessions d'étude", () => {
    for (const r of E.planWeek("2026-10-05", {})) {
      for (const it of r.items) if (it.kind !== "study") expect((it.tasks || []).some((t) => t.kind === "goal")).toBe(false);
    }
  });

  it("une semaine personnalisée remplace les objectifs habituels", () => {
    const goals = { base: [{ id: "a", kind: "annale", subj: "CHIM", count: 1, hours: 4 }], weeks: { "2026-10-12": [{ id: "t", kind: "theorie", subj: "BIO", count: 1, hours: 2, label: "chapitre 3" }] } };
    const w1 = goalMin(E.planWeek("2026-10-05", { goals }));
    const w2 = goalMin(E.planWeek("2026-10-12", { goals }));
    expect(w1.a).toBe(240);
    expect(w2.a).toBeUndefined();
    expect(w2.t).toBe(120);
    const title = E.planWeek("2026-10-12", { goals }).flatMap((r) => r.items.flatMap((it) => it.tasks || [])).find((t) => t.gid === "t").title;
    expect(title).toBe("Théorie de bio · chapitre 3");
  });

  it("sans objectif : comme avant (rotation des matières)", () => {
    expect(Object.keys(goalMin(E.planWeek("2026-10-05", { goals: { base: [], weeks: {} } })))).toEqual([]);
  });
});

describe("corrections de l'analyse au peigne fin", () => {
  it("une coche reste sur le même créneau quand le plan se décale (clé = contenu, pas heure)", () => {
    const a = E.planDay("2026-10-06", {}), b = E.planDay("2026-10-06", {}, () => ({ wake: "07:35" }));
    const keys = (p) => p.items.filter((it) => it.kind === "study" || it.kind === "fixed").map((it) => it.key);
    expect(b.items.find((it) => it.kind === "fixed").key).toBe(a.items.find((it) => it.kind === "fixed").key);
    expect(new Set(keys(a)).size).toBe(keys(a).length); // uniques dans la journée
    expect(a.items.find((it) => it.kind === "study").legacyKey).toMatch(/^study@\d\d:\d\d$/);
  });

  it("replanifier pendant un trajet : on n'étudie pas sur place avant d'être arrivé", () => {
    for (const [d, at] of [["2026-10-02", 480], ["2026-10-07", 1090], ["2026-10-06", 1095]]) {
      const p = E.planDay(d, {}, () => ({ replan: { at, studied: 300, lunch: true } }));
      const it = p.items;
      for (let i = 1; i < it.length; i++) expect(it[i].s, d + " #" + i).toBeGreaterThanOrEqual(it[i - 1].e);
      const trip = it.find((x) => x.kind === "travel" && x.s === at);
      if (trip) expect(it.filter((x) => x.kind === "study" && x.s >= at && x.s < trip.e).length, d).toBe(0);
    }
  });

  it("replanifier au milieu d'une annale : la suite est reprise, pas une 1re partie en plus", () => {
    const p = E.planDay("2026-09-28", {}, () => ({ replan: { at: 600, studied: 105 } }));
    const titles = p.items.flatMap((it) => (it.tasks || []).filter((t) => t.kind === "goal").map((t) => t.title));
    expect(titles.filter((t) => t.endsWith("2e partie")).length).toBeGreaterThan(0);
    const week = E.planWeek("2026-09-28", {}, (d) => (d === "2026-09-28" ? { replan: { at: 600, studied: 105 } } : null));
    const min = {};
    for (const r of week) for (const it of r.items) for (const t of it.tasks || []) if (t.kind === "goal") min[t.title.split(" · ")[0]] = (min[t.title.split(" · ")[0]] || 0) + t.min;
    for (const v of Object.values(min)) expect(v).toBeLessThanOrEqual(240 + 50);
  });

  it("réglage d'heure effacé : valeur par défaut, pas de NaN", () => {
    const p = E.planDay("2026-10-06", { wake: "", p4pOpen: "", erasmeClose: "" });
    expect(p.net).toBeGreaterThanOrEqual(9 * 60);
    for (const it of p.items) expect(Number.isFinite(it.s) && Number.isFinite(it.e)).toBe(true);
  });

  it("session max plus courte que la session minimale : l'objectif est quand même atteint", () => {
    for (const session of [30, 45]) expect(E.planDay("2026-10-06", { session }).net, String(session)).toBeGreaterThanOrEqual(9 * 60);
  });

  it("un cours du jour n'est jamais placé avant la fin du cours", () => {
    for (const d of days) {
      const p = E.planDay(d, {});
      const ends = {};
      for (const ev of p.events) if (ev.type === "TH" && !ev.attend) ends[ev.subj] = Math.max(ends[ev.subj] || 0, ev.e);
      for (const it of p.items) {
        let t = it.s;
        for (const tk of it.tasks || []) {
          if (tk.kind === "th" && ends[tk.subj]) expect(t, d + " " + tk.title).toBeGreaterThanOrEqual(ends[tk.subj] - 15);
          t += tk.min;
        }
      }
    }
  });

  it("éthique : ancre un samedi → le dimanche qui suit ; cycle en semaines entières", () => {
    expect(E.isEthique("2026-10-04", E.withDefaults({ ethiqueAnchor: "2026-10-03" }))).toBe(true);
    expect(E.isEthique("2026-10-18", E.withDefaults({ ethiqueEvery: 1.5 }))).toBe(true); // 1,5 → 2 semaines
  });

  it("noms des objectifs : sigles gardés", () => {
    expect(E.goalTitle({ kind: "annale", subj: "CHQ2" })).toBe("Annale de chimie Q2");
    expect(E.goalTitle({ kind: "theorie", subj: "MEDIG" })).toBe("Théorie de MEDIG");
  });
});

describe("journée modifiée à la main", () => {
  const mk = (base = {}) => {
    const store = { ...base };
    return { store, get: (d) => store[d] || null };
  };
  const freeze = (ds, st, get) => E.freezeDay(E.planDay(ds, st, get));
  const titles = (r) => r.items.flatMap((it) => (it.tasks || []).map((t) => t.title));
  const noOverlap = (items) => {
    const xs = [...items].sort((a, b) => a.s - b.s);
    for (let i = 1; i < xs.length; i++) expect(xs[i].s, E.hm(xs[i].s)).toBeGreaterThanOrEqual(xs[i - 1].e);
  };

  it("figer sans rien changer : même journée, mêmes coches", () => {
    const { store, get } = mk();
    const before = E.planDay("2026-10-06", {});
    store["2026-10-06"] = { custom: { items: freeze("2026-10-06", {}, get) } };
    const after = E.planDay("2026-10-06", {}, get);
    expect(after.custom).toBe(true);
    expect(after.net).toBe(before.net);
    expect(after.bySubject).toEqual(before.bySubject);
    // (le temps libre n'est plus un créneau : ce sont les trous de la journée)
    expect(after.items.map((it) => it.key)).toEqual(before.items.filter((it) => it.kind !== "free").map((it) => it.key));
  });

  it("mercredi 30/09 : tutorat, puis 1h de bio ajoutée et 2h de physique ; le reste supprimé ne compte pas", () => {
    const ds = "2026-09-30", { store, get } = mk();
    let items = freeze(ds, {}, get);
    const cid = (label) => items.find((it) => it.kind === "fixed" && E.evLabel(it) === label).cid;
    for (const l of ["Permanence physique", "Séminaire de chimie", "Séminaire de physique (exercices)"]) items = E.editDay(items, { type: "remove", cid: cid(l) });
    items = items.filter((it) => !(it.kind === "study" && it.s >= 840));
    items = E.editDay(items, { type: "add", kind: "study", subj: "BIO", s: 840, e: 900 });
    items = E.editDay(items, { type: "add", kind: "study", subj: "PHYS", s: 910, e: 1030 });
    store[ds] = { custom: { items } };
    const r = E.planDay(ds, {}, get);
    noOverlap(r.items);
    // séance du matin (70 min) + tutorat (110) + bio (60) + physique (120)
    expect(r.net).toBe(70 + 110 + 60 + 120);
    expect(r.bySubject.BIO).toBe(70 + 110 + 60);
    expect(r.bySubject.PHYS).toBe(120);
    expect(r.bySubject.CHIM).toBeUndefined();
    // les séances supprimées : « je n'y vais pas », de nouveau proposées
    expect(r.events.find((e) => e.type === "SEM").attend).toBe(false);
    expect(r.events.find((e) => e.type === "TUT").attend).toBe(true);
    expect(titles(r)).toEqual(expect.arrayContaining(["Bio", "Physique"]));
  });

  it("supprimer 4h de maths : la répartition de la semaine perd 4h de maths", () => {
    const { store, get } = mk();
    const sum = (week, k) => week.reduce((a, r) => a + (r.bySubject[k] || 0), 0);
    const before = sum(E.planWeek("2026-10-12", {}), "MATH");
    let removed = 0;
    for (const ds of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]) {
      if (removed >= 240) break;
      let items = freeze(ds, {}, get);
      for (const it of items.filter((x) => x.kind === "study" && x.tasks.every((t) => t.subj === "MATH"))) {
        if (removed >= 240) break;
        items = E.editDay(items, { type: "remove", cid: it.cid });
        removed += it.e - it.s;
      }
      store[ds] = { custom: { items } };
    }
    expect(removed).toBeGreaterThan(0);
    // (les jours suivants peuvent reprendre la rotation, mais jamais remettre ce qui a été supprimé ce jour-là)
    const after = E.planWeek("2026-10-12", {}, get);
    expect(sum(after, "MATH")).toBeLessThanOrEqual(before - removed + 180);
    expect(sum(after, "MATH")).toBeLessThan(before);
  });

  it("changer de matière, une demi-heure seulement, matière libre (« Médecine »)", () => {
    const ds = "2026-10-06", { store, get } = mk();
    let items = freeze(ds, {}, get);
    const st = items.filter((it) => it.kind === "study");
    const before = E.planDay(ds, {}).net;
    // la première session devient de la chimie, d'une demi-heure
    items = E.editDay(items, { type: "update", cid: st[1].cid, subj: "CHIM", s: st[1].s, e: st[1].s + 30 });
    // la suivante devient « Médecine »
    items = E.editDay(items, { type: "update", cid: st[2].cid, subj: "AUTRE", label: "Médecine" });
    store[ds] = { custom: { items } };
    const r = E.planDay(ds, {}, get);
    noOverlap(r.items);
    expect(r.net).toBe(before - (st[1].e - st[1].s - 30));
    const s1 = r.items.find((it) => it.cid === st[1].cid);
    expect([s1.e - s1.s, s1.tasks]).toEqual([30, [{ subj: "CHIM", kind: "custom", title: "Chimie", min: 30 }]]);
    expect(r.bySubject["~Médecine"]).toBe(st[2].e - st[2].s);
  });

  it("un créneau ajouté par-dessus d'autres : ils sont raccourcis, coupés ou retirés", () => {
    const ds = "2026-10-06", { get } = mk();
    let items = freeze(ds, {}, get);
    const big = items.find((it) => it.kind === "study" && it.e - it.s >= 90);
    const mid = big.s + 30;
    items = E.editDay(items, { type: "add", kind: "study", subj: "BIO", s: mid, e: mid + 30 });
    noOverlap(items);
    const parts = items.filter((it) => it.kind === "study" && (it.cid === big.cid || (it.s === mid + 30 && it.e === big.e)));
    expect(parts.map((it) => [it.s, it.e])).toEqual([[big.s, mid], [mid + 30, big.e]]);
    for (const p of parts) expect(p.tasks.reduce((a, t) => a + t.min, 0)).toBe(p.e - p.s);
    expect(new Set(items.map((it) => it.cid)).size).toBe(items.length);
    expect(new Set(items.map((it) => it.key)).size).toBe(items.length);
  });

  it("l'annale supprimée d'un jour revient plus tard dans la semaine", () => {
    const ds = "2026-10-06", { store, get } = mk();
    let items = freeze(ds, {}, get);
    const ann = items.find((it) => it.kind === "study" && it.tasks.some((t) => t.kind === "goal"));
    expect(ann).toBeDefined();
    const title = ann.tasks[0].title;
    items = E.editDay(items, { type: "remove", cid: ann.cid });
    store[ds] = { custom: { items } };
    const week = E.planWeek(ds, {}, get);
    expect(titles(week[1])).not.toContain(title);
    expect(week.slice(2).flatMap(titles)).toContain(title);
  });

  it("une séance perso (ex. « Cours de médecine ») compte comme une séance", () => {
    const ds = "2026-10-10", { store, get } = mk();
    let items = freeze(ds, {}, get);
    items = E.editDay(items, { type: "add", kind: "fixed", subj: "AUTRE", label: "Cours de médecine", s: 600, e: 720 });
    store[ds] = { custom: { items } };
    const r = E.planDay(ds, {}, get);
    noOverlap(r.items);
    const fx = r.items.find((it) => it.kind === "fixed");
    expect([E.evLabel(fx), fx.counts, E.hm(fx.s), E.hm(fx.e)]).toEqual(["Cours de médecine", true, "10:00", "12:00"]);
    // la séance prend 20 min de pause (09:50–10:20) et 1h40 de l'annale (10:20–12:00) : +20 min
    expect(r.net).toBe(540 + 20);
  });

  it("les heures restent sur la grille de 5 min et rien d'absurde n'est accepté", () => {
    const ds = "2026-10-06", { get } = mk();
    let items = freeze(ds, {}, get);
    const st = items.find((it) => it.kind === "study");
    expect(E.editDay(items, { type: "update", cid: st.cid, s: st.s, e: st.s + 2 })).toEqual(items); // < 5 min
    expect(E.editDay(items, { type: "add", kind: "study", subj: "MATH", s: 900, e: 880 })).toEqual(items); // fin avant début
    items = E.editDay(items, { type: "add", kind: "study", subj: "MATH", s: 901, e: 962 });
    const add = items.find((it) => it.key.startsWith("custom#") && it.tasks?.[0].subj === "MATH");
    expect([add.s, add.e]).toEqual([900, 960]);
  });
});
