// Afișare și date partajate între ecrane.
import * as api from "./db.js";
import { fmt, isoRo } from "./format.js";
import { totalDatorii } from "./calc.js";
import { h } from "./ui.js";

export const emoji = (owner) => (owner === "Isabela" ? "🌸" : "🔷");
export const semn = (n) => (Number(n) < 0 ? "neg" : "pos");

export const stat = (lbl, n, colorat) => h("div", { class: "stat" },
  h("span", { class: "lbl" }, lbl), h("span", { class: colorat ? `val ${semn(n)}` : "val" }, fmt(n)));

export function seteazaVal(el, n) {
  el.textContent = fmt(n);
  el.className = "val " + semn(n);
}

export function umpleSelect(sel, optiuni, selectat) {
  sel.replaceChildren(...optiuni.map(([v, text]) => h("option", { value: v, selected: String(v) === String(selectat) }, text)));
}

let categorii = null;
export async function getCategorii() {
  categorii ??= await api.getCategorii();
  return categorii;
}
export function invalideazaCategorii() {
  categorii = null;
}
export const optiuniCategorii = (lista) => lista.map((c) => [c.id, `${emoji(c.owner)} ${c.nume}`]);

export function cardDatorii(lista) {
  if (!lista.length) {
    return h("div", { class: "card" }, h("strong", {}, "💸 Împrumuturi deschise"),
      h("div", { class: "muted mt" }, "Nu ai datorii active."));
  }
  return h("div", { class: "card" },
    h("div", { class: "card-head" }, h("strong", {}, "💸 Împrumuturi deschise"), h("span", { class: "val neg" }, fmt(totalDatorii(lista)))),
    lista.map((x) => h("div", { class: "item" },
      h("div", { class: "item-top" }, h("span", {}, `${x.din} → ${x.in_}`), h("span", { class: "val neg" }, fmt(x.sold))),
      h("div", { class: "item-sub" }, `${isoRo(x.data)} • sumă ${fmt(x.suma)} • rambursat ${fmt(x.rambursat)}`))));
}
