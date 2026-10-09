function construiesteSetari_(ss) {
  var sh = obtine_(ss, TAB_SETARI); sh.clear();
  sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();

  var ani = getAniBuget_(ss);
  if (!ani.length) ani = [AN_START];

  var header = ["ID","Categorie","Owner","Sumă","Notițe"].concat(ani.map(String));
  sh.getRange(1,1,1,header.length).setValues([header]);
  sh.getRange(1,1,1,header.length).setBackground(H1).setFontColor(HT).setFontWeight("bold");

  var existing = getStareCategorii_();
  var lista = existing.length ? existing : CATEGORII.map(function(n,i){
    return {id: i+1, name: n, owner: "Marius", suma: 0, notite: "", anActiv: {}};
  });
  // ensure anActiv has every year defaulted to "Da"
  lista.forEach(function(c){
    c.anActiv = c.anActiv || {};
    if (c.suma === undefined || c.suma === null) c.suma = 0;
    if (c.notite === undefined || c.notite === null) c.notite = "";
    ani.forEach(function(an){ if (!c.anActiv[an]) c.anActiv[an] = "Da"; });
  });

  var rows = lista.map(function(c){
    return [c.id, c.name, c.owner, c.suma, c.notite].concat(ani.map(function(an){ return c.anActiv[an] || "Da"; }));
  });
  if (rows.length) sh.getRange(2,1,rows.length,header.length).setValues(rows);

  var regOwner = SpreadsheetApp.newDataValidation().requireValueInList(OWNERS, true).build();
  sh.getRange(2,3,500,1).setDataValidation(regOwner);
  sh.getRange(2,4,500,1).setNumberFormat(FMT);
  var regDaNu = SpreadsheetApp.newDataValidation().requireValueInList(["Da","Nu"], true).build();
  if (ani.length) sh.getRange(2,6,500,ani.length).setDataValidation(regDaNu);

  sh.setFrozenRows(1); sh.setColumnWidth(1, 60); sh.autoResizeColumns(2, header.length-1);

  if (!existing.length) setStareCategorii_(lista);
  protejeaza_(sh.getRange(1,1,1,header.length), "titlu");
  protejeaza_(sh.getRange(2,1,500,1), "ID (auto)");
}

function getAniBuget_(ss) {
  return ss.getSheets()
    .filter(function(s){ return s.getName().indexOf(PREFIX_BUGET) === 0; })
    .map(function(s){ return parseInt(s.getName().replace(PREFIX_BUGET,""), 10); })
    .filter(function(an){ return !isNaN(an); })
    .sort();
}

function getStareCategorii_() {
  var raw = PropertiesService.getDocumentProperties().getProperty(CAT_STATE_PROP_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function setStareCategorii_(lista) {
  PropertiesService.getDocumentProperties().setProperty(CAT_STATE_PROP_KEY, JSON.stringify(lista));
}

function getCategorii_() {
  var st = getStareCategorii_();
  return st.length ? st.map(function(c){ return c.name; }) : CATEGORII.slice();
}

function esteActiv_(numeCategorie, an) {
  var st = getStareCategorii_();
  for (var i = 0; i < st.length; i++)
    if (st[i].name === numeCategorie) return (st[i].anActiv || {})[an] !== "Nu";
  return true;
}

function citesteSetari_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_SETARI);
  if (!sh || sh.getLastRow() < 2) return {items: [], ani: []};
  var lastCol = sh.getLastColumn();
  var head = sh.getRange(1,1,1,lastCol).getValues()[0];
  var YEAR_START = 5; // col 6: după ID, Categorie, Owner, Sumă, Notițe
  var ani = [];
  for (var c = YEAR_START; c < head.length; c++) {
    var an = parseInt(head[c], 10);
    if (!isNaN(an)) ani.push(an);
  }
  var data = sh.getRange(2,1,sh.getLastRow()-1,lastCol).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var name = (data[i][1] || "").toString().trim();
    if (!name) continue;
    var owner = (data[i][2] || "").toString().trim();
    if (OWNERS.indexOf(owner) < 0) owner = "Marius";
    var suma = Number(data[i][3]) || 0;
    var notite = (data[i][4] || "").toString();
    var anActiv = {};
    ani.forEach(function(an, idx){
      var v = (data[i][YEAR_START+idx] || "").toString().trim();
      anActiv[an] = (v === "Nu") ? "Nu" : "Da";
    });
    out.push({id: data[i][0] || "", name: name, owner: owner, suma: suma, notite: notite, anActiv: anActiv});
  }
  return {items: out, ani: ani};
}

