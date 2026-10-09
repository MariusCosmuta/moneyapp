function construiesteIstoric_(ss) {
  var sh = obtine_(ss, TAB_ISTORIC); sh.clear();
  var head = ["Data/ora","Utilizator","Acțiune","Foaie","Celulă","Valoare veche","Valoare nouă"];
  sh.getRange(1,1,1,head.length).setValues([head]);
  sh.getRange(1,1,1,head.length).setBackground(H1).setFontColor(HT).setFontWeight("bold");
  sh.setFrozenRows(1); sh.autoResizeColumns(1,head.length);
  protejeaza_(sh.getRange(1,1,1,head.length), "titlu");
}

function curataIstoricVechi() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_ISTORIC);
  if (!s || s.getLastRow() < 2) return;
  var prag = new Date(); prag.setMonth(prag.getMonth() - LUNI_ISTORIC);
  var data = s.getRange(2,1,s.getLastRow()-1,1).getValues();
  for (var i = data.length - 1; i >= 0; i--)
    if (data[i][0] instanceof Date && data[i][0] < prag) s.deleteRow(i + 2);
}