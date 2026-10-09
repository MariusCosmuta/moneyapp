import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const radacina = new URL("../", import.meta.url);
const citeste = (f) => readFileSync(new URL(f, radacina), "utf8");

function fisiereSw() {
  const m = citeste("sw.js").match(/const FISIERE = \[([\s\S]*?)\];/);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

test("sw.js: toate fișierele din listă există", () => {
  for (const f of fisiereSw().filter((f) => f !== "./")) {
    assert.ok(existsSync(new URL(f, radacina)), `lipsește ${f}`);
  }
});

test("sw.js: conține toate modulele JS (altfel aplicația nu pornește fără rețea)", () => {
  const lista = new Set(fisiereSw());
  for (const f of readdirSync(new URL("js/", radacina)).filter((f) => f.endsWith(".js"))) {
    assert.ok(lista.has(`js/${f}`), `js/${f} lipsește din sw.js`);
  }
});

test("manifest: iconițele există și pornește din folderul aplicației", () => {
  const m = JSON.parse(citeste("manifest.webmanifest"));
  assert.equal(m.start_url, "./");
  assert.equal(m.display, "standalone");
  for (const i of m.icons) assert.ok(existsSync(new URL(i.src, radacina)), `lipsește ${i.src}`);
});

test("workflow-ul Pages publică fișierele PWA", () => {
  const wf = readFileSync(new URL("../.github/workflows/pages.yml", radacina), "utf8");
  for (const f of ["manifest.webmanifest", "sw.js", "icons"]) assert.match(wf, new RegExp(`githubPagesApp/${f}`));
});
