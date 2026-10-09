function construiesteAnBuget_(ss, an) {
  var sh = obtine_(ss, PREFIX_BUGET + an); sh.clear();
  sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();
  var stare = getStareCategorii_();
  var categorii = stare.length ? stare.map(function(c){ return c.name; }) : CATEGORII;
  var head = ["Perioada"].concat(categorii).concat(["Total"]);
  var colT = head.length;
  sh.getRange(1,1,1,colT).setValues([head]);
  var r = 2, valRows = [];
  for (var i = 0; i < 12; i++) {
    sh.getRange(r,1).setValue(MONTHS_RO[i]);
    sh.getRange(r,colT).setFormula("=SUM(" + col_(2)+r + ":" + col_(colT-1)+r + ")");
    sh.getRange(r+1,1).setValue("Datorii");
    sh.getRange(r+1,colT).setFormula("=SUM(" + col_(2)+(r+1) + ":" + col_(colT-1)+(r+1) + ")");
    sh.getRange(r+1,1,1,colT).setBackground(C_DAT);
    sh.getRange(r,2,2,colT-1).setNumberFormat(FMT);
    valRows.push(r); r += 2;
  }
  var bot = r;
  sh.getRange(bot,1).setValue("TOTAL categorie").setFontWeight("bold");
  for (var c = 2; c <= colT-1; c++)
    sh.getRange(bot,c).setFormula("=" + valRows.map(function(rr){ return col_(c)+rr; }).join("+"));
  sh.getRange(bot,colT).setFormula("=SUM(" + col_(2)+bot + ":" + col_(colT-1)+bot + ")");
  sh.getRange(bot,1,1,colT).setBackground(H1);
  sh.getRange(bot,2,1,colT-1).setNumberFormat(FMT);

  // Header: Perioada + Total gri, categoriile colorate pe owner
  sh.getRange(1,1).setBackground(H1).setFontColor(HT).setFontWeight("bold");
  sh.getRange(1,colT).setBackground(H1).setFontColor(HT).setFontWeight("bold");
  for (var k = 0; k < categorii.length; k++) {
    var owner = stare.length ? stare[k].owner : "Marius";
    sh.getRange(1, k+2)
      .setBackground(owner === "Isabela" ? COLOR_ISABELA : COLOR_MARIUS)
      .setFontColor(HT).setFontWeight("bold");
  }

  sh.setFrozenRows(1); sh.setFrozenColumns(1); sh.autoResizeColumns(1,colT);
  protejeaza_(sh.getRange(1,1,1,colT), "titlu");
  protejeaza_(sh.getRange(bot,1,1,colT), "total categorie");
   // Ascunde coloanele marcate „Nu" pentru anul acesta
  var stareCat = getStareCategorii_();
  stareCat.forEach(function(c){
    if ((c.anActiv || {})[an] === "Nu") {
      var col = gasesteCol_(sh, c.name);
      if (col > 0) sh.hideColumns(col);
    }
  });
  return sh;
}


function adaugaAnNou() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  var res = ui.prompt("Adaugă an", "Scrie anul (ex: 2027):", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var an = parseInt(res.getResponseText(), 10);
  if (!an || an < 2000 || an > 2100) { ui.alert("An invalid."); return; }
  if (ss.getSheetByName(PREFIX_BUGET + an)) { ui.alert("Anul " + an + " există deja."); return; }
    var st = getStareCategorii_();
  if (st.length) {
    st.forEach(function(c){ (c.anActiv = c.anActiv || {})[an] = "Da"; });
    setStareCategorii_(st);
  }
  construiesteAnBuget_(ss, an);
  ordoneazaTaburi_(ss);
  construiesteSetari_(ss);
  ui.alert("Am adăugat " + PREFIX_BUGET + an + ".");
}