function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("💰 Money App")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Cache helpers (30s expiry). Cheile se invalidează la orice scriere.
var CACHE_TTL = 30;
function cacheGet_(key) {
  var raw = CacheService.getScriptCache().get(key);
  return raw ? JSON.parse(raw) : null;
}
function cacheSet_(key, val) {
  CacheService.getScriptCache().put(key, JSON.stringify(val), CACHE_TTL);
}
function cacheInvalideaza_() {
  CacheService.getScriptCache().removeAll(["sumar", "categorii", "buget_current", "strategie"]);
}

function api_getSumar() {
  var cached = cacheGet_("sumar");
  if (cached) return cached;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var an = now.getFullYear(), luna = MONTHS_RO[now.getMonth()];
  var soldLuna = 0;
  var sh = ss.getSheetByName(PREFIX_BUGET + an);
  if (sh) {
    var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
    var all = sh.getRange(1,1,lastRow,lastCol).getValues();
    var head = all[0];
    var totalCol = -1;
    for (var c = 0; c < head.length; c++) if (head[c] === "Total") { totalCol = c; break; }
    for (var i = 0; i < all.length; i++) if (all[i][0] === luna) {
      soldLuna = Number(all[i][totalCol]) || 0; break;
    }
  }
  var datorii = 0;
  var impr = ss.getSheetByName(TAB_IMPRUMUTURI);
  if (impr && impr.getLastRow() >= 2) {
    var d = impr.getRange(2,6,impr.getLastRow()-1,2).getValues();
    for (var k = 0; k < d.length; k++) {
      var sold = Number(d[k][0]) || 0, status = d[k][1];
      if (status && status !== "Rambursat") datorii += sold;
    }
  }
  var res = { luna: luna, an: an, soldLuna: soldLuna, datorii: datorii };
  cacheSet_("sumar", res);
  return res;
}

function api_getCategorii() {
  var cached = cacheGet_("categorii");
  if (cached) return cached;
  var st = getStareCategorii_();
  var res = !st.length
    ? CATEGORII.map(function(n){ return {name: n, owner: "Marius"}; })
    : st.map(function(c){ return {name: c.name, owner: c.owner}; });
  cacheSet_("categorii", res);
  return res;
}

function api_getStrategie() {
  var cached = cacheGet_("strategie");
  if (cached) return cached;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var an = now.getFullYear(), luna = MONTHS_RO[now.getMonth()];
  var stare = getStareCategorii_();

  var actualMap = {};
  var sh = ss.getSheetByName(PREFIX_BUGET + an);
  if (sh) {
    var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
    var all = sh.getRange(1,1,lastRow,lastCol).getValues();
    var head = all[0];
    var rowLuna = -1;
    for (var i = 0; i < all.length; i++) if (all[i][0] === luna) { rowLuna = i; break; }
    if (rowLuna >= 0)
      for (var c = 1; c < head.length; c++) actualMap[head[c]] = Number(all[rowLuna][c]) || 0;
  }

  var items = [];
  stare.forEach(function(cat){
    if ((cat.anActiv || {})[an] === "Nu") return;
    var tinta = Number(cat.suma) || 0;
    var pus = actualMap[cat.name] || 0;
    items.push({
      name: cat.name,
      owner: cat.owner || "Marius",
      tinta: tinta,
      pus: pus,
      ok: pus >= tinta,
      notite: cat.notite || ""
    });
  });
  var res = { an: an, luna: luna, items: items };
  cacheSet_("strategie", res);
  return res;
}

