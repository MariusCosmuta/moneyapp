import { test } from "node:test";
import assert from "node:assert/strict";
import { bazaNoua, ca, MEMBRU, STRAIN } from "./helpers/db.js";

const m = (db, sql, params) => ca(db, MEMBRU, sql, params);

async function seed(db) {
  const cats = await m(db, `insert into categorii (nume, owner, tinta) values
    ('Siguranta', 'Marius', 500), ('Vacante', 'Isabela', 300), ('Hobby', 'Marius', 100)
    returning id, nume`);
  const id = Object.fromEntries(cats.map((c) => [c.nume, c.id]));
  const [imp] = await m(db, `insert into imprumuturi (data, din_id, in_id, suma)
    values ('2026-06-10', $1, $2, 5000) returning id`, [id.Siguranta, id.Vacante]);
  return { id, impId: imp.id };
}

const ramburseaza = (db, impId, data, suma) =>
  m(db, `insert into tranzactii (data, suma, tip, imprumut_id) values ($1, $2, 'rambursare', $3) returning *`,
    [data, suma, impId]);

const imprumut = async (db, impId) =>
  (await m(db, "select * from v_imprumuturi where id = $1", [impId]))[0];

const celula = async (db, an, luna, catId) =>
  (await m(db, "select * from v_buget_celule where an = $1 and luna = $2 and categorie_id = $3",
    [an, luna, catId]))[0];

test("schema se încarcă fără erori", async () => {
  const db = await bazaNoua();
  const r = await db.query("select count(*)::int as n from pg_tables where schemaname = 'public'");
  assert.equal(r.rows[0].n, 7);
});

test("anonimul nu are acces", async () => {
  const db = await bazaNoua();
  await seed(db);
  await assert.rejects(ca(db, null, "select * from tranzactii"), /permission denied/);
  await assert.rejects(ca(db, null, "select * from v_imprumuturi"), /permission denied/);
  await assert.rejects(ca(db, null, "select public.este_membru()"), /permission denied/);
});

test("utilizator autentificat dar nemembru nu vede și nu scrie nimic", async () => {
  const db = await bazaNoua();
  const { id } = await seed(db);
  assert.equal((await ca(db, STRAIN, "select * from categorii")).length, 0);
  assert.equal((await ca(db, STRAIN, "select * from v_imprumuturi")).length, 0);
  assert.equal((await ca(db, STRAIN, "select * from audit_log")).length, 0);
  assert.equal((await ca(db, STRAIN, "select * from membri")).length, 0);
  await assert.rejects(
    ca(db, STRAIN, "insert into tranzactii (data, categorie_id, suma) values ('2026-10-01', $1, 10)", [id.Hobby]),
    /row-level security/);
});

test("membrul nu poate șterge definitiv tranzacții sau împrumuturi", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  await m(db, "insert into tranzactii (data, categorie_id, suma) values ('2026-10-01', $1, 10)", [id.Hobby]);
  await m(db, "delete from tranzactii");
  await m(db, "delete from imprumuturi");
  assert.equal((await m(db, "select * from tranzactii")).length, 1);
  assert.ok(await imprumut(db, impId));
});

test("împrumut nou: datorie -sold pe Din în luna împrumutului, status Deschis", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  const i = await imprumut(db, impId);
  assert.equal(Number(i.sold), 5000);
  assert.equal(i.status, "Deschis");
  assert.equal(i.din, "Siguranta");
  assert.equal(i.in_, "Vacante");
  const c = await celula(db, 2026, 6, id.Siguranta);
  assert.equal(Number(c.datorii), -5000);
  assert.equal(Number(c.valoare), 0);
});

test("rambursarea apare în luna rambursării pe categoria În, datoria scade în luna împrumutului", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  const [t] = await ramburseaza(db, impId, "2026-10-05", 500);
  assert.equal(Number(t.categorie_id), Number(id.Vacante));
  await ramburseaza(db, impId, "2026-11-05", 700);

  const i = await imprumut(db, impId);
  assert.equal(Number(i.rambursat), 1200);
  assert.equal(Number(i.sold), 3800);
  assert.equal(i.status, "Parțial");

  assert.equal(Number((await celula(db, 2026, 10, id.Vacante)).valoare), 500);
  assert.equal(Number((await celula(db, 2026, 11, id.Vacante)).valoare), 700);
  assert.equal(Number((await celula(db, 2026, 6, id.Siguranta)).datorii), -3800);
  assert.equal(await celula(db, 2026, 6, id.Vacante), undefined);
});

test("rambursare completă: status Rambursat, fără datorie", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  await ramburseaza(db, impId, "2026-10-05", 5000);
  const i = await imprumut(db, impId);
  assert.equal(i.status, "Rambursat");
  assert.equal(Number(i.sold), 0);
  assert.equal(await celula(db, 2026, 6, id.Siguranta), undefined);
});

