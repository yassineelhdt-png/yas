export const SUBJ = {
  CHIM: "Chimie", PHYS: "Physique", MATH: "Maths", BIO: "Bio", BIO2: "Bio", MEDIG: "MEDIG",
  CHQ2: "Chimie Q2", CONC: "Concours", REV: "Révision", RAIS: "Raisonnement", ETH: "Éthique & empathie"
};

export const TYPE = {
  TH: "Cours théorique", SEM: "Séminaire", EX: "Exercices", TP: "TP", APPUI: "Appui pédagogique",
  TEST: "Interrogation", INFO: "Infos examen", VISITE: "Visite de copies", GUID: "Guidance", PERM: "Permanence"
};

/** Libellé lisible d'une séance à l'unif. */
export function evLabel(ev) {
  const n = (SUBJ[ev.subj] || ev.subj).toLowerCase();
  switch (ev.type) {
    case "GUID": return "Guidance chimie";
    case "PERM": return "Permanence physique";
    case "SEM": return "Séminaire de " + n;
    case "EX": return "Séminaire de " + n + " (exercices)";
    case "TP": return "TP de " + n;
    case "APPUI": return "Appui " + n;
    case "TEST": return "Interro de " + n;
    case "INFO": return "Infos examen " + n;
    case "VISITE": return "Visite de copies " + n;
    default: return "Cours de " + n + (ev.note ? " · " + ev.note : "");
  }
}