function api_adaugaIntrare(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_INTRARI);
  if (!sh) throw new Error("Tab-ul Intrări lipsește.");
  var data = new Date(payload.data);
  if (isNaN(data.getTime())) throw new Error("Data invalidă.");
  var cat = String(payload.categorie || "").trim();
  if (!cat) throw new Error("Categorie lipsă.");
  var suma = Number(payload.suma);
  if (!suma || isNaN(suma)) throw new Error("Sumă invalidă.");
  var nota = String(payload.nota || "");

  var r = sh.getLastRow() + 1;
  // Bulk write: valorile în A:D într-un singur apel, apoi format într-un range unic.
  sh.getRange(r,1,1,4).setValues([[data, cat, suma, nota]]);
  sh.getRange(r,1,1,3).setNumberFormats([["dd.mm.yyyy", "@", FMT]]);
  recalcIntrare_(sh, r);
  var status = sh.getRange(r,5).getValue();
  cacheInvalideaza_();
  return { ok: true, rand: r, status: status };
}
function api_getLinkBuget() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var an = new Date().getFullYear();
  var sh = ss.getSheetByName(PREFIX_BUGET + an);
  if (!sh) {
    var bugete = ss.getSheets().filter(function(s){ return s.getName().indexOf(PREFIX_BUGET) === 0; });
    if (bugete.length) sh = bugete[bugete.length - 1];
  }
  if (!sh) return { url: ss.getUrl() };
  return { url: ss.getUrl() + "#gid=" + sh.getSheetId() };
}

function api_adaugaImprumut(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_IMPRUMUTURI);
  if (!sh) throw new Error("Tab-ul Împrumuturi lipsește.");
  var data = new Date(payload.data);
  if (isNaN(data.getTime())) throw new Error("Data invalidă.");
  var din = String(payload.din || "").trim();
  var in_ = String(payload.in_ || "").trim();
  if (!din || !in_) throw new Error("Alege ambele categorii.");
  if (din === in_) throw new Error("Din și În nu pot fi la fel.");
  var suma = Number(payload.suma);
  if (!suma || suma <= 0) throw new Error("Sumă invalidă.");
  var nota = String(payload.nota || "");

  var r = sh.getLastRow() + 1;
  // Bulk write: A:E într-un apel, format într-un apel, nota separat.
  sh.getRange(r,1,1,5).setValues([[data, din, in_, suma, 0]]);
  sh.getRange(r,1,1,5).setNumberFormats([["dd.mm.yyyy", "@", "@", FMT, FMT]]);
  sh.getRange(r,8).setValue(nota);
  recalcImprumut_(sh, r);
  cacheInvalideaza_();
  return { ok: true, rand: r, status: sh.getRange(r,7).getValue() };
}

function api_getImprumuturiDeschise() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_IMPRUMUTURI);
  if (!sh || sh.getLastRow() < 2) return [];
  var last = sh.getLastRow();
  var d = sh.getRange(2,1,last-1,7).getValues();
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var status = d[i][6];
    if (!status || status === "Rambursat") continue;
    if (String(status).indexOf("EROARE") === 0) continue;
    if (String(status).indexOf("Lipsește") === 0) continue;
    var data = d[i][0];
    var dataStr = (data instanceof Date)
      ? Utilities.formatDate(data, Session.getScriptTimeZone(), "dd.MM.yyyy")
      : String(data);
    out.push({
      rand: i + 2,
      data: dataStr,
      din: d[i][1], in_: d[i][2],
      suma: Number(d[i][3]) || 0,
      rambursat: Number(d[i][4]) || 0,
      sold: Number(d[i][5]) || 0
    });
  }
  return out;
}

