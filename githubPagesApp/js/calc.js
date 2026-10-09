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

// Doar categoriile cu țintă; procent 0–100 pentru bara de progres.
export function construiesteProgres(strategie) {
  return strategie.items
    .filter((i) => i.tinta > 0)
    .map((i) => ({ ...i, procent: Math.round(Math.min(100, Math.max(0, (i.pus / i.tinta) * 100))) }));
}

const potriveste = (c, categorieId) => categorieId == null || Number(c.categorie_id) === Number(categorieId);

// 12 valori (ianuarie–decembrie) pentru un an; categorieId null = toate categoriile.
export function serieLunara(celule, an, categorieId) {
  const v = Array(12).fill(0);
  for (const c of celule) {
    if (Number(c.an) === an && potriveste(c, categorieId)) v[Number(c.luna) - 1] += Number(c.valoare) || 0;
  }
  return v.map(r2);
}

// Soldul cumulat lună de lună, de la prima până la ultima lună cu date (lunile goale păstrează soldul).
export function soldCumulat(celule, categorieId) {
  const per = new Map();
  for (const c of celule) {
    if (!potriveste(c, categorieId)) continue;
    const k = Number(c.an) * 12 + Number(c.luna) - 1;
    per.set(k, (per.get(k) ?? 0) + (Number(c.valoare) || 0));
  }
  if (!per.size) return [];
  const chei = [...per.keys()];
  const out = [];
  let sold = 0;
  for (let k = Math.min(...chei); k <= Math.max(...chei); k++) {
    sold += per.get(k) ?? 0;
    out.push({ an: Math.floor(k / 12), luna: (k % 12) + 1, sold: r2(sold) });
  }
  return out;
}

export function totalDatorii(imprumuturi) {
  return r2(imprumuturi.reduce((s, x) => s + (Number(x.sold) || 0), 0));
}
