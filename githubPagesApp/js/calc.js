// Calcule pure pe datele din Supabase (fără DOM, fără rețea).

const r2 = (n) => Math.round(n * 100) / 100;
const zero = () => ({ luna: 0, datorii: 0, totalAn: 0 });

// celule: rânduri din v_buget_celule pentru un an. Totalurile includ și categoriile ascunse (ca în Sheet).
export function construiesteBuget({ categorii, inactive, celule, luna }) {
  const ascunse = new Set(inactive.map((i) => Number(i.categorie_id)));
  const per = new Map();
  const tot = { luna: 0, datorii: 0, an: 0 };
  for (const c of celule) {
    const id = Number(c.categorie_id), v = Number(c.valoare) || 0, d = Number(c.datorii) || 0;
    const e = per.get(id) ?? zero();
    e.totalAn += v; tot.an += v;
    if (Number(c.luna) === luna) { e.luna += v; e.datorii += d; tot.luna += v; tot.datorii += d; }
    per.set(id, e);
  }
  const lista = categorii
    .filter((c) => !ascunse.has(Number(c.id)))
    .map((c) => {
      const e = per.get(Number(c.id)) ?? zero();
      return { id: c.id, nume: c.nume, owner: c.owner, luna: r2(e.luna), datorii: r2(e.datorii), totalAn: r2(e.totalAn) };
    });
  return { lista, totalLuna: r2(tot.luna), totalDatorii: r2(tot.datorii), totalAn: r2(tot.an) };
}

export function construiesteStrategie({ categorii, inactive, celule, luna }) {
  const ascunse = new Set(inactive.map((i) => Number(i.categorie_id)));
  const pus = new Map();
  for (const c of celule) {
    if (Number(c.luna) !== luna) continue;
    const id = Number(c.categorie_id);
    pus.set(id, (pus.get(id) ?? 0) + (Number(c.valoare) || 0));
  }
  const items = categorii
    .filter((c) => !ascunse.has(Number(c.id)))
    .map((c) => {
      const tinta = Number(c.tinta) || 0, p = r2(pus.get(Number(c.id)) ?? 0);
      return { nume: c.nume, owner: c.owner, notite: c.notite || "", tinta, pus: p, ok: p >= tinta };
    });
  const totalTinta = r2(items.reduce((s, i) => s + i.tinta, 0));
  const totalPus = r2(items.reduce((s, i) => s + i.pus, 0));
  return { items, totalTinta, totalPus, ok: totalPus >= totalTinta };
}

export function totalDatorii(imprumuturi) {
  return r2(imprumuturi.reduce((s, x) => s + (Number(x.sold) || 0), 0));
}
