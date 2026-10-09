// 1 Data, 2 Din, 3 În, 4 Suma, 5 Rambursat, 6 Sold, 7 Status, 8 Note
// stare aplicată (ascuns): 20 An, 21 Luna, 22 Din, 23 În, 24 Sold, 25 Rambursat pe luna împrumutului
// 26 (ascuns): rambursat prin Intrări (din app, pe luna rambursării)
function construiesteImprumuturi_(ss) {
  var sh = obtine_(ss, TAB_IMPRUMUTURI); sh.clear();
  sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();
  var head = ["Data","Din categorie","În categorie","Suma","Rambursat","Sold rămas","Status","Note"];
  sh.getRange(1,1,1,head.length).setValues([head]);
  sh.getRange(1,1,1,head.length).setBackground(H1).setFontColor(HT).setFontWeight("bold");

  var regData = SpreadsheetApp.newDataValidation().requireDate()
    .setHelpText("Alege o dată din calendar").build();
  sh.getRange(2,1,500,1).setDataValidation(regData).setNumberFormat("dd.mm.yyyy");
  puneLista_(sh, 2, getCategorii_()); puneLista_(sh, 3, getCategorii_());
  sh.getRange(2,4,500,3).setNumberFormat(FMT); // Suma, Rambursat, Sold

  sh.getRange(1,10).setValue("Împrumuturi deschise:").setFontWeight("bold");
  sh.getRange(1,11).setFormula('=SUMIFS(F2:F500,G2:G500,"<>Rambursat",G2:G500,"<>")').setNumberFormat(FMT);
  sh.hideColumns(20,7);
  sh.setFrozenRows(1); sh.autoResizeColumns(1,8);
  protejeaza_(sh.getRange(1,1,1,8), "titlu");
  protejeaza_(sh.getRange(2,6,500,2), "sold+status calculate");
}

function recalcImprumut_(sheet, r) {
  var data = sheet.getRange(r,1).getValue();
  var din  = sheet.getRange(r,2).getValue();
  var in_  = sheet.getRange(r,3).getValue();
  var suma = sheet.getRange(r,4).getValue();
  var ramb = Number(sheet.getRange(r,5).getValue()) || 0;
  // rambursările din app sunt deja în Intrări (luna rambursării); pe luna împrumutului rămâne doar restul
  var rambPeLuna = Math.max(0, ramb - (Number(sheet.getRange(r,26).getValue()) || 0));

  // 1) UNDO ce s-a aplicat ultima dată (memorie ascunsă 20-25)
  var pAn = sheet.getRange(r,20).getValue(), pLuna = sheet.getRange(r,21).getValue();
  var pDin = sheet.getRange(r,22).getValue(), pIn = sheet.getRange(r,23).getValue();
  var pSold = Number(sheet.getRange(r,24).getValue()) || 0;
  var pRamb = Number(sheet.getRange(r,25).getValue()) || 0;
  if (pSold !== 0 || pRamb !== 0) {
    ajusteaza_(pDin, pAn, pLuna, +pSold, true);              // datoria înapoi în Din (Datorii)
    ajusteaza_(pIn, pAn, pLuna, -pRamb, false, "#bf9000");   // scoate rambursarea din luna În
    sheet.getRange(r,20,1,6).clearContent();
  }

  if (suma === "" || suma === null) { sheet.getRange(r,6,1,2).clearContent(); return; }
  var sumaN = Number(suma) || 0;
  if (sumaN < 0 || ramb < 0 || ramb > sumaN) {
    sheet.getRange(r,6).setValue(sumaN - ramb);
    sheet.getRange(r,7).setValue("EROARE: verifică sumele"); return;
  }
  var sold = sumaN - ramb;
  sheet.getRange(r,6).setValue(sold);
  sheet.getRange(r,7).setValue(sold <= 0 ? "Rambursat" : (ramb > 0 ? "Parțial" : "Deschis"));

  // 2) APLICĂ din nou cu valorile actuale
  var t = (data instanceof Date) ? data : new Date(data);
  if (!isNaN(t.getTime()) && din && in_ && din !== in_) {
    var an = t.getFullYear(), luna = MONTHS_RO[t.getMonth()];
        if (!esteActiv_(din, an) || !esteActiv_(in_, an)) {
      sheet.getRange(r,7).setValue("Atenție: categorie ascunsă în " + an);
    }
    var okD = ajusteaza_(din, an, luna, -sold, true);              // Din (Siguranța): -sold pe Datorii
    var okI = ajusteaza_(in_, an, luna, +rambPeLuna, false, "#bf9000");  // În (Vacanțe): +rambursat pe lună, galben
    if (okD && okI) sheet.getRange(r,20,1,6).setValues([[an, luna, din, in_, sold, rambPeLuna]]);
    else {
      if (okD) ajusteaza_(din, an, luna, +sold, true);
      if (okI) ajusteaza_(in_, an, luna, -rambPeLuna, false, "#bf9000");
      sheet.getRange(r,7).setValue("Lipsește anul " + an + " (meniu → Adaugă an)");
    }
  }
}

// scrie în „Buget <an>": pe „Datorii" (peDatorii=true) sau pe rândul lunii; poate colora
function ajusteaza_(categorie, an, luna, delta, peDatorii, culoare) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PREFIX_BUGET + an);
  if (!sh) return false;
  var head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var col = -1;
  for (var c = 1; c < head.length; c++) if (head[c] === categorie) { col = c + 1; break; }
  if (col < 0) return false;
  var colA = sh.getRange(1,1,sh.getLastRow(),1).getValues(), row = -1;
  for (var i = 0; i < colA.length; i++) if (colA[i][0] === luna) { row = i + 1; break; }
  if (row < 0) return false;
  var cell = sh.getRange(peDatorii ? row + 1 : row, col);
  var nou = (Number(cell.getValue()) || 0) + delta;
  cell.setValue(nou);
  if (culoare && delta !== 0) cell.setFontColor(nou !== 0 ? culoare : null);
  return true;
}

function aplicaColoriImprumuturi_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_IMPRUMUTURI);
  if (!sh) return;
  var rng = sh.getRange("E2:E500"); // coloana „Rambursat"
  var verde = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$G2="Rambursat"')
    .setFontColor("#38761d").setBold(true)
    .setRanges([rng]).build();
  var galben = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($E2>0,$G2<>"Rambursat")')
    .setFontColor("#bf9000")
    .setRanges([rng]).build();
  var rules = sh.getConditionalFormatRules();
  rules.unshift(galben); rules.unshift(verde); // verde are prioritate
  sh.setConditionalFormatRules(rules);
}