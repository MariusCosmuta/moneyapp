import { test } from "node:test";
import assert from "node:assert/strict";
import { laCsv, csvTranzactii, csvImprumuturi, csvCategorii } from "../js/csv.js";
import { intervalLuna } from "../js/format.js";

const linii = (csv) => csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");

test("laCsv: BOM, ghilimele, virgule, rânduri noi, null", () => {
  const csv = laCsv([{ a: 'x, "y"', b: "două\nlinii", c: null }], [["a", (r) => r.a], ["b", (r) => r.b], ["c", (r) => r.c]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(csv, '\uFEFFa,b,c\r\n"x, ""y""","două\nlinii",\r\n');
});

test("laCsv: textul care începe cu = + - @ e neutralizat, numerele nu", () => {
  const csv = laCsv([{ t: "=HYPERLINK(\"x\")", n: -650 }, { t: "-text", n: 0 }, { t: "@cmd", n: 1.5 }],
    [["t", (r) => r.t], ["n", (r) => r.n]]);
  assert.deepEqual(linii(csv), ["t,n", "\"'=HYPERLINK(\"\"x\"\")\",-650", "'-text,0", "'@cmd,1.5"]);
});

const D = {
  categorii: [
    { id: 1, nume: "Siguranta", owner: "Isabela", tinta: 2000, notite: "", ordine: 0 },
    { id: 2, nume: "Vacante", owner: "Isabela", tinta: 1200, notite: "a, b", ordine: 1 }
  ],
  categorii_inactive: [{ categorie_id: 2, an: 2026 }, { categorie_id: 2, an: 2025 }],
  imprumuturi: [{ id: 3, data: "2026-08-29", din_id: 1, in_id: 2, suma: 3135, rambursat_legacy: 1579, nota: "Mamaie", deleted_at: null }],
  tranzactii: [
    { id: 10, data: "2026-10-09", categorie_id: 2, suma: 30, nota: "↩ Rambursare", tip: "rambursare", imprumut_id: 3, deleted_at: null, created_at: "2026-10-09T10:00:00Z" },
    { id: 11, data: "2026-10-10", categorie_id: 2, suma: 100, nota: "", tip: "rambursare", imprumut_id: 3, deleted_at: "2026-10-10T11:00:00Z", created_at: "x" },
    { id: 12, data: "2026-10-01", categorie_id: 1, suma: -650.5, nota: "", tip: "intrare", imprumut_id: null, deleted_at: null, created_at: "y" }
  ]
};

test("csvTranzactii: nume categorie, toate rândurile (inclusiv șterse)", () => {
  const l = linii(csvTranzactii(D));
  assert.equal(l[0], "id,data,categorie,suma,nota,tip,imprumut_id,sters_la,creat_la");
  assert.equal(l.length, 4);
  assert.equal(l[1], "10,2026-10-09,Vacante,30,↩ Rambursare,rambursare,3,,2026-10-09T10:00:00Z");
  assert.equal(l[3], "12,2026-10-01,Siguranta,-650.5,,intrare,,,y");
});

test("csvImprumuturi: rambursat = vechi + rambursări active", () => {
  const l = linii(csvImprumuturi(D));
  assert.equal(l[0], "id,data,din,in,suma,rambursat,sold,nota,sters_la");
  assert.equal(l[1], "3,2026-08-29,Siguranta,Vacante,3135,1609,1526,Mamaie,");
});

test("csvCategorii: anii în care e ascunsă", () => {
  const l = linii(csvCategorii(D));
  assert.equal(l[0], "id,nume,owner,tinta,notite,ordine,ascunsa_in");
  assert.equal(l[1], "1,Siguranta,Isabela,2000,,0,");
  assert.equal(l[2], '2,Vacante,Isabela,1200,"a, b",1,2025 2026');
});

test("intervalLuna", () => {
  assert.deepEqual(intervalLuna(2026, 10), ["2026-10-01", "2026-11-01"]);
  assert.deepEqual(intervalLuna(2026, 12), ["2026-12-01", "2027-01-01"]);
  assert.deepEqual(intervalLuna(2026, 1), ["2026-01-01", "2026-02-01"]);
});
