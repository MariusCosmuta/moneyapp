// Migrare către Supabase. Rulează exportMigrare() din editorul Apps Script (Run).
// Creează în Drive un fișier .sql pe care îl rulezi O SINGURĂ DATĂ în Supabase → SQL Editor, după 01–04.
// Fișierul se verifică singur: dacă bugetul calculat nu iese identic cu Sheet-ul, nu salvează nimic.

var RAMB_NOTA_RE = /^↩ Rambursare: (.+) → (.+) \(împrumut din (\d{2}\.\d{2}\.\d{4})\)$/;

function exportMigrare() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();
  var acum = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH.mm");
  var res = genereazaMigrare_(citesteDateMigrare_(ss, tz), acum);
  var f = DriveApp.createFile("MoneyApp migrare " + acum + ".sql", res.sql, MimeType.PLAIN_TEXT);
  console.log("Fișier creat în Drive: " + f.getUrl());
  console.log(res.probleme.length ? "Observații:\n- " + res.probleme.join("\n- ") : "Fără observații.");
}

function citesteDateMigrare_(ss, tz) {
  function iso(v) {
    return (v instanceof Date && !isNaN(v.getTime())) ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : "";
  }
  function randuri(nume, nCol) {
    var sh = ss.getSheetByName(nume);
    if (!sh || sh.getLastRow() < 2) return [];
    var n = Math.min(nCol, sh.getMaxColumns());
    return sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues().map(function(r) {
      while (r.length < nCol) r.push("");
      r[0] = iso(r[0]);
      return r;
    });
  }
  var st = getStareCategorii_();
  if (!st.length) st = CATEGORII.map(function(n) { return { name: n, owner: "Marius", suma: 0, notite: "", anActiv: {} }; });
  return {
    categorii: st,
    bugete: getAniBuget_(ss).map(function(an) {
      var sh = ss.getSheetByName(PREFIX_BUGET + an);
      return { an: an, rows: sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues() };
    }),
    imprumuturi: randuri(TAB_IMPRUMUTURI, 26),
    intrari: randuri(TAB_INTRARI, 23)
  };
}

