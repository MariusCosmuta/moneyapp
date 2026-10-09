import * as api from "./db.js";
import { fmt, isoLocal, isoRo, parseSuma, sumaRapida, LUNI } from "./format.js";
import { construiesteBuget, construiesteStrategie, construiesteProgres, totalDatorii } from "./calc.js";
import { $, h, ecran, toast, cuButon, info, inBox } from "./ui.js";
import { inregistreaza, go, leagaNavigare } from "./nav.js";
import {
  emoji, stat, seteazaVal, umpleSelect, getCategorii, invalideazaCategorii, optiuniCategorii, cardDatorii
} from "./comun.js";
import "./tranzactii.js";
import "./imprumuturi.js";
import "./categorii.js";
import "./export.js";
import "./grafice.js";

// ---------- Acasă ----------
async function incarcaHome() {
  const azi = new Date(), an = azi.getFullYear(), luna = azi.getMonth() + 1;
  $("lunaLbl").textContent = `(${LUNI[luna - 1]})`;
  const datorii = api.getImprumuturiDeschise();
  inBox($("h_datorii"), "Se încarcă datoriile…", async () => cardDatorii(await datorii));
  inBox($("h_progres"), "Se încarcă progresul…", cardProgres);
  const [tot, lista] = await Promise.all([api.getTotalLuna(an, luna), datorii]);
  seteazaVal($("soldVal"), tot.totalLuna);
  $("datoriiVal").textContent = fmt(totalDatorii(lista));
}

async function cardProgres() {
  const lista = construiesteProgres(await strategieLunaCurenta());
  if (!lista.length) return h("div");
  const atinse = lista.filter((c) => c.ok).length;
  return h("div", { class: "card" },
    h("div", { class: "card-head" }, h("strong", {}, "🎯 Luna asta"), h("span", { class: "muted" }, `${atinse}/${lista.length} atinse`)),
    lista.map((c) => {
      const umplere = h("div", { class: c.ok ? "bar-fill ok" : "bar-fill" });
      umplere.style.width = `${c.procent}%`;
      return h("div", { class: "prog" },
        h("div", { class: "item-top" }, h("span", {}, `${emoji(c.owner)} ${c.nume}`),
          h("span", { class: "muted" }, `${fmt(c.pus)} / ${fmt(c.tinta)}`)),
        h("div", { class: "bar" }, umplere));
    }));
}

// ---------- Intrare rapidă + strategie ----------
async function strategieLunaCurenta() {
  const azi = new Date(), an = azi.getFullYear(), luna = azi.getMonth() + 1;
  const [cats, inactive, celule] = await Promise.all([getCategorii(), api.getInactive(an), api.getCelule(an)]);
  return construiesteStrategie({ categorii: cats, inactive, celule, luna });
}

async function cardStrategie() {
  const luna = new Date().getMonth() + 1;
  const s = await strategieLunaCurenta();
  if (!s.items.length) return h("div");
  return h("div", { class: "card" },
    h("div", { class: "card-head" }, h("strong", {}, `🎯 Strategie — ${LUNI[luna - 1]}`)),
    h("table", { class: "stbl" },
      h("thead", {}, h("tr", {}, h("th", {}, "Categorie"), h("th", { class: "num" }, "Țintă"),
        h("th", { class: "num" }, "Pus"), h("th", { class: "chk" }, "✓"))),
      h("tbody", {},
        s.items.map((c) => h("tr", {},
          h("td", {}, `${emoji(c.owner)} ${c.nume}`, c.notite ? h("div", { class: "nota" }, c.notite) : null),
          h("td", { class: "num" }, fmt(c.tinta)),
          h("td", { class: "num" }, fmt(c.pus)),
          h("td", { class: "chk" }, c.ok ? "✅" : "⬜"))),
        h("tr", { class: "total" },
          h("td", {}, "TOTAL"),
          h("td", { class: "num" }, fmt(s.totalTinta)),
          h("td", { class: "num" }, fmt(s.totalPus)),
          h("td", { class: "chk" }, s.ok ? "✅" : "")))));
}

