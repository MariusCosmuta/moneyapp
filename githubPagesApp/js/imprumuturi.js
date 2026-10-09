import * as api from "./db.js";
import { fmt, isoRo, parseSuma } from "./format.js";
import { $, h, toast, cuButon, info, inBox } from "./ui.js";
import { inregistreaza, go } from "./nav.js";
import { umpleSelect, getCategorii, optiuniCategorii } from "./comun.js";

let sterse = false;
let curent = null;

function setupLista() {
  $("il_sterse").checked = sterse;
  return incarcaLista();
}

function incarcaLista() {
  return inBox($("il_lista"), "Se încarcă…", async () => {
    const [lista, cats] = await Promise.all([api.getImprumuturi({ sterse }), getCategorii()]);
    if (!lista.length) return info(sterse ? "Niciun împrumut șters." : "Nu ai împrumuturi.");
    const nume = new Map(cats.map((c) => [Number(c.id), c.nume]));
    return h("div", { class: "card" }, lista.map((x) => rand(x, nume)));
  });
}

function rand(x, nume) {
  const din = x.din ?? nume.get(Number(x.din_id)) ?? "?";
  const in_ = x.in_ ?? nume.get(Number(x.in_id)) ?? "?";
  const stare = x.status ? `${x.status} • sold ${fmt(x.sold)}` : null;
  const continut = [
    h("div", { class: "item-top" }, h("span", {}, `${din} → ${in_}`), h("span", { class: "val" }, fmt(x.suma))),
    h("div", { class: "item-sub" }, [isoRo(x.data), stare, x.nota].filter(Boolean).join(" • "))
  ];
  if (sterse) {
    const btn = h("button", { class: "link", type: "button" }, "↩ Restaurează");
    btn.addEventListener("click", () => cuButon(btn, async () => {
      await api.stergeImprumut(x.id, false);
      toast("✓ Restaurat", true);
      await incarcaLista();
    }, "⏳ …"));
    return h("div", { class: "item" }, continut, btn);
  }
  const b = h("button", { class: "item-btn", type: "button" }, continut);
  b.addEventListener("click", () => { curent = x; go("imp_edit"); });
  return b;
}

async function setupEdit() {
  if (!curent) return go("imprumuturi");
  const x = curent;
  $("ie_info").textContent = `Rambursat ${fmt(x.rambursat)} • Sold ${fmt(x.sold)} • ${x.status}`;
  $("ie_data").value = x.data;
  $("ie_suma").value = x.suma;
  $("ie_nota").value = x.nota ?? "";
  const opt = optiuniCategorii(await getCategorii());
  umpleSelect($("ie_din"), opt, x.din_id);
  umpleSelect($("ie_in"), opt, x.in_id);
}

async function salveaza(btn) {
  const data = $("ie_data").value, suma = parseSuma($("ie_suma").value);
  const dinId = Number($("ie_din").value), inId = Number($("ie_in").value);
  if (!data) return toast("Alege data", false);
  if (dinId === inId) return toast("Din și În nu pot fi la fel", false);
  if (!(suma > 0)) return toast("Adaugă o sumă pozitivă", false);
  await cuButon(btn, async () => {
    await api.actualizeazaImprumut(curent.id, { data, dinId, inId, suma, nota: $("ie_nota").value.trim() });
    toast("✓ Salvat!", true);
    go("imprumuturi");
  });
}

async function sterge(btn) {
  if (!confirm("Ștergi împrumutul? Îl poți restaura din „Doar cele șterse”.")) return;
  await cuButon(btn, async () => {
    await api.stergeImprumut(curent.id, true);
    toast("✓ Șters", true);
    go("imprumuturi");
  }, "⏳ Se șterge…");
}

inregistreaza("imprumuturi", setupLista);
inregistreaza("imp_edit", setupEdit);

$("il_sterse").addEventListener("change", () => { sterse = $("il_sterse").checked; incarcaLista(); });
$("btn_ie_salveaza").addEventListener("click", (e) => salveaza(e.currentTarget));
$("btn_ie_sterge").addEventListener("click", (e) => sterge(e.currentTarget));
