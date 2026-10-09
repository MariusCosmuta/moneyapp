function onOpen() {
  SpreadsheetApp.getUi().createMenu("💰 Money App")
    .addItem("Reconstruiește tot", "configureaza")
    .addItem("➕ Adaugă an", "adaugaAnNou")
    .addItem("🔄 Aplică setările", "aplicaSetari")
    .addSeparator()
    .addItem("🔧 Setează backup", "seteazaBackup")
    .addItem("🔁 Rulează backup acum", "ruleazaBackupAcum")
    .addSeparator()
    .addItem("🧹 Curăță istoric (12 luni)", "curataIstoricVechi")
    .addToUi();
}

function configureaza() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  curataTriggere_();
  ScriptApp.newTrigger("laEditare").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("curataIstoricVechi").timeBased().onMonthDay(1).atHour(3).create();

  construiesteSetari_(ss);
  construiesteAnBuget_(ss, AN_START);
  construiesteImprumuturi_(ss);
  construiesteIntrari_(ss);
  construiesteIstoric_(ss);

  ["Marius","Isabela","Panou","Sumar","Buget"].forEach(function(n){
    var s = ss.getSheetByName(n); if (s) ss.deleteSheet(s);
  });
  var g = ss.getSheetByName("Sheet1") || ss.getSheetByName("Foaie1");
  if (g && ss.getSheets().length > 1) ss.deleteSheet(g);

  if (PropertiesService.getDocumentProperties().getProperty(BACKUP_PROP_KEY)) {
    asigurTriggerBackup_();
  }

  ordoneazaTaburi_(ss);
  ss.getSheetByName(PREFIX_BUGET + AN_START).activate();
  SpreadsheetApp.getUi().alert("Gata! Buget " + AN_START +
    ". Schimbi anul dând click pe tab-ul anului. Anul nou: meniu → Adaugă an.");
}

function curataTriggere_() {
  var t = ScriptApp.getProjectTriggers();
  for (var i = 0; i < t.length; i++) ScriptApp.deleteTrigger(t[i]);
}

// Un singur handler la editare: recalcul împrumuturi + jurnal istoric
function laEditare(e) {
  try {
    if (!e || !e.range) return;
    var ss = e.source, sheet = e.range.getSheet(), nume = sheet.getName();
    var rStart = e.range.getRow(), rEnd = e.range.getLastRow();
    var cStart = e.range.getColumn(), cEnd = e.range.getLastColumn();

    // La paste multi-rând, e.range acoperă tot intervalul: recalculăm fiecare rând atins.
    if (nume === TAB_IMPRUMUTURI && rEnd >= 2 && cStart <= 5) {
      for (var ri = Math.max(rStart, 2); ri <= rEnd; ri++) recalcImprumut_(sheet, ri);
    }
    if (nume === TAB_INTRARI && rEnd >= 2 && cStart <= 4) {
      for (var rj = Math.max(rStart, 2); rj <= rEnd; rj++) recalcIntrare_(sheet, rj);
    }
    if (nume === TAB_ISTORIC) return;
    var ist = ss.getSheetByName(TAB_ISTORIC); if (!ist) return;
    var vechi = e.oldValue !== undefined ? e.oldValue : "";
    var nou = e.value !== undefined ? e.value : e.range.getValue();
    var actiune = (vechi === "" && nou !== "") ? "adăugat"
      : ((nou === "" || nou === null) && vechi !== "") ? "șters" : "modificat";
    var user = ""; try { user = Session.getActiveUser().getEmail(); } catch (x) {}
    ist.appendRow([new Date(), user || "necunoscut", actiune, nume,
      e.range.getA1Notation(), vechi, nou]);
  } catch (x) {}
}