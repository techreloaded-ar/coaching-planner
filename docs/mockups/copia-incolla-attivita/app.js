/* ============================================================
   Coaching Planner — Copia e incolla di una riga attività.
   Logica del prototipo: dati finti, calendario, vassoio degli
   appunti, menu di scelta riga, esito. Nessuna chiamata di rete.
   ============================================================ */
var CP = (function () {
  "use strict";

  var OGGI = "2026-11-23";
  var GIORNO_CON_DETTAGLIO = "2026-11-11";
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  var GIORNI_BREVI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

  var NORDWIND = { cliente: "Nordwind Logistica", codice: "NWL-2026-03", offerta: "Coaching team operations" };
  var BOTTEGA = { cliente: "Bottega Cartaria", codice: "BTC-2026-01", offerta: "Affiancamento Scrum Master" };
  var ALDEBARAN = { cliente: "Studio Aldebaran", codice: "ALD-2025-07", offerta: "Workshop di discovery" };

  function riga(id, data, anagrafica, ore, extra) {
    var base = {
      id: id, data: data,
      cliente: anagrafica.cliente, codice: anagrafica.codice, offerta: anagrafica.offerta,
      ore: ore, fatturabile: true, nota: "", rimborso: null, abilitata: true, fresca: false
    };
    for (var chiave in extra || {}) base[chiave] = extra[chiave];
    return base;
  }

  var RIGHE = [
    riga("r-02", "2026-11-02", BOTTEGA, 8),
    riga("r-03", "2026-11-03", NORDWIND, 8),
    riga("r-05a", "2026-11-05", BOTTEGA, 4),
    riga("r-05b", "2026-11-05", NORDWIND, 4),
    riga("r-09", "2026-11-09", NORDWIND, 8),
    riga("r-11a", "2026-11-11", NORDWIND, 6, {
      nota: "Retrospettiva di rilascio e allineamento con i team leader.",
      rimborso: { etichetta: "Trasferta oltre 100 km", importo: 60 }
    }),
    riga("r-11b", "2026-11-11", BOTTEGA, 2, { fatturabile: false, nota: "Preparazione materiali." }),
    riga("r-13", "2026-11-13", ALDEBARAN, 8, { abilitata: false }),
    riga("r-17", "2026-11-17", BOTTEGA, 8),
    riga("r-18", "2026-11-18", NORDWIND, 4),
    riga("r-20", "2026-11-20", BOTTEGA, 6),
    riga("r-23", "2026-11-23", NORDWIND, 3),
    riga("r-d01", "2026-12-01", BOTTEGA, 8),
    riga("r-d09", "2026-12-09", NORDWIND, 4)
  ];

  var SCELTA_DIMOSTRATIVA = ["2026-11-04", "2026-11-12", "2026-11-19", "2026-12-03"];

  var stato = {
    mese: "2026-11",
    appunti: null,      // id della riga copiata
    scelti: [],         // giorni di destinazione YYYY-MM-DD
    popover: null,      // giorno il cui menu di scelta riga è aperto
    esito: null,        // { giorni, riga }
    errore: false,      // rifiuto del server
    rifiutoSimulato: false,
    avviso: null,
    scossa: false
  };

  /* ---------- Formattazione ---------- */
  function fmtOre(ore) { return ore.toFixed(1).replace(".", ",") + " h"; }
  function fmtEuro(importo) { return "€ " + importo.toFixed(2).replace(".", ","); }
  function fmtGiornate(ore) {
    var giornate = Math.round((ore / 8) * 10) / 10;
    return String(giornate).replace(".", ",") + (giornate === 1 ? " giornata" : " giornate");
  }
  function isoDa(data) {
    var m = data.getMonth() + 1, g = data.getDate();
    return data.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (g < 10 ? "0" : "") + g;
  }
  function dataDa(giorno) {
    var p = giorno.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function numero(giorno) { return Number(giorno.slice(8, 10)); }
  function tokenMese(giorno) { return giorno.slice(0, 7); }
  function nomeMese(token) { return MESI[Number(token.slice(5, 7)) - 1]; }
  function etichettaMese(token) { return nomeMese(token) + " " + token.slice(0, 4); }
  function dataBreve(giorno) {
    var d = dataDa(giorno);
    return GIORNI_BREVI[d.getDay()] + " " + d.getDate() + " " + MESI_BREVI[d.getMonth()];
  }
  function dataEstesa(giorno) { return numero(giorno) + " " + etichettaMese(tokenMese(giorno)); }
  function conteggioGiorni(n) { return n === 1 ? "1 giorno" : n + " giorni"; }

  function perMese(giorni) {
    var gruppi = [];
    giorni.slice().sort().forEach(function (giorno) {
      var token = tokenMese(giorno), ultimo = gruppi[gruppi.length - 1];
      if (ultimo && ultimo.token === token) ultimo.giorni.push(giorno);
      else gruppi.push({ token: token, giorni: [giorno] });
    });
    return gruppi;
  }
  function elencoGiorni(giorni) {
    return perMese(giorni).map(function (gruppo) {
      var numeri = gruppo.giorni.map(numero);
      var testo = numeri.length > 1
        ? numeri.slice(0, -1).join(", ") + " e " + numeri[numeri.length - 1]
        : String(numeri[0]);
      return testo + " " + nomeMese(gruppo.token);
    }).join(" · ");
  }

  /* ---------- Icone ---------- */
  var ICONE = {
    copia: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5H5.8A2.3 2.3 0 0 0 3.5 7.8v9.7"/>',
    spunta: '<path d="M20 6 9 17l-5-5"/>',
    chiudi: '<path d="M6 6l12 12M18 6 6 18"/>',
    righe: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    avviso: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.4M12 16.4h.01"/>',
    luogo: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/>',
    lucchetto: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  function ico(nome) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONE[nome] + "</svg>"; }

  /* ---------- Dati ---------- */
  function trova(id) { return RIGHE.filter(function (r) { return r.id === id; })[0] || null; }
  function righeDelGiorno(giorno) { return RIGHE.filter(function (r) { return r.data === giorno; }); }
  function righeDelMese(token) {
    return RIGHE.filter(function (r) { return tokenMese(r.data) === token; })
      .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  }
  function sintesi(righe) {
    var clienti = [], ore = 0, nonAbilitate = 0;
    righe.forEach(function (r) {
      ore += r.ore;
      if (!r.abilitata) nonAbilitate += 1;
      var voce = clienti.filter(function (c) { return c.nome === r.cliente; })[0];
      if (voce) { voce.ore += r.ore; voce.fresca = voce.fresca || r.fresca; }
      else clienti.push({ nome: r.cliente, ore: r.ore, fresca: r.fresca });
    });
    return { ore: ore, clienti: clienti, nonAbilitate: nonAbilitate };
  }
  function celleDelMese(token) {
    var anno = Number(token.slice(0, 4)), mese = Number(token.slice(5, 7)) - 1;
    var scarto = (new Date(anno, mese, 1).getDay() + 6) % 7;
    var celle = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(anno, mese, 1 - scarto + i);
      celle.push({ giorno: isoDa(d), fuori: d.getMonth() !== mese, festivo: d.getDay() === 0 || d.getDay() === 6 });
    }
    return celle;
  }
  function meseSpostato(token, delta) {
    var d = new Date(Number(token.slice(0, 4)), Number(token.slice(5, 7)) - 1 + delta, 1);
    return isoDa(d).slice(0, 7);
  }
  function chipRimborso(r) {
    if (!r.rimborso) return "";
    return '<span class="chip-rimborso">' + ico("luogo") + r.rimborso.etichetta + " · " + fmtEuro(r.rimborso.importo) + "</span>";
  }

  /* ---------- Tema ---------- */
  function initTheme() {
    var radice = document.documentElement;
    try { if (localStorage.getItem("cp-tema") === "dark") radice.setAttribute("data-theme", "dark"); } catch (e) { /* storage non disponibile */ }
    var pulsante = document.getElementById("themeToggle");
    if (!pulsante) return;
    pulsante.addEventListener("click", function () {
      var scuro = radice.getAttribute("data-theme") === "dark";
      if (scuro) radice.removeAttribute("data-theme"); else radice.setAttribute("data-theme", "dark");
      try { localStorage.setItem("cp-tema", scuro ? "light" : "dark"); } catch (e) { /* storage non disponibile */ }
    });
  }

  /* ============================================================
     Calendario
     ============================================================ */
  function htmlCella(cella, rigaAppunti) {
    var righe = cella.fuori ? [] : righeDelGiorno(cella.giorno);
    var s = sintesi(righe);
    var origine = !!rigaAppunti && rigaAppunti.data === cella.giorno;
    var bersaglio = !!rigaAppunti && !cella.fuori && !origine;
    var scelta = bersaglio && stato.scelti.indexOf(cella.giorno) >= 0;
    var nuova = righe.some(function (r) { return r.fresca; });

    var classi = ["cella"];
    if (cella.fuori) classi.push("fuori");
    if (cella.festivo) classi.push("festivo");
    if (cella.giorno === OGGI) classi.push("oggi");
    if (righe.length) classi.push("con-attivita");
    if (s.nonAbilitate) classi.push("non-abilitata");
    if (origine) classi.push("origine");
    if (origine && stato.scossa) classi.push("scossa");
    if (bersaglio) classi.push("bersaglio");
    if (scelta) classi.push("scelta");
    if (nuova) classi.push("nuova");
    if (!rigaAppunti && cella.giorno === GIORNO_CON_DETTAGLIO) classi.push("apribile");

    var attributi = ' data-giorno="' + cella.giorno + '"';
    if (bersaglio) {
      attributi += ' role="button" tabindex="0" aria-pressed="' + scelta + '" aria-label="' +
        (scelta ? "Togli il " : "Incolla il ") + dataEstesa(cella.giorno) + '"';
    } else if (origine) {
      attributi += ' aria-disabled="true" title="Giorno di origine: non è una destinazione"';
    }

    var alto = '<span class="n">' + numero(cella.giorno) + "</span>";
    if (origine) alto += '<span class="etichetta-giorno">Origine</span>';
    else if (cella.giorno === OGGI) alto += '<span class="etichetta-giorno">Oggi</span>';
    var destra = "";
    if (s.nonAbilitate) destra += '<span class="spia-non-abilitata" title="Righe su offerte non più abilitate">' + ico("lucchetto") + s.nonAbilitate + "</span>";
    if (righe.length) destra += '<span class="conta-righe">' + ico("righe") + righe.length + "</span>";
    if (scelta) destra += '<span class="timbro">' + ico("spunta") + "</span>";
    if (destra) alto += '<span class="dx">' + destra + "</span>";

    var clienti = s.clienti.slice(0, 2).map(function (c) {
      return '<div class="cli' + (c.fresca ? " fresca" : "") + '"><span class="nome">' + c.nome + '</span><span class="h">' + fmtOre(c.ore) + "</span></div>";
    }).join("");
    if (s.clienti.length > 2) clienti += '<span class="altri">+' + (s.clienti.length - 2) + " altri</span>";
    if (scelta) {
      clienti += '<div class="cli anteprima"><span class="nome">+ ' + rigaAppunti.cliente + '</span><span class="h">' + fmtOre(rigaAppunti.ore) + "</span></div>";
    }

    var totaleOre = s.ore + (scelta ? rigaAppunti.ore : 0);
    var piede = "";
    if (righe.length || scelta) {
      piede += '<span class="totale' + (scelta ? " con-anteprima" : "") + '">' +
        totaleOre.toFixed(1).replace(".", ",") + " <small>h</small></span>";
    }
    if (!rigaAppunti && righe.length) {
      piede += '<button type="button" class="copia-cella' + (stato.popover === cella.giorno ? " attivo" : "") +
        '" aria-label="Copia una riga del ' + dataEstesa(cella.giorno) + '" title="Copia una riga su altri giorni">' + ico("copia") + "</button>";
    }

    return '<div class="' + classi.join(" ") + '"' + attributi + ">" +
      '<div class="cella-top">' + alto + "</div>" +
      (clienti ? '<div class="clienti">' + clienti + "</div>" : "") +
      '<div class="cella-piede">' + piede + "</div></div>";
  }

  function renderCalendario() {
    var rigaAppunti = stato.appunti ? trova(stato.appunti) : null;
    document.getElementById("meseCorrente").textContent = etichettaMese(stato.mese);
    document.getElementById("calCelle").innerHTML = celleDelMese(stato.mese)
      .map(function (cella) { return htmlCella(cella, rigaAppunti); }).join("");

    var oreMese = righeDelMese(stato.mese).reduce(function (somma, r) { return somma + r.ore; }, 0);
    document.getElementById("giornateMese").textContent = fmtGiornate(oreMese);

    var legendaIncolla = document.getElementById("legendaIncolla");
    if (legendaIncolla) legendaIncolla.hidden = !rigaAppunti;
    document.body.classList.toggle("in-incolla", !!rigaAppunti);
  }

  /* ---------- Menu di scelta riga ---------- */
  function renderPopover() {
    var contenitore = document.getElementById("popover");
    if (!stato.popover) { contenitore.hidden = true; contenitore.innerHTML = ""; return; }
    var righe = righeDelGiorno(stato.popover);
    contenitore.innerHTML = "<h4>Quale riga del " + dataEstesa(stato.popover) + " vuoi copiare?</h4>" +
      righe.map(function (r) {
        return '<div class="voce-riga"><div class="dati">' +
          '<div class="cliente">' + r.cliente + "</div>" +
          '<div class="meta"><span class="tag">' + r.codice + "</span>" + fmtOre(r.ore) +
          '<span class="pill' + (r.fatturabile ? "" : " no") + '">' + (r.fatturabile ? "Fatt." : "Non fatt.") + "</span>" +
          chipRimborso(r) + "</div>" +
          (r.abilitata ? "" : '<div class="motivo">Offerta non più abilitata: la riga non si può copiare.</div>') +
          "</div>" +
          '<button type="button" class="btn btn-copia" data-copia="' + r.id + '"' + (r.abilitata ? "" : " disabled") + ">" + ico("copia") + "Copia</button></div>";
      }).join("");
    contenitore.hidden = false;

    var area = document.getElementById("calArea").getBoundingClientRect();
    var cella = document.querySelector('.cella[data-giorno="' + stato.popover + '"]');
    if (!cella) return;
    var rettangolo = cella.getBoundingClientRect();
    var larghezza = contenitore.offsetWidth;
    var sinistra = Math.min(Math.max(rettangolo.left - area.left, 4), area.width - larghezza - 4);
    contenitore.style.left = sinistra + "px";
    contenitore.style.top = (rettangolo.bottom - area.top - 4) + "px";
  }

  /* ---------- Vassoio degli appunti ---------- */
  function renderVassoio() {
    var contenitore = document.getElementById("vassoio");
    var r = stato.appunti ? trova(stato.appunti) : null;
    if (!r) { contenitore.hidden = true; contenitore.innerHTML = ""; return; }
    var quanti = stato.scelti.length;

    var giorni = quanti === 0
      ? '<span class="suggerimento">Clicca sul calendario i giorni di destinazione</span>'
      : perMese(stato.scelti).map(function (gruppo) {
        return '<button type="button" class="chip-mese' + (gruppo.token === stato.mese ? " corrente" : "") +
          '" data-mese="' + gruppo.token + '" title="Vai a ' + etichettaMese(gruppo.token) + '"><b>' +
          MESI_BREVI[Number(gruppo.token.slice(5, 7)) - 1] + "</b>" + gruppo.giorni.map(numero).join(" · ") + "</button>";
      }).join("");

    var errore = stato.errore
      ? '<div class="vassoio-errore" role="alert">' + ico("avviso") + "<span><b>Incolla non riuscito: nessuna riga è stata creata.</b>" +
        "L’offerta " + r.codice + " non è più abilitata per te. I giorni scelti sono rimasti selezionati.</span></div>"
      : "";

    contenitore.innerHTML = errore +
      '<div class="vassoio-corpo">' +
        '<div class="biglietto"><span class="ic">' + ico("copia") + "</span><div>" +
          '<div class="cap">Negli appunti · riga di ' + dataBreve(r.data) + "</div>" +
          '<div class="riga-copiata">' + r.cliente + '<span class="sep">·</span>' + r.codice +
            '<span class="sep">·</span>' + fmtOre(r.ore) + '<span class="sep">·</span>' +
            (r.fatturabile ? "fatturabile" : "non fatturabile") + chipRimborso(r) + "</div>" +
        "</div></div>" +
        '<div class="vassoio-azioni">' +
          '<button type="button" class="btn-vassoio" data-azione="annulla">Annulla</button>' +
          '<button type="button" class="btn-vassoio primario" data-azione="incolla"' + (quanti === 0 ? " disabled" : "") + ">" +
            ico("spunta") + (quanti === 0 ? "Incolla" : "Incolla su " + conteggioGiorni(quanti)) + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="vassoio-piede">' +
        '<div class="giorni-scelti" aria-live="polite">' +
          (quanti === 0 ? "" : '<span class="suggerimento">Destinazioni</span>') + giorni + "</div>" +
        '<div class="aiuto">' +
          (stato.avviso
            ? '<span class="avviso">' + stato.avviso + "</span>"
            : "<span>Un clic aggiunge, un secondo toglie · la selezione resta cambiando mese</span>") +
          "<span><kbd>Esc</kbd> esce senza incollare</span>" +
        "</div>" +
      "</div>";
    contenitore.hidden = false;
  }

  function renderEsito() {
    var contenitore = document.getElementById("esito");
    if (!stato.esito) { contenitore.hidden = true; contenitore.innerHTML = ""; return; }
    var r = stato.esito.riga;
    contenitore.innerHTML = ico("spunta") +
      '<div class="testo">Riga incollata su ' + conteggioGiorni(stato.esito.giorni.length) +
      '<div class="dettaglio">' + r.cliente + " · " + r.codice + " · " + fmtOre(r.ore) +
      (r.rimborso ? " · rimborso «" + r.rimborso.etichetta + "» incluso" : "") +
      " — " + elencoGiorni(stato.esito.giorni) + "</div></div>" +
      '<button type="button" class="chiudi" aria-label="Chiudi il messaggio" data-azione="chiudi-esito">' + ico("chiudi") + "</button>";
    contenitore.hidden = false;
  }

  function render(giornoDaRifocalizzare) {
    renderCalendario();
    renderVassoio();
    renderEsito();
    renderPopover();
    if (giornoDaRifocalizzare) {
      var cella = document.querySelector('.cella[data-giorno="' + giornoDaRifocalizzare + '"]');
      if (cella && cella.hasAttribute("tabindex")) cella.focus();
    }
    stato.scossa = false;
  }

  /* ---------- Azioni ---------- */
  function avviaIncolla(idRiga) {
    stato.appunti = idRiga;
    stato.scelti = [];
    stato.popover = null;
    stato.esito = null;
    stato.errore = false;
    stato.avviso = null;
    RIGHE.forEach(function (r) { r.fresca = false; });
    render();
  }
  function annullaIncolla() {
    stato.appunti = null;
    stato.scelti = [];
    stato.errore = false;
    stato.avviso = null;
    render();
  }
  function alternaGiorno(giorno) {
    var posizione = stato.scelti.indexOf(giorno);
    if (posizione >= 0) stato.scelti.splice(posizione, 1);
    else stato.scelti.push(giorno);
    stato.scelti.sort();
    stato.avviso = null;
    stato.errore = false;
    render(giorno);
  }
  function confermaIncolla() {
    var origine = trova(stato.appunti);
    if (!origine || stato.scelti.length === 0) return;
    if (stato.rifiutoSimulato) { stato.errore = true; render(); return; }
    stato.scelti.forEach(function (giorno, indice) {
      RIGHE.push(riga("copia-" + giorno + "-" + indice, giorno, origine, origine.ore, {
        fatturabile: origine.fatturabile, nota: origine.nota, rimborso: origine.rimborso, fresca: true
      }));
    });
    stato.esito = { giorni: stato.scelti.slice(), riga: origine };
    stato.appunti = null;
    stato.scelti = [];
    render();
  }
  function apriCopiaDaCella(giorno) {
    var righe = righeDelGiorno(giorno);
    if (righe.length === 1 && righe[0].abilitata) { avviaIncolla(righe[0].id); return; }
    stato.popover = stato.popover === giorno ? null : giorno;
    render();
  }

  function initCalendario() {
    initTheme();
    var parametri = new URLSearchParams(location.search);
    var scenario = parametri.get("stato");
    var copia = parametri.get("copia");

    if (copia && trova(copia)) stato.appunti = copia;
    if (scenario === "scelta-riga") stato.popover = GIORNO_CON_DETTAGLIO;
    if (scenario === "incolla" || scenario === "mese-diverso" || scenario === "errore" || scenario === "esito") {
      stato.appunti = "r-11a";
      stato.scelti = SCELTA_DIMOSTRATIVA.slice();
    }
    if (scenario === "mese-diverso") stato.mese = "2026-12";
    if (scenario === "errore") { stato.rifiutoSimulato = true; stato.errore = true; }

    document.getElementById("mesePrecedente").addEventListener("click", function () {
      stato.mese = meseSpostato(stato.mese, -1); stato.popover = null; render();
    });
    document.getElementById("meseSuccessivo").addEventListener("click", function () {
      stato.mese = meseSpostato(stato.mese, 1); stato.popover = null; render();
    });
    document.getElementById("meseOggi").addEventListener("click", function () {
      stato.mese = tokenMese(OGGI); stato.popover = null; render();
    });

    document.getElementById("calCelle").addEventListener("click", function (evento) {
      var cella = evento.target.closest(".cella");
      if (!cella) return;
      var giorno = cella.getAttribute("data-giorno");
      if (evento.target.closest(".copia-cella")) { evento.stopPropagation(); apriCopiaDaCella(giorno); return; }
      if (stato.appunti) {
        if (cella.classList.contains("bersaglio")) alternaGiorno(giorno);
        else if (cella.classList.contains("origine")) {
          stato.avviso = "Il giorno di origine non è una destinazione.";
          stato.scossa = true;
          render();
        }
        return;
      }
      if (giorno === GIORNO_CON_DETTAGLIO) location.href = "giornata.html";
    });
    document.getElementById("calCelle").addEventListener("keydown", function (evento) {
      if (evento.key !== "Enter" && evento.key !== " ") return;
      var cella = evento.target.closest(".cella.bersaglio");
      if (!cella || evento.target !== cella) return;
      evento.preventDefault();
      alternaGiorno(cella.getAttribute("data-giorno"));
    });

    document.getElementById("popover").addEventListener("click", function (evento) {
      var pulsante = evento.target.closest("[data-copia]");
      if (pulsante && !pulsante.disabled) avviaIncolla(pulsante.getAttribute("data-copia"));
    });
    document.getElementById("vassoio").addEventListener("click", function (evento) {
      var chip = evento.target.closest(".chip-mese");
      if (chip) { stato.mese = chip.getAttribute("data-mese"); render(); return; }
      var azione = evento.target.closest("[data-azione]");
      if (!azione || azione.disabled) return;
      if (azione.getAttribute("data-azione") === "annulla") annullaIncolla();
      if (azione.getAttribute("data-azione") === "incolla") confermaIncolla();
    });
    document.getElementById("esito").addEventListener("click", function (evento) {
      if (!evento.target.closest('[data-azione="chiudi-esito"]')) return;
      stato.esito = null;
      RIGHE.forEach(function (r) { r.fresca = false; });
      render();
    });

    document.addEventListener("click", function (evento) {
      if (!stato.popover) return;
      if (evento.target.closest("#popover") || evento.target.closest(".copia-cella")) return;
      stato.popover = null;
      render();
    });
    document.addEventListener("keydown", function (evento) {
      if (evento.key !== "Escape") return;
      if (stato.popover) { stato.popover = null; render(); return; }
      if (stato.appunti) annullaIncolla();
    });
    window.addEventListener("resize", renderPopover);

    render();
    if (scenario === "esito") { stato.mese = "2026-11"; confermaIncolla(); }
  }

  /* ============================================================
     Vista Elenco
     ============================================================ */
  function initElenco() {
    initTheme();
    var token = "2026-11";
    var righe = righeDelMese(token);
    document.getElementById("elencoCorpo").innerHTML = righe.map(function (r) {
      var d = dataDa(r.data);
      return "<tr>" +
        '<td><span class="giorno"><b>' + d.getDate() + "</b><span>" + GIORNI_BREVI[d.getDay()] + "</span></span></td>" +
        '<td><span class="cliente">' + r.cliente + "</span></td>" +
        '<td><span class="tag">' + r.codice + '</span> <span class="offerta">' + r.offerta + "</span></td>" +
        '<td class="num">' + fmtOre(r.ore) + "</td>" +
        '<td><span class="pill' + (r.fatturabile ? "" : " no") + '">' + (r.fatturabile ? "Fatt." : "Non fatt.") + "</span></td>" +
        "<td>" + (chipRimborso(r) || '<span class="offerta">—</span>') + "</td>" +
        '<td class="azione">' +
          (r.abilitata
            ? '<a class="btn btn-copia" href="index.html?copia=' + r.id + '">' + ico("copia") + "Copia</a>"
            : '<button type="button" class="btn" disabled>' + ico("copia") + 'Copia</button><span class="motivo">Offerta non più abilitata</span>') +
        "</td></tr>";
    }).join("");
    var ore = righe.reduce(function (somma, r) { return somma + r.ore; }, 0);
    document.getElementById("giornateMese").textContent = fmtGiornate(ore);
  }

  return { initTheme: initTheme, initCalendario: initCalendario, initElenco: initElenco };
})();
