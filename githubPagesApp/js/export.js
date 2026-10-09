import * as api from "./db.js";
import { isoLocal } from "./format.js";
import { csvTranzactii, csvImprumuturi, csvCategorii } from "./csv.js";
import { $, toast, cuButon, descarca } from "./ui.js";

const CSV = "text/csv;charset=utf-8";

function exporta(btn, fn) {
  return cuButon(btn, async () => {
    fn(await api.exportTot(), isoLocal());
    toast("✓ Descărcat", true);
  }, "⏳ Se pregătește…");
}

$("btn_exp_json").addEventListener("click", (e) => exporta(e.currentTarget,
  (d, zi) => descarca(`moneyapp-${zi}.json`, JSON.stringify(d, null, 2), "application/json")));
$("btn_exp_tr").addEventListener("click", (e) => exporta(e.currentTarget,
  (d, zi) => descarca(`moneyapp-tranzactii-${zi}.csv`, csvTranzactii(d), CSV)));
$("btn_exp_imp").addEventListener("click", (e) => exporta(e.currentTarget,
  (d, zi) => descarca(`moneyapp-imprumuturi-${zi}.csv`, csvImprumuturi(d), CSV)));
$("btn_exp_cat").addEventListener("click", (e) => exporta(e.currentTarget,
  (d, zi) => descarca(`moneyapp-categorii-${zi}.csv`, csvCategorii(d), CSV)));
