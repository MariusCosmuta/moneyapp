function obtine_(ss, n) { return ss.getSheetByName(n) || ss.insertSheet(n); }
function puneLista_(sh, col, valori) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(valori, true).build();
  sh.getRange(2, col, 500, 1).setDataValidation(rule);
}
function protejeaza_(rng, desc) { rng.protect().setDescription(desc).setWarningOnly(true); }
function col_(c) { var s=""; while(c>0){var m=(c-1)%26; s=String.fromCharCode(65+m)+s; c=Math.floor((c-1)/26);} return s; }
function ordoneazaTaburi_(ss) {
  var budgets = ss.getSheets().filter(function(s){ return s.getName().indexOf(PREFIX_BUGET) === 0; })
    .sort(function(a,b){ return a.getName().localeCompare(b.getName()); });
  budgets.forEach(function(s,i){ ss.setActiveSheet(s); ss.moveActiveSheet(i+1); });
  [TAB_SETARI, TAB_INTRARI, TAB_IMPRUMUTURI, TAB_ISTORIC].forEach(function(n){
    var s = ss.getSheetByName(n); if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(ss.getNumSheets()); }
  });
}