// Funcție pură (fără API Google): primește datele citite și întoarce { sql, probleme }.
function genereazaMigrare_(d, generatLa) {
  var probleme = [], cats = [], catId = {}, loans = [], tranz = [], asteptat = [], inactive = [];
  var val = {}, dat = {};

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
  function bani(n) { return r2(n).toFixed(2); }
  function isoOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function anDin(iso) { return parseInt(iso.slice(0, 4), 10); }
  function lunaDin(iso) { return parseInt(iso.slice(5, 7), 10); }
  function ro(iso) { return iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4); }
  function primaZi(an, luna) { return an + "-" + (luna < 10 ? "0" : "") + luna + "-01"; }
  function cheie(an, luna, cat) { return an + "|" + luna + "|" + cat; }
  function adauga(map, an, luna, cat, suma) { var k = cheie(an, luna, cat); map[k] = r2((map[k] || 0) + suma); }

  // 1) Categorii: din Setări + coloane din bugete care lipsesc din Setări
  function adaugaCat(c) {
    var nume = String(c.name || "").trim();
    if (!nume || catId[nume]) return;
    catId[nume] = cats.length + 1;
    cats.push({ id: catId[nume], nume: nume, owner: c.owner === "Isabela" ? "Isabela" : "Marius",
      tinta: r2(c.suma), notite: String(c.notite || ""), anActiv: c.anActiv || {} });
  }
  d.categorii.forEach(adaugaCat);
  d.bugete.forEach(function(b) {
    b.rows[0].forEach(function(h, i) {
      h = String(h).trim();
      if (i === 0 || !h || h === "Total" || catId[h]) return;
      adaugaCat({ name: h });
      probleme.push("Categoria „" + h + "” apare în " + PREFIX_BUGET + b.an + " dar nu în Setări: am adăugat-o cu owner Marius.");
    });
  });

  // 2) Împrumuturi aplicate în buget (memoria ascunsă 20–25 completată)
  d.imprumuturi.forEach(function(r, i) {
    var eticheta = TAB_IMPRUMUTURI + " rândul " + (i + 2);
    if (r[3] === "" || r[3] === null) return;
    if (r[19] === "" || r[19] === null) {
      probleme.push(eticheta + ": nu e aplicat în buget (status „" + r[6] + "”), nu l-am importat.");
      return;
    }
    var din = String(r[1]).trim(), in_ = String(r[2]).trim(), suma = r2(r[3]), ramb = r2(r[4]);
    if (!isoOk(r[0]) || !catId[din] || !catId[in_] || din === in_ || !(suma > 0) || ramb < 0 || ramb > suma) {
      probleme.push(eticheta + ": date invalide (dată, categorii sau sume), nu l-am importat.");
      return;
    }
    loans.push({ id: loans.length + 1, rand: i + 2, data: r[0], din: din, in_: in_, suma: suma, ramb: ramb,
      rambApp: r2(r[25]), legat: 0, nota: String(r[7] || "") });
  });

  // 3) Intrări aplicate în buget (memoria ascunsă 20–23); rambursările din app se leagă de împrumut
  d.intrari.forEach(function(r, i) {
    var eticheta = TAB_INTRARI + " rândul " + (i + 2);
    var suma = r2(r[22]);
    if (!suma) {
      if (r[2] !== "" && r[2] !== null) probleme.push(eticheta + ": nu e aplicat în buget (status „" + r[4] + "”), nu l-am importat.");
      return;
    }
    var cat = String(r[21]).trim(), an = Number(r[19]), luna = MONTHS_RO.indexOf(r[20]) + 1;
    if (!catId[cat] || !an || !luna) {
      probleme.push(eticheta + ": categoria sau luna aplicată lipsește, nu l-am importat.");
      return;
    }
    var data = r[0];
    if (!isoOk(data) || anDin(data) !== an || lunaDin(data) !== luna) {
      data = primaZi(an, luna);
      probleme.push(eticheta + ": data nu corespunde lunii din buget, am folosit " + ro(data) + ".");
    }
    var nota = String(r[3] || ""), imp = null, m = nota.match(RAMB_NOTA_RE);
    if (m) {
      imp = loans.filter(function(x) {
        return x.din === m[1] && x.in_ === m[2] && x.in_ === cat && ro(x.data) === m[3] &&
          suma > 0 && x.legat + suma <= x.ramb + 0.001;
      })[0] || null;
      if (imp) imp.legat = r2(imp.legat + suma);
      else probleme.push(eticheta + ": rambursare fără împrumut potrivit, am importat-o ca intrare obișnuită.");
    }
    tranz.push({ data: data, cat: cat, suma: suma, nota: nota, tip: imp ? "rambursare" : "intrare", imp: imp });
    adauga(val, an, luna, cat, suma);
  });

  // 4) Rambursat vechi (nelegat de Intrări) rămâne pe luna împrumutului; datoria = -sold pe „Din"
  loans.forEach(function(x) {
    x.legacy = Math.max(0, r2(x.ramb - x.legat));
    if (x.legat !== x.rambApp)
      probleme.push(TAB_IMPRUMUTURI + " rândul " + x.rand + ": rambursări găsite în Intrări " + bani(x.legat) +
        " vs " + bani(x.rambApp) + " în coloana Z; diferența rămâne pe luna împrumutului.");
    adauga(val, anDin(x.data), lunaDin(x.data), x.in_, x.legacy);
    adauga(dat, anDin(x.data), lunaDin(x.data), x.din, -r2(x.suma - x.ramb));
  });

  // 5) Comparație cu celulele din „Buget <an>": diferența pe valoare devine „sold inițial"
  d.bugete.forEach(function(b) {
    var head = b.rows[0];
    b.rows.forEach(function(row, ri) {
      var luna = MONTHS_RO.indexOf(row[0]) + 1;
      if (!luna) return;
      var rowDat = b.rows[ri + 1] || [];
      for (var c = 1; c < head.length; c++) {
        var cat = String(head[c]).trim();
        if (!catId[cat]) continue;
        var k = cheie(b.an, luna, cat), sv = r2(row[c]), sd = r2(rowDat[c]);
        var dif = r2(sv - (val[k] || 0));
        if (dif !== 0) tranz.push({ data: primaZi(b.an, luna), cat: cat, suma: dif,
          nota: "Sold inițial (migrare din Sheet)", tip: "sold_initial", imp: null });
        if (r2(sd - (dat[k] || 0)) !== 0)
          probleme.push(PREFIX_BUGET + b.an + ", " + MONTHS_RO[luna - 1] + ", " + cat + ": Datorii în Sheet " + bani(sd) +
            ", calculat din împrumuturi " + bani(dat[k] || 0) + ". Diferența nu se importă.");
        if (sv !== 0 || sd !== 0) asteptat.push([b.an, luna, catId[cat], bani(sv), bani(sd)]);
      }
    });
    cats.forEach(function(c) { if (c.anActiv[b.an] === "Nu") inactive.push([c.id, b.an]); });
  });

  // 6) SQL
  function insert(antet, lista, rand) {
    if (lista.length) s.push(antet + "\n  " + lista.map(function(x, i) { return "(" + rand(x, i).join(", ") + ")"; }).join(",\n  ") + ";");
  }
  var s = [
    "-- MoneyApp: migrare din Google Sheet (generat " + generatLa + ").",
    "-- Rulează O SINGURĂ DATĂ în Supabase → SQL Editor, după 01–04, pe o bază goală.",
    "-- Dacă bugetul calculat nu iese identic cu Sheet-ul, scriptul se oprește și nu salvează nimic.",
    "--",
    probleme.length ? "-- Observații:" : "-- Fără observații."
  ];
  probleme.forEach(function(p) { s.push("--   * " + p.replace(/[\r\n]+/g, " ")); });
  s.push("", "begin;",
    "do $$ begin",
    "  if exists (select 1 from public.categorii) or exists (select 1 from public.ani)",
    "     or exists (select 1 from public.imprumuturi) or exists (select 1 from public.tranzactii) then",
    "    raise exception 'Baza nu e goală: migrarea se rulează o singură dată.';",
    "  end if;",
    "end $$;");
  insert("insert into public.ani (an) values", d.bugete, function(b) { return [b.an]; });
  insert("insert into public.categorii (id, nume, owner, tinta, notite, ordine) overriding system value values", cats,
    function(c, i) { return [c.id, q(c.nume), q(c.owner), bani(c.tinta), q(c.notite), i]; });
  insert("insert into public.categorii_inactive (categorie_id, an) values", inactive, function(x) { return x; });
  insert("insert into public.imprumuturi (id, data, din_id, in_id, suma, rambursat_legacy, nota) overriding system value values", loans,
    function(x) { return [x.id, q(x.data), catId[x.din], catId[x.in_], bani(x.suma), bani(x.legacy), q(x.nota)]; });
  insert("insert into public.tranzactii (data, categorie_id, suma, nota, tip, imprumut_id) values", tranz,
    function(t) { return [q(t.data), catId[t.cat], bani(t.suma), q(t.nota), q(t.tip), t.imp ? t.imp.id : "null"]; });
  s.push(
    "select setval(pg_get_serial_sequence('public.categorii', 'id'), (select max(id) from public.categorii));",
    "select setval(pg_get_serial_sequence('public.imprumuturi', 'id'), (select max(id) from public.imprumuturi));",
    "",
    "-- Verificare față de Sheet",
    "create temp table _asteptat (an int, luna int, categorie_id bigint, valoare numeric, datorii numeric) on commit drop;");
  insert("insert into _asteptat values", asteptat, function(x) { return x; });
  s.push(
    "do $$",
    "declare n_val int; n_dat int;",
    "begin",
    "  select count(*) into n_val from _asteptat a full join public.v_buget_celule v using (an, luna, categorie_id)",
    "    where abs(coalesce(a.valoare, 0) - coalesce(v.valoare, 0)) >= 0.01;",
    "  if n_val > 0 then",
    "    raise exception 'Verificare eșuată: % celule diferă de Sheet. Nimic nu s-a salvat.', n_val;",
    "  end if;",
    "  select count(*) into n_dat from _asteptat a full join public.v_buget_celule v using (an, luna, categorie_id)",
    "    where abs(coalesce(a.datorii, 0) - coalesce(v.datorii, 0)) >= 0.01;",
    "  raise notice 'Verificare OK. Celule Datorii diferite de Sheet (vezi Observații): %', n_dat;",
    "end $$;",
    "commit;");

  return { sql: s.join("\n") + "\n", probleme: probleme };
}
