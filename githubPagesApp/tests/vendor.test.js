import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("js/vendor/supabase.js e identic cu pachetul oficial npm", () => {
  const pachet = require.resolve("@supabase/supabase-js/package.json");
  const oficial = readFileSync(new URL("dist/umd/supabase.js", "file://" + pachet));
  const local = readFileSync(new URL("../js/vendor/supabase.js", import.meta.url));
  assert.ok(oficial.equals(local), "Fișierul local diferă de @supabase/supabase-js din node_modules.");
});

test("index.html nu mai încarcă scripturi de pe alte domenii", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /script-src 'self';/);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
});