function aplicaSetari() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var res = citesteSetari_();
  var noua = res.items;
  if (!noua.length) { ui.alert("Nicio categorie în Setări."); return; }

  var stareVeche = getStareCategorii_();
  noua.forEach(function(c){
    if (!c.id) {
      var match = stareVeche.filter(function(x){ return x.name === c.name; })[0];
      if (match) c.id = match.id;
    }
  });
  var idMax = 0;
  stareVeche.forEach(function(c){ if (c.id > idMax) idMax = c.id; });
  noua.forEach(function(c){ if (typeof c.id === "number" && c.id > idMax) idMax = c.id; });
  noua.forEach(function(c){ if (!c.id) c.id = ++idMax; });

  var seen = {};
  for (var i = 0; i < noua.length; i++) {
    if (seen[noua[i].name]) { ui.alert("Categorie duplicată: " + noua[i].name); return; }
    seen[noua[i].name] = true;
  }

  var oldById = {}; stareVeche.forEach(function(c){ oldById[c.id] = c; });
  var newById = {}; noua.forEach(function(c){ newById[c.id] = c; });

  var deAdaugat = noua.filter(function(c){ return !oldById[c.id]; });
  var deSters = stareVeche.filter(function(c){ return !newById[c.id]; });
  var deActualizat = noua.filter(function(c){
    var o = oldById[c.id]; return o && (o.name !== c.name || o.owner !== c.owner);
  });

  for (var j = 0; j < deSters.length; j++) {
    var msg = poateSterge_(ss, deSters[j].name);
    if (msg) { ui.alert('Nu pot șterge "' + deSters[j].name + '": ' + msg); return; }
  }

  var bugete = ss.getSheets().filter(function(s){ return s.getName().indexOf(PREFIX_BUGET) === 0; });

  deActualizat.forEach(function(c){
    var old = oldById[c.id];
    bugete.forEach(function(sh){
      var col = gasesteCol_(sh, old.name);
      if (col > 0 && old.name !== c.name) sh.getRange(1, col).setValue(c.name);
    });
    if (old.name !== c.name) {
      rescrieCategorie_(ss.getSheetByName(TAB_IMPRUMUTURI), [2,3,22,23], old.name, c.name);
      rescrieCategorie_(ss.getSheetByName(TAB_INTRARI), [2,22], old.name, c.name);
    }
  });

  deSters.forEach(function(c){
    bugete.forEach(function(sh){
      var col = gasesteCol_(sh, c.name);
      if (col > 0) sh.deleteColumn(col);
    });
  });

  deAdaugat.forEach(function(c){
    bugete.forEach(function(sh){ adaugaColoanaCategorie_(sh, c.name, c.owner); });
  });

  bugete.forEach(function(sh){
    rescrieFormuleTotal_(sh);
    var an = parseInt(sh.getName().replace(PREFIX_BUGET,""), 10);
    noua.forEach(function(c){
      var col = gasesteCol_(sh, c.name);
      if (col <= 0) return;
      var activ = (c.anActiv || {})[an] !== "Nu";
      sh.getRange(1, col)
        .setBackground(c.owner === "Isabela" ? COLOR_ISABELA : COLOR_MARIUS)
        .setFontColor(HT).setFontWeight("bold");
      if (activ) sh.showColumns(col); else sh.hideColumns(col);
    });
  });

  var lista = noua.map(function(c){ return c.name; });
  var impr = ss.getSheetByName(TAB_IMPRUMUTURI);
  if (impr) { puneLista_(impr, 2, lista); puneLista_(impr, 3, lista); }
  var intr = ss.getSheetByName(TAB_INTRARI);
  if (intr) puneLista_(intr, 2, lista);

  setStareCategorii_(noua.map(function(c){
    return {id: c.id, name: c.name, owner: c.owner, suma: c.suma || 0, notite: c.notite || "", anActiv: c.anActiv || {}};
  }));
  rescrieTabSetari_(ss);

  ui.alert("Setări aplicate.\nAdăugate: " + deAdaugat.length +
           " • Modificate: " + deActualizat.length +
           " • Șterse: " + deSters.length);
}

