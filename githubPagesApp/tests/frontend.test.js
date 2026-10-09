import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, isoLocal, isoRo, parseSuma, sumaRapida, LUNI } from "../js/format.js";
import {
  construiesteBuget, construiesteStrategie, construiesteProgres, totalDatorii, serieLunara, soldCumulat
} from "../js/calc.js";

const nbsp = (s) => s.replace(/\u00a0|\u202f/g, " ");

test("fmt formatează în stil românesc", () => {
  assert.equal(nbsp(fmt(1234.5)), "1.234,50 lei");
  assert.equal(nbsp(fmt(-120)), "-120,00 lei");
  assert.equal(fmt(null), "0,00 lei");
  assert.equal(fmt("12.3"), "12,30 lei");
});

test("isoLocal folosește data locală, nu UTC", () => {
  assert.equal(isoLocal(new Date(2026, 9, 9, 0, 30)), "2026-10-09");
  assert.equal(isoLocal(new Date(2026, 0, 1, 23, 59)), "2026-01-01");
});

test("isoRo", () => {
  assert.equal(isoRo("2026-08-29"), "29.08.2026");
});

test("parseSuma", () => {
  assert.equal(parseSuma("40"), 40);
  assert.equal(parseSuma("-120,5"), -120.5);
  assert.equal(parseSuma(" 12.345 "), 12.35);
  assert.ok(Number.isNaN(parseSuma("")));
  assert.ok(Number.isNaN(parseSuma("abc")));
  assert.ok(Number.isNaN(parseSuma(undefined)));
});

test("LUNI are 12 luni în ordine", () => {
  assert.equal(LUNI.length, 12);
  assert.equal(LUNI[9], "Octombrie");
});

test("sumaRapida: pune suma păstrând semnul, ± inversează", () => {
  assert.equal(sumaRapida("", 200), "200");
  assert.equal(sumaRapida("50", 400), "400");
  assert.equal(sumaRapida("-50", 400), "-400");
  assert.equal(sumaRapida("200", "±"), "-200");
  assert.equal(sumaRapida("-200", "±"), "200");
  assert.equal(sumaRapida("", "±"), "");
});

const CATEGORII = [
  { id: 1, nume: "Siguranta", owner: "Isabela", tinta: 2000, notite: "" },
  { id: 2, nume: "Vacante", owner: "Isabela", tinta: 1200, notite: "vara" },
  { id: 3, nume: "Haine", owner: "Marius", tinta: 0, notite: "" }
];
const CELULE = [
  { luna: 8, categorie_id: 1, valoare: 2000, datorii: -3392 },
  { luna: 10, categorie_id: 1, valoare: "1319.00", datorii: "-475.00" },
  { luna: 10, categorie_id: 2, valoare: 30, datorii: 0 },
  { luna: 10, categorie_id: 3, valoare: 0.1, datorii: 0 },
  { luna: 10, categorie_id: 3, valoare: 0.2, datorii: 0 }
];

test("construiesteBuget: lună, datorii, total an; ascunsele lipsesc din listă dar intră în totaluri", () => {
  const r = construiesteBuget({ categorii: CATEGORII, inactive: [{ categorie_id: 3 }], celule: CELULE, luna: 10 });
  assert.deepEqual(r.lista.map((c) => c.nume), ["Siguranta", "Vacante"]);
  assert.deepEqual(r.lista[0], { id: 1, nume: "Siguranta", owner: "Isabela", luna: 1319, datorii: -475, totalAn: 3319 });
  assert.equal(r.totalLuna, 1349.3);
  assert.equal(r.totalDatorii, -475);
  assert.equal(r.totalAn, 3349.3);
});

test("construiesteBuget: categorie fără mișcări are zero", () => {
  const r = construiesteBuget({ categorii: CATEGORII, inactive: [], celule: [], luna: 1 });
  assert.deepEqual(r.lista[2], { id: 3, nume: "Haine", owner: "Marius", luna: 0, datorii: 0, totalAn: 0 });
  assert.equal(r.totalLuna, 0);
});

test("construiesteStrategie: pus = valoarea lunii, ok când pus >= țintă", () => {
  const r = construiesteStrategie({ categorii: CATEGORII, inactive: [{ categorie_id: 3 }], celule: CELULE, luna: 10 });
  assert.deepEqual(r.items, [
    { nume: "Siguranta", owner: "Isabela", notite: "", tinta: 2000, pus: 1319, ok: false },
    { nume: "Vacante", owner: "Isabela", notite: "vara", tinta: 1200, pus: 30, ok: false }
  ]);
  assert.equal(r.totalTinta, 3200);
  assert.equal(r.totalPus, 1349);
  assert.equal(r.ok, false);
});

test("totalDatorii", () => {
  assert.equal(totalDatorii([{ sold: "1866.00" }, { sold: 1526 }, { sold: 0.1 }, { sold: 0.2 }]), 3392.3);
  assert.equal(totalDatorii([]), 0);
});

test("construiesteProgres: fără țintă nu apare; procent limitat la 0–100", () => {
  const items = [
    { nume: "A", tinta: 200, pus: 50, ok: false },
    { nume: "B", tinta: 100, pus: 250, ok: true },
    { nume: "C", tinta: 100, pus: -40, ok: false },
    { nume: "D", tinta: 0, pus: 10, ok: true }
  ];
  assert.deepEqual(construiesteProgres({ items }).map((i) => [i.nume, i.procent]), [["A", 25], ["B", 100], ["C", 0]]);
});

test("serieLunara: 12 valori pe an, pe categorie sau toate", () => {
  const celule = [
    { an: 2026, luna: 1, categorie_id: 1, valoare: 100 },
    { an: 2026, luna: 1, categorie_id: 2, valoare: "50.10" },
    { an: 2026, luna: 3, categorie_id: 1, valoare: -30 },
    { an: 2025, luna: 1, categorie_id: 1, valoare: 999 }
  ];
  assert.deepEqual(serieLunara(celule, 2026, null), [150.1, 0, -30, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(serieLunara(celule, 2026, 2), [50.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(serieLunara(celule, 2024, null), Array(12).fill(0));
});

test("soldCumulat: lună cu lună, completează lunile goale, peste ani", () => {
  const celule = [
    { an: 2026, luna: 2, categorie_id: 1, valoare: -20 },
    { an: 2025, luna: 11, categorie_id: 1, valoare: 100 },
    { an: 2025, luna: 11, categorie_id: 2, valoare: 7 },
    { an: 2025, luna: 12, categorie_id: 2, valoare: 0.1 }
  ];
  assert.deepEqual(soldCumulat(celule, 1), [
    { an: 2025, luna: 11, sold: 100 }, { an: 2025, luna: 12, sold: 100 },
    { an: 2026, luna: 1, sold: 100 }, { an: 2026, luna: 2, sold: 80 }
  ]);
  assert.deepEqual(soldCumulat(celule, null).map((p) => p.sold), [107, 107.1, 107.1, 87.1]);
  assert.deepEqual(soldCumulat([], null), []);
});