test("rambursare peste sold e respinsă (la inserare și la editare)", async () => {
  const db = await bazaNoua();
  const { impId } = await seed(db);
  await assert.rejects(ramburseaza(db, impId, "2026-10-05", 5000.01), /Rămâne 5000/);
  const [t] = await ramburseaza(db, impId, "2026-10-05", 4000);
  await ramburseaza(db, impId, "2026-10-06", 1000);
  await assert.rejects(m(db, "update tranzactii set suma = 4001 where id = $1", [t.id]), /Rămâne 4000/);
});

test("ștergere și restaurare rambursare refac soldul", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  const [t] = await ramburseaza(db, impId, "2026-10-05", 500);
  await m(db, "update tranzactii set deleted_at = now() where id = $1", [t.id]);
  assert.equal(Number((await imprumut(db, impId)).sold), 5000);
  assert.equal(Number((await celula(db, 2026, 10, id.Vacante))?.valoare ?? 0), 0);
  await m(db, "update tranzactii set deleted_at = null where id = $1", [t.id]);
  assert.equal(Number((await imprumut(db, impId)).sold), 4500);
});

test("restaurarea unei rambursări e respinsă dacă ar depăși soldul", async () => {
  const db = await bazaNoua();
  const { impId } = await seed(db);
  const [t] = await ramburseaza(db, impId, "2026-10-05", 3000);
  await m(db, "update tranzactii set deleted_at = now() where id = $1", [t.id]);
  await ramburseaza(db, impId, "2026-10-06", 3000);
  await assert.rejects(m(db, "update tranzactii set deleted_at = null where id = $1", [t.id]), /Rămâne 2000/);
});

test("împrumutul cu rambursări active nu se poate șterge; fără rambursări, da", async () => {
  const db = await bazaNoua();
  const { impId } = await seed(db);
  const [t] = await ramburseaza(db, impId, "2026-10-05", 500);
  await assert.rejects(m(db, "update imprumuturi set deleted_at = now() where id = $1", [impId]), /are rambursări/);
  await m(db, "update tranzactii set deleted_at = now() where id = $1", [t.id]);
  await m(db, "update imprumuturi set deleted_at = now() where id = $1", [impId]);
  assert.equal(await imprumut(db, impId), undefined);
  await assert.rejects(ramburseaza(db, impId, "2026-10-07", 10), /nu există/);
});

test("suma împrumutului nu poate scădea sub totalul rambursat", async () => {
  const db = await bazaNoua();
  const { impId } = await seed(db);
  await ramburseaza(db, impId, "2026-10-05", 2000);
  await assert.rejects(m(db, "update imprumuturi set suma = 1999 where id = $1", [impId]), /2000/);
  await m(db, "update imprumuturi set suma = 2000 where id = $1", [impId]);
  assert.equal((await imprumut(db, impId)).status, "Rambursat");
});

test("schimbarea categoriei În mută rambursările", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  await ramburseaza(db, impId, "2026-10-05", 500);
  await m(db, "update imprumuturi set in_id = $1 where id = $2", [id.Hobby, impId]);
  assert.equal(Number((await celula(db, 2026, 10, id.Hobby)).valoare), 500);
  assert.equal(await celula(db, 2026, 10, id.Vacante), undefined);
});

test("rambursat_legacy se contabilizează pe luna împrumutului, pe categoria În", async () => {
  const db = await bazaNoua();
  const { id } = await seed(db);
  const [imp] = await m(db, `insert into imprumuturi (data, din_id, in_id, suma, rambursat_legacy)
    values ('2026-03-01', $1, $2, 2000, 800) returning id`, [id.Hobby, id.Siguranta]);
  await ramburseaza(db, imp.id, "2026-10-05", 200);
  const i = await imprumut(db, imp.id);
  assert.equal(Number(i.rambursat), 1000);
  assert.equal(Number(i.sold), 1000);
  assert.equal(Number((await celula(db, 2026, 3, id.Siguranta)).valoare), 800);
  assert.equal(Number((await celula(db, 2026, 3, id.Hobby)).datorii), -1000);
  assert.equal(Number((await celula(db, 2026, 10, id.Siguranta)).valoare), 200);
});

test("categorii_inactive: inserare idempotentă, reactivare și ștergere în cascadă cu categoria", async () => {
  const db = await bazaNoua();
  await m(db, "insert into ani (an) values (2025), (2026)");
  const [c] = await m(db, "insert into categorii (nume) values ('Temporar') returning id");
  const ascunde = "insert into categorii_inactive (categorie_id, an) values ($1, 2025), ($1, 2026) on conflict do nothing";
  await m(db, ascunde, [c.id]);
  await m(db, ascunde, [c.id]);
  assert.equal((await m(db, "select * from categorii_inactive")).length, 2);
  await m(db, "delete from categorii_inactive where categorie_id = $1 and an = any($2)", [c.id, [2026]]);
  assert.deepEqual((await m(db, "select an from categorii_inactive")).map((r) => r.an), [2025]);
  await m(db, "delete from categorii where id = $1", [c.id]);
  assert.equal((await m(db, "select * from categorii_inactive")).length, 0);
});