function rescrieTabSetari_(ss) {
  construiesteSetari_(ss); // reface tab-ul cu coloanele pentru toți anii existenți
}

// Helpers păstrate identic
function poateSterge_(ss, nume) {
  var bugete = ss.getSheets().filter(function(s){ return s.getName().indexOf(PREFIX_BUGET) === 0; });
  for (var i = 0; i < bugete.length; i++) {
    var sh = bugete[i], col = gasesteCol_(sh, nume);
    if (col <= 0) continue;
    var last = sh.getLastRow();
    if (last < 3) continue;
    var vals = sh.getRange(2, col, last-2, 1).getValues();
    for (var j = 0; j < vals.length; j++) {
      if (Number(vals[j][0]) !== 0) return 'are sume în "' + sh.getName() + '" (rândul ' + (j+2) + ")";
    }
  }
  var impr = ss.getSheetByName(TAB_IMPRUMUTURI);
  if (impr && impr.getLastRow() >= 2) {
    var d = impr.getRange(2,2,impr.getLastRow()-1,2).getValues();
    for (var k = 0; k < d.length; k++)
      if (d[k][0] === nume || d[k][1] === nume) return "e folosită în Împrumuturi (rândul " + (k+2) + ")";
  }
  var intr = ss.getSheetByName(TAB_INTRARI);
  if (intr && intr.getLastRow() >= 2) {
    var d2 = intr.getRange(2,2,intr.getLastRow()-1,1).getValues();
    for (var m = 0; m < d2.length; m++)
      if (d2[m][0] === nume) return "e folosită în Intrări (rândul " + (m+2) + ")";
  }
  return null;
}

function gasesteCol_(sh, nume) {
  var head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  for (var c = 0; c < head.length; c++) if (head[c] === nume) return c+1;
  return -1;
}

function adaugaColoanaCategorie_(sh, nume, owner) {
  var totalCol = gasesteCol_(sh, "Total");
  if (totalCol <= 0) return;
  sh.insertColumnBefore(totalCol);
  var newCol = totalCol;
  var totRow = sh.getLastRow();
  sh.getRange(1, newCol).setValue(nume)
    .setBackground(owner === "Isabela" ? COLOR_ISABELA : COLOR_MARIUS)
    .setFontColor(HT).setFontWeight("bold");
  sh.getRange(2, newCol, totRow-1, 1).setNumberFormat(FMT);
  for (var r = 3; r < totRow; r += 2) sh.getRange(r, newCol).setBackground(C_DAT);
  var monthRows = [];
  for (var mr = 2; mr < totRow; mr += 2) monthRows.push(mr);
  sh.getRange(totRow, newCol)
    .setFormula("=" + monthRows.map(function(rr){ return col_(newCol)+rr; }).join("+"))
    .setBackground(H1).setNumberFormat(FMT);
}

function rescrieFormuleTotal_(sh) {
  var totalCol = gasesteCol_(sh, "Total");
  if (totalCol <= 0) return;
  var last = sh.getLastRow();
  for (var r = 2; r < last; r++)
    sh.getRange(r, totalCol).setFormula("=SUM(" + col_(2) + r + ":" + col_(totalCol-1) + r + ")");
  sh.getRange(last, totalCol).setFormula("=SUM(" + col_(2) + last + ":" + col_(totalCol-1) + last + ")");
}

function rescrieCategorie_(sh, cols, oldName, newName) {
  if (!sh || sh.getLastRow() < 2) return;
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  cols.forEach(function(c){
    if (c > lastCol) return;
    var rng = sh.getRange(2, c, last-1, 1);
    var vals = rng.getValues(), changed = false;
    for (var i = 0; i < vals.length; i++)
      if (vals[i][0] === oldName) { vals[i][0] = newName; changed = true; }
    if (changed) rng.setValues(vals);
  });
}