let ultima = null;

async function setupIntrare() {
  $("i_data").value = isoLocal();
  $("i_suma").value = "";
  $("i_nota").value = "";
  $("btn_i_repeta").disabled = true;
  const strategie = inBox($("i_strategie"), "Se încarcă strategia…", cardStrategie);
  const [cats, u] = await Promise.all([getCategorii(), api.getUltimaIntrare().catch(() => null)]);
  ultima = u;
  umpleSelect($("i_cat"), optiuniCategorii(cats), ultima?.categorie_id);
  $("btn_i_repeta").disabled = !ultima;
  await strategie;
}

function repetaUltima() {
  if (!ultima) return;
  $("i_cat").value = ultima.categorie_id;
  $("i_suma").value = Number(ultima.suma);
  $("i_nota").value = ultima.nota ?? "";
}

async function salveazaIntrare(btn) {
  const data = $("i_data").value, suma = parseSuma($("i_suma").value);
  if (!data) return toast("Alege data", false);
  if (!suma) return toast("Adaugă suma", false);
  await cuButon(btn, async () => {
    const categorieId = Number($("i_cat").value), nota = $("i_nota").value.trim();
    await api.adaugaIntrare({ data, categorieId, suma, nota });
    ultima = { categorie_id: categorieId, suma, nota };
    $("btn_i_repeta").disabled = false;
    $("i_suma").value = "";
    $("i_nota").value = "";
    $("i_suma").focus();
    toast("✓ Salvat!", true);
    inBox($("i_strategie"), "Se încarcă strategia…", cardStrategie);
  });
}

// ---------- Împrumut nou ----------
async function setupImprumut() {
  $("im_data").value = isoLocal();
  $("im_suma").value = "";
  $("im_nota").value = "";
  const opt = optiuniCategorii(await getCategorii());
  umpleSelect($("im_din"), opt);
  umpleSelect($("im_in"), opt);
}

async function salveazaImprumut(btn) {
  const data = $("im_data").value, suma = parseSuma($("im_suma").value);
  const dinId = Number($("im_din").value), inId = Number($("im_in").value);
  if (!data) return toast("Alege data", false);
  if (dinId === inId) return toast("Din și În nu pot fi la fel", false);
  if (!(suma > 0)) return toast("Adaugă o sumă pozitivă", false);
  await cuButon(btn, async () => {
    await api.adaugaImprumut({ data, dinId, inId, suma, nota: $("im_nota").value.trim() });
    toast("✓ Împrumut salvat!", true);
    go("home");
  });
}

// ---------- Rambursare ----------
let deschise = [];

function infoRambursare() {
  const x = deschise[$("rb_imp").value];
  if (!x) return;
  $("rb_info").textContent =
    `Din ${isoRo(x.data)} • Sumă ${fmt(x.suma)} • Rambursat ${fmt(x.rambursat)} • Sold ${fmt(x.sold)}`;
}

async function setupRambursare() {
  $("rb_data").value = isoLocal();
  $("rb_suma").value = "";
  $("rb_info").textContent = "Se încarcă…";
  $("rb_imp").replaceChildren();
  deschise = await api.getImprumuturiDeschise();
  if (!deschise.length) {
    $("rb_info").textContent = "Nu ai împrumuturi deschise.";
    return;
  }
  umpleSelect($("rb_imp"), deschise.map((x, i) => [i, `${x.din} → ${x.in_}  (sold ${fmt(x.sold)})`]));
  infoRambursare();
}

async function salveazaRambursare(btn) {
  const imprumut = deschise[$("rb_imp").value];
  const data = $("rb_data").value, suma = parseSuma($("rb_suma").value);
  if (!imprumut) return toast("Alege un împrumut", false);
  if (!data) return toast("Alege data", false);
  if (!(suma > 0)) return toast("Adaugă o sumă pozitivă", false);
  await cuButon(btn, async () => {
    const sold = await api.adaugaRambursare({ imprumut, data, suma });
    toast("✓ Rambursat! Sold nou: " + fmt(sold), true);
    await setupRambursare();
  });
}

