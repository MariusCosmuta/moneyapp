// 1 Data, 2 Categorie, 3 Sumă, 4 Notă, 5 Status
// memorie ascunsă: 20 An, 21 Luna, 22 Categorie, 23 Sumă
function construiesteIntrari_(ss) {
  var sh = obtine_(ss, TAB_INTRARI); sh.clear();
  sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();
  var head = ["Data","Categorie","Sumă","Notă","Status"];
  sh.getRange(1,1,1,head.length).setValues([head]);
  sh.getRange(1,1,1,head.length).setBackground(H1).setFontColor(HT).setFontWeight("bold");

  var regData = SpreadsheetApp.newDataValidation().requireDate()
    .setHelpText("Alege o dată din calendar").build();
  sh.getRange(2,1,500,1).setDataValidation(regData).setNumberFormat("dd.mm.yyyy");
  puneLista_(sh, 2, getCategorii_());
  sh.getRange(2,3,500,1).setNumberFormat(FMT);

  sh.setFrozenRows(1); sh.autoResizeColumns(1, head.length);
  sh.hideColumns(20, 4);
  protejeaza_(sh.getRange(1,1,1,head.length), "titlu");
  protejeaza_(sh.getRange(2,5,500,1), "status calculat");
}

function recalcIntrare_(sheet, r) {
  var data = sheet.getRange(r,1).getValue();
  var cat  = sheet.getRange(r,2).getValue();
  var suma = sheet.getRange(r,3).getValue();

  // 1) UNDO din memorie
  var pAn = sheet.getRange(r,20).getValue(), pLuna = sheet.getRange(r,21).getValue();
  var pCat = sheet.getRange(r,22).getValue(), pSuma = Number(sheet.getRange(r,23).getValue()) || 0;
  if (pSuma !== 0) {
    ajusteaza_(pCat, pAn, pLuna, -pSuma, false);
    sheet.getRange(r,20,1,4).clearContent();
  }

  // rând gol → curăț status
  if (suma === "" || suma === null) { sheet.getRange(r,5).clearContent(); return; }

  var sumaN = Number(suma) || 0;
  if (sumaN === 0) { sheet.getRange(r,5).setValue("Sumă = 0"); return; }

  var t = (data instanceof Date) ? data : new Date(data);
  if (isNaN(t.getTime())) { sheet.getRange(r,5).setValue("Data lipsă"); return; }
  if (!cat) { sheet.getRange(r,5).setValue("Categorie lipsă"); return; }

  // 2) APLICĂ
  var an = t.getFullYear(), luna = MONTHS_RO[t.getMonth()];
  var ok = ajusteaza_(cat, an, luna, +sumaN, false);
  if (!esteActiv_(cat, an)) sheet.getRange(r,5).setValue("Atenție: categorie ascunsă în " + an);
  if (ok) {
    sheet.getRange(r,20,1,4).setValues([[an, luna, cat, sumaN]]);
    if (esteActiv_(cat, an)) sheet.getRange(r,5).setValue("OK");
  } else {
    sheet.getRange(r,5).setValue("Lipsește anul " + an + " (meniu → Adaugă an)");
  }
}