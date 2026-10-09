import * as api from "./db.js";
import { fmt, LUNI } from "./format.js";
import { serieLunara, soldCumulat } from "./calc.js";
import { $, h, info, inBox } from "./ui.js";
import { inregistreaza } from "./nav.js";
import { semn, umpleSelect, getCategorii, optiuniCategorii } from "./comun.js";

const NS = "http://www.w3.org/2000/svg";
const L = 340, H = 180, ST = 8, DR = 8, SUS = 10, JOS = 22;

let celule = [];

function s(tag, attrs = {}, ...copii) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...copii.flat().filter((c) => c != null));
  return el;
}

function scara(valori) {
  const max = Math.max(0, ...valori), min = Math.min(0, ...valori), span = max - min || 1;
  return (v) => SUS + ((max - v) / span) * (H - SUS - JOS);
}

function grafBare(valori) {
  const y = scara(valori), lat = (L - ST - DR) / 12;
  return s("svg", { viewBox: `0 0 ${L} ${H}`, class: "grafic", role: "img", "aria-label": "Sume pe luni" },
    s("line", { x1: ST, x2: L - DR, y1: y(0), y2: y(0), class: "g-axa" }),
    valori.map((v, i) => s("rect", {
      x: ST + i * lat + lat * 0.15, y: Math.min(y(0), y(v)), width: lat * 0.7,
      height: v ? Math.max(1, Math.abs(y(v) - y(0))) : 0, class: v < 0 ? "g-neg" : "g-pos"
    }, s("title", {}, `${LUNI[i]}: ${fmt(v)}`))),
    LUNI.map((l, i) => s("text", { x: ST + i * lat + lat / 2, y: H - 6, class: "g-txt", "text-anchor": "middle" }, l.slice(0, 3))));
}

function grafLinie(puncte) {
  const y = scara(puncte.map((p) => p.sold)), n = puncte.length;
  const x = (i) => (n === 1 ? L / 2 : ST + (i * (L - ST - DR)) / (n - 1));
  return s("svg", { viewBox: `0 0 ${L} ${H}`, class: "grafic", role: "img", "aria-label": "Sold cumulat" },
    s("line", { x1: ST, x2: L - DR, y1: y(0), y2: y(0), class: "g-axa" }),
    puncte.map((p, i) => (p.luna === 1 && i > 0
      ? s("line", { x1: x(i), x2: x(i), y1: SUS, y2: H - JOS, class: "g-axa" }) : null)),
    s("polyline", { points: puncte.map((p, i) => `${x(i).toFixed(1)},${y(p.sold).toFixed(1)}`).join(" "), class: "g-linie" }),
    puncte.map((p, i) => (p.luna === 1 || (i === 0 && p.luna <= 9)
      ? s("text", { x: x(i) + 3, y: H - 6, class: "g-txt" }, String(p.an)) : null)));
}

function cardLunar(an, catId) {
  const valori = serieLunara(celule, an, catId);
  const total = valori.reduce((a, b) => a + b, 0);
  return h("div", { class: "card" },
    h("div", { class: "card-head" }, h("strong", {}, `📊 ${an} pe luni`), h("span", { class: `val ${semn(total)}` }, fmt(total))),
    grafBare(valori));
}

function cardCumulat(catId) {
  const puncte = soldCumulat(celule, catId);
  if (!puncte.length) return info("Nicio sumă pentru categoria aleasă.");
  const prim = puncte[0], ultim = puncte[puncte.length - 1];
  return h("div", { class: "card" },
    h("div", { class: "card-head" }, h("strong", {}, "📈 Sold cumulat"), h("span", { class: `val ${semn(ultim.sold)}` }, fmt(ultim.sold))),
    grafLinie(puncte),
    h("div", { class: "item-sub" }, `${LUNI[prim.luna - 1]} ${prim.an} – ${LUNI[ultim.luna - 1]} ${ultim.an}`));
}

function deseneaza() {
  const catId = $("g_cat").value ? Number($("g_cat").value) : null, an = Number($("g_an").value);
  $("g_lunar").replaceChildren(cardLunar(an, catId));
  $("g_cumulat").replaceChildren(cardCumulat(catId));
}

function setup() {
  $("g_cumulat").replaceChildren();
  return inBox($("g_lunar"), "Se încarcă…", async () => {
    const [toate, cats] = await Promise.all([api.getCeluleToate(), getCategorii()]);
    celule = toate;
    const anCurent = new Date().getFullYear();
    const ani = [...new Set([...celule.map((c) => Number(c.an)), anCurent])].sort((a, b) => a - b);
    umpleSelect($("g_cat"), [["", "Toate categoriile"], ...optiuniCategorii(cats)], $("g_cat").value);
    umpleSelect($("g_an"), ani.map((a) => [a, a]), $("g_an").value || anCurent);
    $("g_cumulat").replaceChildren(cardCumulat($("g_cat").value ? Number($("g_cat").value) : null));
    return cardLunar(Number($("g_an").value), $("g_cat").value ? Number($("g_cat").value) : null);
  });
}

inregistreaza("grafice", setup);
$("g_cat").addEventListener("change", deseneaza);
$("g_an").addEventListener("change", deseneaza);
