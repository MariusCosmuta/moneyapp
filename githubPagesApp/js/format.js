export const LUNI = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

export function fmt(n) {
  return (Number(n) || 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " lei";
}

// Data locală (nu UTC) în format ISO yyyy-mm-dd.
export function isoLocal(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoRo(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}.${m}.${y}`;
}

// [prima zi a lunii, prima zi a lunii următoare) în format ISO.
export function intervalLuna(an, luna) {
  const p = (x) => String(x).padStart(2, "0");
  const [an2, luna2] = luna === 12 ? [an + 1, 1] : [an, luna + 1];
  return [`${an}-${p(luna)}-01`, `${an2}-${p(luna2)}-01`];
}

// Acceptă și virgulă zecimală; întoarce NaN pentru text invalid.
export function parseSuma(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Butoanele de sumă rapidă: "±" inversează semnul; un număr îl pune păstrând semnul sumei curente.
export function sumaRapida(curent, actiune) {
  const n = parseSuma(curent);
  if (actiune === "±") return Number.isNaN(n) ? "" : String(-n);
  return String(n < 0 ? -actiune : actiune);
}