// ---------- Buget ----------
async function setupBuget() {
  const azi = new Date();
  inBox($("b_datorii"), "Se încarcă datoriile…", async () => cardDatorii(await api.getImprumuturiDeschise()));
  await incarcaBuget(azi.getFullYear(), azi.getMonth() + 1);
}

async function incarcaBuget(an, luna) {
  const box = $("b_lista");
  box.replaceChildren(info("Se încarcă…"));
  try {
    const [ani, cats, inactive, celule] = await Promise.all([
      api.getAni(), getCategorii(), api.getInactive(an), api.getCelule(an)
    ]);
    if (!ani.includes(an)) ani.push(an);
    umpleSelect($("b_an"), ani.sort((x, y) => x - y).map((a) => [a, a]), an);
    umpleSelect($("b_luna"), LUNI.map((l, i) => [i + 1, l]), luna);

    const b = construiesteBuget({ categorii: cats, inactive, celule, luna });
    seteazaVal($("b_tl"), b.totalLuna);
    seteazaVal($("b_td"), b.totalDatorii);
    seteazaVal($("b_ta"), b.totalAn);

    box.replaceChildren(...(b.lista.length ? b.lista.map((c) => h("div", { class: "card" },
      h("div", { class: "cat-title" },
        h("span", { class: `cat-dot ${c.owner === "Isabela" ? "isabela" : "marius"}` }), h("strong", {}, c.nume)),
      stat("Lună", c.luna, true),
      stat("Datorii", c.datorii, true),
      stat("Total an", c.totalAn, false))) : [info("Nimic de afișat")]));
  } catch (e) {
    box.replaceChildren(h("div", { class: "card eroare" }, "Eroare: " + e.message));
  }
}

// ---------- autentificare ----------
async function intra(btn) {
  await cuButon(btn, async () => {
    await api.login($("l_email").value.trim(), $("l_parola").value);
    if (!(await api.esteMembru())) {
      await api.logout();
      throw new Error("Contul nu are acces la date.");
    }
    $("l_parola").value = "";
    go("home");
  }, "⏳ Se conectează…");
}

// ---------- pornire ----------
function leagaEvenimente() {
  inregistreaza("home", incarcaHome);
  inregistreaza("intrare", setupIntrare);
  inregistreaza("imprumut", setupImprumut);
  inregistreaza("rambursare", setupRambursare);
  inregistreaza("buget", setupBuget);
  leagaNavigare();
  $("f_login").addEventListener("submit", (e) => {
    e.preventDefault();
    intra(e.submitter ?? $("f_login").querySelector("button"));
  });
  $("btn_logout").addEventListener("click", () => api.logout().catch((e) => toast("Eroare: " + e.message, false)));
  $("btn_intrare").addEventListener("click", (e) => salveazaIntrare(e.currentTarget));
  $("btn_i_repeta").addEventListener("click", repetaUltima);
  $("i_rapid").addEventListener("click", (e) => {
    const v = e.target.closest("button")?.dataset.suma;
    if (!v) return;
    $("i_suma").value = sumaRapida($("i_suma").value, v === "±" ? v : Number(v));
  });
  $("btn_imprumut").addEventListener("click", (e) => salveazaImprumut(e.currentTarget));
  $("btn_rambursare").addEventListener("click", (e) => salveazaRambursare(e.currentTarget));
  $("rb_imp").addEventListener("change", infoRambursare);
  const schimbaPerioada = () => incarcaBuget(Number($("b_an").value), Number($("b_luna").value));
  $("b_an").addEventListener("change", schimbaPerioada);
  $("b_luna").addEventListener("change", schimbaPerioada);
  api.laDeconectare(() => { invalideazaCategorii(); ecran("login"); });
}

async function porneste() {
  leagaEvenimente();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try {
    const s = await api.sesiune();
    go(s && (await api.esteMembru()) ? "home" : "login");
  } catch {
    ecran("login");
  }
}

porneste();