test("anul și numele de categorie duplicate sunt respinse", async () => {
  const db = await bazaNoua();
  await seed(db);
  await m(db, "insert into ani (an) values (2026)");
  await assert.rejects(m(db, "insert into ani (an) values (2026)"), (e) => e.code === "23505");
  await assert.rejects(m(db, "insert into categorii (nume) values ('Vacante')"), (e) => e.code === "23505");
});

test("categoria folosită dă eroarea 23503 la ștergere", async () => {
  const db = await bazaNoua();
  const { id } = await seed(db);
  await assert.rejects(m(db, "delete from categorii where id = $1", [id.Vacante]), (e) => e.code === "23503");
});

test("membrul poate redenumi categoria și edita împrumutul", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  await m(db, "update categorii set nume = 'Concedii', owner = 'Marius', tinta = 999 where id = $1", [id.Vacante]);
  await m(db, "update imprumuturi set data = '2026-07-01', suma = 4000, nota = 'x' where id = $1", [impId]);
  const i = await imprumut(db, impId);
  assert.equal(i.in_, "Concedii");
  assert.equal(Number(i.sold), 4000);
  assert.equal(Number((await celula(db, 2026, 7, id.Siguranta)).datorii), -4000);
});

test("v_buget_luna: totalul lunii include intrările și rambursările, datoriile separat", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  await m(db, `insert into tranzactii (data, categorie_id, suma) values
    ('2026-10-01', $1, 1000), ('2026-10-02', $2, -250)`, [id.Siguranta, id.Hobby]);
  await ramburseaza(db, impId, "2026-10-05", 500);
  const [oct] = await m(db, "select * from v_buget_luna where an = 2026 and luna = 10");
  assert.equal(Number(oct.total_luna), 1250);
  assert.equal(Number(oct.total_datorii), 0);
  const [iun] = await m(db, "select * from v_buget_luna where an = 2026 and luna = 6");
  assert.equal(Number(iun.total_luna), 0);
  assert.equal(Number(iun.total_datorii), -4500);
});

test("validări de bază pe tranzacții și împrumuturi", async () => {
  const db = await bazaNoua();
  const { id, impId } = await seed(db);
  await assert.rejects(m(db, "insert into tranzactii (data, categorie_id, suma) values ('2026-10-01', $1, 0)", [id.Hobby]));
  await assert.rejects(m(db, "insert into tranzactii (data, categorie_id, suma, tip) values ('2026-10-01', $1, 10, 'rambursare')", [id.Hobby]));
  await assert.rejects(m(db, "insert into tranzactii (data, categorie_id, suma, imprumut_id) values ('2026-10-01', $1, 10, $2)", [id.Hobby, impId]));
  await assert.rejects(ramburseaza(db, impId, "2026-10-05", -10));
  await assert.rejects(m(db, "insert into imprumuturi (data, din_id, in_id, suma) values ('2026-10-01', $1, $1, 10)", [id.Hobby]));
  await assert.rejects(m(db, "insert into imprumuturi (data, din_id, in_id, suma) values ('2026-10-01', $1, $2, 0)", [id.Hobby, id.Vacante]));
});

test("categoria folosită nu se poate șterge; cea nefolosită da", async () => {
  const db = await bazaNoua();
  const { id } = await seed(db);
  await assert.rejects(m(db, "delete from categorii where id = $1", [id.Siguranta]), /foreign key/);
  const [c] = await m(db, "insert into categorii (nume) values ('Temporar') returning id");
  await m(db, "delete from categorii where id = $1", [c.id]);
  assert.equal((await m(db, "select * from categorii where id = $1", [c.id])).length, 0);
});

test("audit_log înregistrează modificările cu utilizatorul", async () => {
  const db = await bazaNoua();
  const { impId } = await seed(db);
  const [t] = await ramburseaza(db, impId, "2026-10-05", 500);
  await m(db, "update tranzactii set suma = 600 where id = $1", [t.id]);
  const log = await m(db, "select * from audit_log where tabela = 'tranzactii' order by id");
  assert.deepEqual(log.map((l) => l.actiune), ["INSERT", "UPDATE"]);
  assert.equal(Number(log[1].vechi.suma), 500);
  assert.equal(Number(log[1].nou.suma), 600);
  assert.equal(log[1].user_email, MEMBRU);
  await assert.rejects(m(db, "insert into audit_log (tabela, actiune) values ('x', 'y')"), /row-level security/);
  await m(db, "delete from audit_log");
  assert.equal((await m(db, "select * from audit_log where tabela = 'tranzactii'")).length, 2);
});
