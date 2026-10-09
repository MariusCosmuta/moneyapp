// Generare CSV din exportul complet (funcții pure).

const PERICULOS = /^[=+\-@\t\r]/; // evită executarea de formule când fișierul e deschis în Excel/Sheets

function celula(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (PERICULOS.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// coloane: [[titlu, (rând) => valoare], …]. BOM-ul face ca diacriticele să apară corect în Excel.
export function laCsv(randuri, coloane) {
  const linii = [coloane.map(([t]) => celula(t)).join(",")];
  for (const r of randuri) linii.push(coloane.map(([, f]) => celula(f(r))).join(","));
  return "\uFEFF" + linii.join("\r\n") + "\r\n";
}

const r2 = (n) => Math.round(n * 100) / 100;
const numeCategorii = (d) => new Map(d.categorii.map((c) => [Number(c.id), c.nume]));

export function csvTranzactii(d) {
  const cat = numeCategorii(d);
  return laCsv(d.tranzactii, [
    ["id", (t) => Number(t.id)],
    ["data", (t) => t.data],
    ["categorie", (t) => cat.get(Number(t.categorie_id))],
    ["suma", (t) => Number(t.suma)],
    ["nota", (t) => t.nota],
    ["tip", (t) => t.tip],
    ["imprumut_id", (t) => (t.imprumut_id == null ? null : Number(t.imprumut_id))],
    ["sters_la", (t) => t.deleted_at],
    ["creat_la", (t) => t.created_at]
  ]);
}

export function csvImprumuturi(d) {
  const cat = numeCategorii(d);
  const rambursat = new Map();
  for (const t of d.tranzactii) {
    if (t.tip !== "rambursare" || t.deleted_at) continue;
    const id = Number(t.imprumut_id);
    rambursat.set(id, (rambursat.get(id) ?? 0) + Number(t.suma));
  }
  const ramb = (x) => r2(Number(x.rambursat_legacy) + (rambursat.get(Number(x.id)) ?? 0));
  return laCsv(d.imprumuturi, [
    ["id", (x) => Number(x.id)],
    ["data", (x) => x.data],
    ["din", (x) => cat.get(Number(x.din_id))],
    ["in", (x) => cat.get(Number(x.in_id))],
    ["suma", (x) => Number(x.suma)],
    ["rambursat", ramb],
    ["sold", (x) => r2(Number(x.suma) - ramb(x))],
    ["nota", (x) => x.nota],
    ["sters_la", (x) => x.deleted_at]
  ]);
}

export function csvCategorii(d) {
  const ascunsa = new Map();
  for (const i of d.categorii_inactive) {
    const id = Number(i.categorie_id);
    ascunsa.set(id, [...(ascunsa.get(id) ?? []), Number(i.an)]);
  }
  return laCsv(d.categorii, [
    ["id", (c) => Number(c.id)],
    ["nume", (c) => c.nume],
    ["owner", (c) => c.owner],
    ["tinta", (c) => Number(c.tinta)],
    ["notite", (c) => c.notite],
    ["ordine", (c) => Number(c.ordine)],
    ["ascunsa_in", (c) => (ascunsa.get(Number(c.id)) ?? []).sort().join(" ")]
  ]);
}
