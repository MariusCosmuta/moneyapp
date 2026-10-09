import * as api from "./db.js";
import { fmt, parseSuma } from "./format.js";
import { $, h, toast, cuButon, inBox } from "./ui.js";
import { inregistreaza, go } from "./nav.js";
import { emoji, umpleSelect, getCategorii, invalideazaCategorii } from "./comun.js";

let ani = [];
let ascunsePe = new Map(); // categorie_id → [ani în care e ascunsă]
let curenta = null;        // null = categorie nouă

function setupLista() {
  return inBox($("cl_lista"), "Se încarcă…", async () => {
    const [cats, inactive, aniTabel] = await Promise.all([getCategorii(), api.getInactiveToate(), api.getAniTabel()]);
    ani = aniTabel;
    ascunsePe = new Map();
    for (const i of inactive) {
      const id = Number(i.categorie_id);
      ascunsePe.set(id, [...(ascunsePe.get(id) ?? []), Number(i.an)].sort());
    }
    $("cl_ani").textContent = ani.length ? ani.join(", ") : "Niciun an.";
    return h("div", { class: "card" }, cats.map((c) => {
      const ascunsa = ascunsePe.get(Number(c.id));
      const b = h("button", { class: "item-btn", type: "button" },
        h("div", { class: "item-top" }, h("span", {}, `${emoji(c.owner)} ${c.nume}`), h("span", { class: "val" }, fmt(c.tinta))),
        h("div", { class: "item-sub" }, ["țintă lunară", ascunsa ? `ascunsă în ${ascunsa.join(", ")}` : null, c.notite]
          .filter(Boolean).join(" • ")));
      b.addEventListener("click", () => { curenta = c; go("cat_edit"); });
      return b;
    }));
  });
}

function setupEdit() {
  const c = curenta;
  $("ce_titlu").textContent = c ? "✏️ Editează categoria" : "➕ Categorie nouă";
  $("ce_nume").value = c?.nume ?? "";
  umpleSelect($("ce_owner"), [["Marius", "🔷 Marius"], ["Isabela", "🌸 Isabela"]], c?.owner ?? "Marius");
  $("ce_tinta").value = c ? c.tinta : "";
  $("ce_notite").value = c?.notite ?? "";
  const ascunse = c ? (ascunsePe.get(Number(c.id)) ?? []) : [];
  $("ce_ani").replaceChildren(...(ani.length
    ? ani.map((an) => h("label", { class: "check" },
      h("input", { type: "checkbox", value: an, checked: !ascunse.includes(an) }), ` ${an}`))
    : [h("div", { class: "muted" }, "Adaugă întâi un an.")]));
  $("btn_ce_sterge").classList.toggle("hide", !c);
}

async function salveaza(btn) {
  const nume = $("ce_nume").value.trim();
  const tintaText = $("ce_tinta").value.trim();
  const tinta = tintaText === "" ? 0 : parseSuma(tintaText);
  if (!nume) return toast("Adaugă numele", false);
  if (Number.isNaN(tinta) || tinta < 0) return toast("Țintă invalidă", false);
  const bife = [...$("ce_ani").querySelectorAll("input[type=checkbox]")];
  await cuButon(btn, async () => {
    const cats = await getCategorii();
    const ordine = curenta ? curenta.ordine : Math.max(-1, ...cats.map((c) => Number(c.ordine) || 0)) + 1;
    const id = await api.salveazaCategorie({
      id: curenta?.id, nume, owner: $("ce_owner").value, tinta, notite: $("ce_notite").value.trim(), ordine
    });
    await api.seteazaInactive(id,
      bife.filter((b) => !b.checked).map((b) => Number(b.value)),
      bife.filter((b) => b.checked).map((b) => Number(b.value)));
    invalideazaCategorii();
    toast("✓ Salvat!", true);
    go("categorii");
  });
}

async function sterge(btn) {
  if (!confirm(`Ștergi categoria „${curenta.nume}”? Merge doar dacă nu e folosită nicăieri.`)) return;
  await cuButon(btn, async () => {
    await api.stergeCategorie(curenta.id);
    invalideazaCategorii();
    toast("✓ Ștearsă", true);
    go("categorii");
  }, "⏳ Se șterge…");
}

async function adaugaAn(btn) {
  const an = Number($("cl_an_nou").value);
  if (!Number.isInteger(an) || an < 2000 || an > 2100) return toast("An invalid (2000–2100)", false);
  await cuButon(btn, async () => {
    await api.adaugaAn(an);
    $("cl_an_nou").value = "";
    toast(`✓ Am adăugat ${an}`, true);
    await setupLista();
  });
}

inregistreaza("categorii", setupLista);
inregistreaza("cat_edit", setupEdit);

$("btn_cat_noua").addEventListener("click", () => { curenta = null; go("cat_edit"); });
$("btn_ce_salveaza").addEventListener("click", (e) => salveaza(e.currentTarget));
$("btn_ce_sterge").addEventListener("click", (e) => sterge(e.currentTarget));
$("btn_cl_an").addEventListener("click", (e) => adaugaAn(e.currentTarget));
