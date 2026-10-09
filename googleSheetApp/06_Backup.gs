function seteazaBackup() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getDocumentProperties();
  var existing = props.getProperty(BACKUP_PROP_KEY);
  if (existing) {
    try {
      var f = DriveApp.getFileById(existing);
      ui.alert('Backup deja setat: "' + f.getName() + '".\n\nDacă vrei altul, șterge fișierul din Drive și rulează din nou.');
      asigurTriggerBackup_();
      return;
    } catch (e) { /* fișierul a fost șters — recreăm */ }
  }
  var nume = SpreadsheetApp.getActiveSpreadsheet().getName() + " Backup";
  var nou = SpreadsheetApp.create(nume);
  props.setProperty(BACKUP_PROP_KEY, nou.getId());
  asigurTriggerBackup_();
  ui.alert('Gata! Am creat "' + nume + '" în Drive.\nBackup automat zilnic la ora ' + BACKUP_ORA + ":00.");
}

function asigurTriggerBackup_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "backupZilnic") return;
  }
  ScriptApp.newTrigger("backupZilnic").timeBased().atHour(BACKUP_ORA).everyDays(1).create();
}

function backupZilnic() { ruleazaBackup_(); }

function ruleazaBackupAcum() {
  ruleazaBackup_();
  SpreadsheetApp.getUi().alert("Backup rulat cu succes.");
}

function ruleazaBackup_() {
  var id = PropertiesService.getDocumentProperties().getProperty(BACKUP_PROP_KEY);
  if (!id) throw new Error("Nu e setat backup-ul. Meniu → 🔧 Setează backup.");
  var src = SpreadsheetApp.getActiveSpreadsheet();
  var dst;
  try { dst = SpreadsheetApp.openById(id); }
  catch (e) { throw new Error("Fișierul de backup nu mai există. Meniu → 🔧 Setează backup."); }

  // 1) tab temporar ca să pot șterge restul
  var tmp = dst.insertSheet("_tmp_" + Date.now());
  dst.getSheets().forEach(function(s){
    if (s.getSheetId() !== tmp.getSheetId()) dst.deleteSheet(s);
  });

  // 2) copiez fiecare tab din sursă (valori + formule + formatare)
  src.getSheets().forEach(function(s){
    var copy = s.copyTo(dst);
    copy.setName(s.getName());
  });

  // 3) tab „_Meta" cu data ultimului backup
  var meta = dst.insertSheet("_Meta");
  meta.getRange(1,1,1,2).setValues([["Ultimul backup", new Date()]]);
  meta.getRange(1,2).setNumberFormat("dd.mm.yyyy HH:mm:ss");
  meta.setColumnWidth(1, 140);

  // 4) șterg tab-ul temporar
  dst.deleteSheet(tmp);
}