function api_rambursare(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_IMPRUMUTURI);
  if (!sh) throw new Error("Tab-ul Împrumuturi lipsește.");
  var r = Number(payload.rand);
  if (!r || r < 2) throw new Error("Rând invalid.");
  var extra = Number(payload.suma);
  if (!extra || extra <= 0) throw new Error("Sumă invalidă.");
  if (isNaN(new Date(payload.data).getTime())) throw new Error("Data invalidă.");
  var rand = sh.getRange(r,1,1,5).getValues()[0];
  var suma = Number(rand[3]) || 0;
  var rambCurent = Number(rand[4]) || 0;
  var nou = rambCurent + extra;
  if (nou > suma) throw new Error("Rambursare > sumă împrumut. Rămâne " + (suma - rambCurent) + " lei.");

  var dataImp = (rand[0] instanceof Date)
    ? Utilities.formatDate(rand[0], Session.getScriptTimeZone(), "dd.MM.yyyy") : String(rand[0]);
  var intrare = api_adaugaIntrare({
    data: payload.data, categorie: rand[2], suma: extra,
    nota: "↩ Rambursare: " + rand[1] + " → " + rand[2] + " (împrumut din " + dataImp + ")"
  });
  ss.getSheetByName(TAB_INTRARI).getRange(intrare.rand,1,1,5).setFontColor("#bf9000");

  var rambIntrari = (Number(sh.getRange(r,26).getValue()) || 0) + extra;
  sh.getRange(r,5).setValue(nou);
  sh.getRange(r,26).setValue(rambIntrari);
  if (!sh.isColumnHiddenByUser(26)) sh.hideColumns(26);
  recalcImprumut_(sh, r);
  cacheInvalideaza_();
  return { ok: true, rambursatTotal: nou, sold: Number(sh.getRange(r,6).getValue()) || 0,
    status: sh.getRange(r,7).getValue() };
}

function api_getBuget(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var an = Number((payload && payload.an) || new Date().getFullYear());
  var luna = (payload && payload.luna) || MONTHS_RO[new Date().getMonth()];
  var cacheKey = "buget_" + an + "_" + luna;
  var cached = cacheGet_(cacheKey);
  if (cached) return cached;

  var sh = ss.getSheetByName(PREFIX_BUGET + an);
  if (!sh) throw new Error("Nu există " + PREFIX_BUGET + an);

  var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  var all = sh.getRange(1,1,lastRow,lastCol).getValues();
  var head = all[0];

  var rowLuna = -1, rowTot = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i][0] === luna) rowLuna = i;
    if (all[i][0] === "TOTAL categorie") rowTot = i;
  }
  if (rowLuna < 0) throw new Error("Luna nu există.");
  var rowDat = rowLuna + 1;

  var totalCol = -1;
  for (var c = 0; c < head.length; c++) if (head[c] === "Total") { totalCol = c; break; }

  var stare = getStareCategorii_();
  var ownerMap = {}; stare.forEach(function(c){ ownerMap[c.name] = c.owner; });
  var activMap = {}; stare.forEach(function(c){ activMap[c.name] = (c.anActiv||{})[an] !== "Nu"; });

  var categorii = [];
  for (var k = 1; k < head.length - 1; k++) {
    var nume = head[k];
    if (nume === "Total") continue;
    if (activMap[nume] === false) continue;
    categorii.push({
      nume: nume,
      owner: ownerMap[nume] || "Marius",
      luna: Number(all[rowLuna][k]) || 0,
      datorii: Number(all[rowDat][k]) || 0,
      totalAn: rowTot >= 0 ? (Number(all[rowTot][k]) || 0) : 0
    });
  }
  var totalLuna = Number(all[rowLuna][totalCol]) || 0;
  var totalDat  = Number(all[rowDat][totalCol]) || 0;
  var totalAn   = rowTot >= 0 ? (Number(all[rowTot][totalCol]) || 0) : 0;

  var ani = ss.getSheets()
    .filter(function(s){ return s.getName().indexOf(PREFIX_BUGET) === 0; })
    .map(function(s){ return parseInt(s.getName().replace(PREFIX_BUGET,""), 10); })
    .filter(function(a){ return !isNaN(a); }).sort();

  var res = {
    an: an, luna: luna, ani: ani, luni: MONTHS_RO,
    categorii: categorii,
    totalLuna: totalLuna, totalDatorii: totalDat, totalAn: totalAn
  };
  cacheSet_(cacheKey, res);
  return res;
}