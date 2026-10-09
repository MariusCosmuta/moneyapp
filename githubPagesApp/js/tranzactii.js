import * as api from "./db.js";
import { fmt, isoRo, parseSuma, LUNI } from "./format.js";
import { $, h, toast, cuButon, info, inBox } from "./ui.js";
import { inregistreaza, go } from "./nav.js";
import { emoji, semn, umpleSelect, getCategorii, optiuniCategorii } from "./comun.js";

const TIP = { rambursare: "↩ Rambursare", sold_initial: "Sold inițial" };
let filtru = null;
let curenta = null;

async function setupLista() {
  if (!filtru) {
    const azi = new Date();
    filtru = { an: azi.getFullYear(), luna: azi.getMonth() + 1, sterse: false };
  }
  const ani = await api.getAni();
  if (!ani.includes(filtru.an)) ani.push(filtru.an);
  umpleSelect($("t_an"), ani.sort((a, b) => a - b).map((a) => [a, a]), filtru.an);
  umpleSelect($("t_luna"), LUNI.map((l, i) => [i + 1, l]), filtru.luna);
  $("t_sterse").checked = filtru.sterse;
  await incarcaLista();
}

function incarcaLista() {
  return inBox($("t_lista"), "Se încarcă…", async () => {
    const [lista, cats] = await Promise.all([api.getTranzactii(filtru), getCategorii()]);
    if (!lista.length) return info(filtru.sterse ? "Nicio tranzacție ștearsă în luna aleasă." : "Nicio tranzacție în luna aleasă.");
    const dupaId = new Map(cats.map((c) => [Number(c.id), c]));
    const total = lista.reduce((s, t) => s + Number(t.suma), 0);
    return h("div", { class: "card" },
      h("div", { class: "card-head" }, h("strong", {}, `${lista.length} tranzacții`), h("span", { class: `val ${semn(total)}` }, fmt(total))),
      lista.map((t) => rand(t, dupaId.get(Number(t.categorie_id)))));
  });
}

function rand(t, cat) {
  const continut = [
    h("div", { class: "item-top" },
      h("span", {}, `${emoji(cat?.owner)} ${cat?.nume ?? "?"}`), h("span", { class: `val ${semn(t.suma)}` }, fmt(t.suma))),
    h("div", { class: "item-sub" }, [isoRo(t.data), t.nota || TIP[t.tip]].filter(Boolean).join(" • "))
  ];
  if (filtru.sterse) {
    const btn = h("button", { class: "link", type: "button" }, "↩ Restaurează");
    btn.addEventListener("click", () => cuButon(btn, async () => {
      await api.stergeTranzactie(t.id, false);
      toast("✓ Restaurată", true);
      await incarcaLista();
    }, "⏳ …"));
    return h("div", { class: "item" }, continut, btn);
  }
  const b = h("button", { class: "item-btn", type: "button" }, continut);
  b.addEventListener("click", () => { curenta = t; go("tr_edit"); });
  return b;
}

async function setupEdit() {
  if (!curenta) return go("tranzactii");
  const t = curenta;
  $("te_info").textContent = t.tip === "rambursare" ? "Rambursare: categoria e cea a împrumutului."
    : t.tip === "sold_initial" ? "Sold inițial adus din Sheet la migrare." : "";
  $("te_data").value = t.data;
  $("te_suma").value = t.suma;
  $("te_nota").value = t.nota ?? "";
  umpleSelect($("te_cat"), optiuniCategorii(await getCategorii()), t.categorie_id);
  $("te_cat").disabled = t.tip === "rambursare";
}

async function salveaza(btn) {
  const data = $("te_data").value, suma = parseSuma($("te_suma").value);
  if (!data) return toast("Alege data", false);
  if (!suma) return toast("Adaugă suma", false);
  if (curenta.tip === "rambursare" && suma < 0) return toast("Rambursarea trebuie să fie pozitivă", false);
  await cuButon(btn, async () => {
    await api.actualizeazaTranzactie(curenta.id,
      { data, categorieId: Number($("te_cat").value), suma, nota: $("te_nota").value.trim() });
    toast("✓ Salvat!", true);
    go("tranzactii");
  });
}

async function sterge(btn) {
  if (!confirm("Ștergi tranzacția? O poți restaura din „Doar cele șterse”.")) return;
  await cuButon(btn, async () => {
    await api.stergeTranzactie(curenta.id, true);
    toast("✓ Ștearsă", true);
    go("tranzactii");
  }, "⏳ Se șterge…");
}

inregistreaza("tranzactii", setupLista);
inregistreaza("tr_edit", setupEdit);

const schimbaFiltru = () => {
  filtru = { an: Number($("t_an").value), luna: Number($("t_luna").value), sterse: $("t_sterse").checked };
  incarcaLista();
};
$("t_an").addEventListener("change", schimbaFiltru);
$("t_luna").addEventListener("change", schimbaFiltru);
$("t_sterse").addEventListener("change", schimbaFiltru);
$("btn_te_salveaza").addEventListener("click", (e) => salveaza(e.currentTarget));
$("btn_te_sterge").addEventListener("click", (e) => sterge(e.currentTarget));
