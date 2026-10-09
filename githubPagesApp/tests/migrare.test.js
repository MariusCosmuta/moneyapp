import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { bazaNoua } from "./helpers/db.js";

// Încarcă scripturile Apps Script într-un context izolat (funcțiile pure nu folosesc API Google).
const ctx = vm.createContext({});
for (const f of ["00_Config.gs", "98_ExportMigrare.gs"]) {
  vm.runInContext(readFileSync(new URL(`../../googleSheetApp/${f}`, import.meta.url), "utf8"), ctx);
}
const { genereazaMigrare_, MONTHS_RO } = ctx;

function randGol(n, valori) {
  const r = Array(n).fill("");
  for (const [i, v] of Object.entries(valori)) r[i] = v;
  return r;
}

// Construiește „Buget <an>" ca getValues(): antet, (lună, Datorii) × 12, TOTAL categorie.
function buget(an, cats, celule) {
  const rows = [["Perioada", ...cats, "Total"]];
  for (const l of MONTHS_RO) {
    rows.push([l, ...cats.map((c) => celule[`${l}|${c}`] ?? ""), 0]);
    rows.push(["Datorii", ...cats.map((c) => celule[`D ${l}|${c}`] ?? ""), 0]);
  }
  rows.push(["TOTAL categorie", ...cats.map(() => 0), 0]);
  return { an, rows };
}

const imp = (data, din, in_, suma, ramb, status, aplicat, rambApp = "") =>
  randGol(26, { 0: data, 1: din, 2: in_, 3: suma, 4: ramb, 5: suma - ramb, 6: status,
    ...(aplicat ? { 19: Number(data.slice(0, 4)), 20: MONTHS_RO[Number(data.slice(5, 7)) - 1], 21: din, 22: in_ } : {}),
    25: rambApp });

const intr = (data, cat, suma, nota, aplicat) =>
  randGol(23, { 0: data, 1: cat, 2: suma, 3: nota, 4: aplicat ? "OK" : "Lipsește anul",
    ...(aplicat ? { 19: Number(data.slice(0, 4)), 20: MONTHS_RO[Number(data.slice(5, 7)) - 1], 21: cat, 22: suma } : {}) });

const CATS = ["Siguranta", "Vacante", "Hobby", "Extra"];
const DATE = {
  categorii: [
    { id: 1, name: "Siguranta", owner: "Marius", suma: 500, notite: "", anActiv: { 2026: "Da", 2027: "Da" } },
    { id: 2, name: "Vacante", owner: "Isabela", suma: 300, notite: "mare", anActiv: { 2026: "Da", 2027: "Nu" } },
    { id: 3, name: "Hobby", owner: "Marius", suma: 0, notite: "", anActiv: {} }
  ],
  bugete: [
    buget(2026, CATS, {
      "Octombrie|Siguranta": 1050, "Octombrie|Vacante": 700, "Octombrie|Hobby": -250,
      "Noiembrie|Vacante": 100, "Iunie|Vacante": 800, "D Iunie|Siguranta": -3500,
      "D Martie|Hobby": -400, "Ianuarie|Hobby": 120, "Februarie|Extra": 10
    }),
    buget(2027, CATS, {})
  ],
  imprumuturi: [
    imp("2026-06-10", "Siguranta", "Vacante", 5000, 1500, "Parțial", true, 700),
    imp("2026-07-01", "Hobby", "Vacante", 100, 200, "EROARE: verifică sumele", false),
    randGol(26, {}),
    imp("2026-03-15", "Hobby", "Siguranta", 300, 0, "Deschis", true)
  ],
  intrari: [
    intr("2026-10-01", "Siguranta", 1000, "", true),
    intr("2026-10-05", "Vacante", 700, "↩ Rambursare: Siguranta → Vacante (împrumut din 10.06.2026)", true),
    intr("2025-05-01", "Hobby", 50, "", false),
    intr("2026-10-02", "Hobby", -250, "cu 'apostrof'", true),
    intr("2026-11-01", "Vacante", 100, "↩ Rambursare: Hobby → Vacante (împrumut din 01.01.2026)", true)
  ]
};

test("raportul semnalează rândurile neimportate și diferențele", () => {
  const { probleme } = genereazaMigrare_(DATE, "test");
  const text = probleme.join("\n");
  assert.match(text, /Categoria „Extra” apare în Buget 2026/);
  assert.match(text, /Împrumuturi rândul 3: nu e aplicat/);
  assert.match(text, /Intrări rândul 4: nu e aplicat/);
  assert.match(text, /Intrări rândul 6: rambursare fără împrumut potrivit/);
  assert.match(text, /Buget 2026, Martie, Hobby: Datorii în Sheet -400\.00, calculat din împrumuturi -300\.00/);
  assert.doesNotMatch(text, /Împrumuturi rândul 2/);
  assert.equal(probleme.length, 5);
});

test("SQL-ul generat se încarcă, trece verificarea și reproduce bugetul din Sheet", async () => {
  const { sql } = genereazaMigrare_(DATE, "test");
  const db = await bazaNoua();
  await db.exec(sql);

  const [loan] = (await db.query("select * from v_imprumuturi where din = 'Siguranta'")).rows;
  assert.equal(Number(loan.rambursat_legacy), 800);
  assert.equal(Number(loan.rambursat), 1500);
  assert.equal(Number(loan.sold), 3500);
  assert.equal(loan.status, "Parțial");

  const tipuri = (await db.query("select tip, count(*)::int as n from tranzactii group by tip order by tip")).rows;
  assert.deepEqual(tipuri.map((r) => [r.tip, r.n]), [["intrare", 3], ["rambursare", 1], ["sold_initial", 3]]);

  const nota = (await db.query("select nota from tranzactii where suma = -250")).rows[0].nota;
  assert.equal(nota, "cu 'apostrof'");

  const [oct] = (await db.query("select * from v_buget_luna where an = 2026 and luna = 10")).rows;
  assert.equal(Number(oct.total_luna), 1500);

  const inactive = (await db.query(
    "select c.nume, i.an from categorii_inactive i join categorii c on c.id = i.categorie_id")).rows;
  assert.deepEqual(inactive.map((r) => [r.nume, r.an]), [["Vacante", 2027]]);

  const [cat] = (await db.query("insert into categorii (nume) values ('Noua') returning id")).rows;
  assert.equal(Number(cat.id), 5);
});

test("migrarea refuză să ruleze a doua oară", async () => {
  const { sql } = genereazaMigrare_(DATE, "test");
  const db = await bazaNoua();
  await db.exec(sql);
  await assert.rejects(db.exec(sql), /nu e goală/);
});

test("dacă bugetul calculat diferă de Sheet, nu se salvează nimic", async () => {
  const { sql } = genereazaMigrare_(DATE, "test");
  const stricat = sql.replace("(2026, 10, 1, 1050.00, 0.00)", "(2026, 10, 1, 1051.00, 0.00)");
  assert.notEqual(stricat, sql);
  const db = await bazaNoua();
  await assert.rejects(db.exec(stricat), /Verificare eșuată: 1 celule/);
  await db.exec("rollback");
  assert.equal((await db.query("select count(*)::int as n from categorii")).rows[0].n, 0);
});
