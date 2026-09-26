// Heures en minutes depuis minuit, dates au format "AAAA-MM-JJ" (heure locale).

const pad2 = (n) => (n < 10 ? "0" : "") + n;

/** "07:30" → 450 */
export function m(s) {
  const [h, mi] = s.split(":");
  return +h * 60 + +mi;
}

/** 450 → "07:30" (repasse sur 24 h) */
export function hm(x) {
  x = Math.round(x);
  if (x < 0) x += 1440;
  return pad2(Math.floor(x / 60) % 24) + ":" + pad2(x % 60);
}

/** 95 → "1h35", 60 → "1h", 40 → "40 min" */
export function dur(x) {
  x = Math.round(x);
  const h = Math.floor(x / 60), mi = x % 60;
  return h ? h + "h" + (mi ? pad2(mi) : "") : mi + " min";
}

/** 95 → "1h35", 60 → "1h00" (jamais négatif) */
export function hdur(x) {
  x = Math.max(0, Math.round(x));
  return Math.floor(x / 60) + "h" + pad2(x % 60);
}

/** "2026-09-28" → Date à midi (évite les pièges d'heure d'été) */
export function pd(ds) {
  const [y, mo, d] = ds.split("-");
  return new Date(+y, +mo - 1, +d, 12);
}

/** Date → "2026-09-28" */
export function fd(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function addDays(ds, n) {
  const d = pd(ds);
  d.setDate(d.getDate() + n);
  return fd(d);
}

/** 0 = dimanche … 6 = samedi */
export const dow = (ds) => pd(ds).getDay();

export function monday(ds) {
  const w = dow(ds);
  return addDays(ds, w === 0 ? -6 : 1 - w);
}

export const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);

export const todayStr = () => fd(new Date());

export function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
