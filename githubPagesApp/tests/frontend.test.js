import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, isoLocal, isoRo, parseSuma, LUNI } from "../js/format.js";
import { construiesteBuget, construiesteStrategie, totalDatorii } from "../js/calc.js";

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
