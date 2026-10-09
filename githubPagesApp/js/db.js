// Singurul modul care vorbește cu Supabase.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { isoRo, intervalLuna } from "./format.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const PAGINA = 1000; // limita implicită de rânduri pe cerere în Supabase

const MESAJE = {
  "23503": "E folosită în tranzacții sau împrumuturi (inclusiv șterse), nu se poate șterge.",
  "23505": "Există deja (nume sau an duplicat)."
};

function rez({ data, error }) {
  if (error) throw new Error(MESAJE[error.code] ?? error.message);
  return data;
}

// --- autentificare ---
export async function sesiune() {
  return rez(await sb.auth.getSession()).session;
}
export async function login(email, parola) {
  const { error } = await sb.auth.signInWithPassword({ email, password: parola });
  if (error) throw new Error(error.code === "invalid_credentials" ? "Email sau parolă greșită." : error.message);
}
export async function logout() {
  rez(await sb.auth.signOut());
}
export async function esteMembru() {
  return rez(await sb.rpc("este_membru")) === true;
}
export function laDeconectare(cb) {
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") cb(); });
}

// --- citire ---
export async function getCategorii() {
  return rez(await sb.from("categorii").select("id, nume, owner, tinta, notite, ordine").order("ordine").order("nume"));
}
export async function getInactive(an) {
  return rez(await sb.from("categorii_inactive").select("categorie_id").eq("an", an));
}
export async function getCelule(an) {
  return rez(await sb.from("v_buget_celule").select("luna, categorie_id, valoare, datorii").eq("an", an));
}
export async function getTotalLuna(an, luna) {
  const r = rez(await sb.from("v_buget_luna").select("total_luna, total_datorii").eq("an", an).eq("luna", luna).maybeSingle());
  return { totalLuna: Number(r?.total_luna) || 0, totalDatorii: Number(r?.total_datorii) || 0 };
}
export async function getAni() {
  const [a, b] = await Promise.all([sb.from("ani").select("an"), sb.from("v_buget_luna").select("an")]);
  return [...new Set([...rez(a), ...rez(b)].map((r) => Number(r.an)))].sort((x, y) => x - y);
}
export async function getImprumuturiDeschise() {
  return rez(await sb.from("v_imprumuturi")
    .select("id, data, din, in_, in_id, suma, rambursat, sold, status")
    .neq("status", "Rambursat").order("data").order("id"));
}

// --- scriere ---
export async function adaugaIntrare({ data, categorieId, suma, nota }) {
  rez(await sb.from("tranzactii").insert({ data, categorie_id: categorieId, suma, nota, tip: "intrare" }));
}
export async function adaugaImprumut({ data, dinId, inId, suma, nota }) {
  rez(await sb.from("imprumuturi").insert({ data, din_id: dinId, in_id: inId, suma, nota }));
}
// Întoarce soldul rămas după rambursare.
export async function adaugaRambursare({ imprumut, data, suma }) {
  rez(await sb.from("tranzactii").insert({
    data, suma, tip: "rambursare", imprumut_id: imprumut.id, categorie_id: imprumut.in_id,
    nota: `↩ Rambursare: ${imprumut.din} → ${imprumut.in_} (împrumut din ${isoRo(imprumut.data)})`
  }));
  const r = rez(await sb.from("v_imprumuturi").select("sold").eq("id", imprumut.id).single());
  return Number(r.sold) || 0;
}

// --- tranzacții: listă, editare, ștergere reversibilă ---
export async function getTranzactii({ an, luna, sterse }) {
  const [de, pana] = intervalLuna(an, luna);
  const q = sb.from("tranzactii").select("id, data, categorie_id, suma, nota, tip, imprumut_id")
    .gte("data", de).lt("data", pana)
    .order("data", { ascending: false }).order("id", { ascending: false });
  return rez(await (sterse ? q.not("deleted_at", "is", null) : q.is("deleted_at", null)));
}
export async function actualizeazaTranzactie(id, { data, categorieId, suma, nota }) {
  rez(await sb.from("tranzactii").update({ data, categorie_id: categorieId, suma, nota }).eq("id", id));
}
export async function stergeTranzactie(id, sters) {
  rez(await sb.from("tranzactii").update({ deleted_at: sters ? new Date().toISOString() : null }).eq("id", id));
}

// --- împrumuturi: listă, editare, ștergere reversibilă ---
export async function getImprumuturi({ sterse }) {
  if (sterse) {
    return rez(await sb.from("imprumuturi").select("id, data, din_id, in_id, suma, nota")
      .not("deleted_at", "is", null).order("data", { ascending: false }).order("id", { ascending: false }));
  }
  return rez(await sb.from("v_imprumuturi")
    .select("id, data, din_id, din, in_id, in_, suma, nota, rambursat, sold, status")
    .order("data", { ascending: false }).order("id", { ascending: false }));
}
export async function actualizeazaImprumut(id, { data, dinId, inId, suma, nota }) {
  rez(await sb.from("imprumuturi").update({ data, din_id: dinId, in_id: inId, suma, nota }).eq("id", id));
}
export async function stergeImprumut(id, sters) {
  rez(await sb.from("imprumuturi").update({ deleted_at: sters ? new Date().toISOString() : null }).eq("id", id));
}

// --- categorii și ani ---
// Întoarce id-ul categoriei (nouă sau existentă).
export async function salveazaCategorie({ id, nume, owner, tinta, notite, ordine }) {
  const c = { nume, owner, tinta, notite, ordine };
  if (id) {
    rez(await sb.from("categorii").update(c).eq("id", id));
    return id;
  }
  return rez(await sb.from("categorii").insert(c).select("id").single()).id;
}
export async function stergeCategorie(id) {
  rez(await sb.from("categorii").delete().eq("id", id));
}
export async function getInactiveToate() {
  return rez(await sb.from("categorii_inactive").select("categorie_id, an"));
}
export async function seteazaInactive(categorieId, aniInactivi, aniActivi) {
  if (aniInactivi.length) {
    rez(await sb.from("categorii_inactive")
      .upsert(aniInactivi.map((an) => ({ categorie_id: categorieId, an })), { ignoreDuplicates: true }));
  }
  if (aniActivi.length) {
    rez(await sb.from("categorii_inactive").delete().eq("categorie_id", categorieId).in("an", aniActivi));
  }
}
export async function getAniTabel() {
  return rez(await sb.from("ani").select("an").order("an")).map((r) => Number(r.an));
}
export async function adaugaAn(an) {
  rez(await sb.from("ani").insert({ an }));
}

// --- export complet (cu paginare) ---
async function toate(tabela, ordine) {
  const out = [];
  for (let de = 0; ; de += PAGINA) {
    let q = sb.from(tabela).select("*");
    for (const o of ordine) q = q.order(o);
    const r = rez(await q.range(de, de + PAGINA - 1));
    out.push(...r);
    if (r.length < PAGINA) return out;
  }
}
export async function exportTot() {
  const [categorii, ani, categoriiInactive, imprumuturi, tranzactii] = await Promise.all([
    toate("categorii", ["id"]), toate("ani", ["an"]), toate("categorii_inactive", ["categorie_id", "an"]),
    toate("imprumuturi", ["id"]), toate("tranzactii", ["id"])
  ]);
  return { generat_la: new Date().toISOString(), categorii, ani, categorii_inactive: categoriiInactive, imprumuturi, tranzactii };
}
