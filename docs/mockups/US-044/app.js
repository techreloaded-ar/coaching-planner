/* ============================================================
   Coaching Planner — US-044
   Pagina "Collaboratori ingaggiati" di un'offerta.

   AC-1: dalla riga dell'offerta (elenco-offerte.html) il link
         "Collaboratori" porta a /offerte/{offertaId}/collaboratori,
         dove ogni ingaggiato compare con nome e cognome.
   AC-2: "Ingaggia collaboratori" apre un dialog con ricerca e
         selezione multipla dei soli collaboratori ATTIVI non
         ancora ingaggiati; la conferma li aggiunge all'elenco.
   AC-3: "Revoca" toglie un singolo ingaggio lasciando intatti
         gli altri.
   AC-4: è la stessa abilitazione mostrata nel dettaglio del
         collaboratore (US-042), vista dal verso dell'offerta.

   Nessuna persistenza reale: lo stato vive in memoria e i toast
   simulano la conferma del salvataggio.
   ============================================================ */
const CP = (() => {

  // ---------- Tema chiaro/scuro ----------
  function initTheme(){
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");
    if (toggle){
      toggle.addEventListener("click", () => {
        const attuale = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        root.setAttribute("data-theme", attuale === "dark" ? "light" : "dark");
      });
    }
  }

  // ---------- Formattatori ----------
  const fmtEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

  const iniziali = (testo) =>
    testo.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

  // ---------- Icone inline ----------
  const IC_SPUNTA  = '<path d="M20 6 9 17l-5-5"/>';
  const IC_DIVIETO = '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>';
  const IC_CESTINO = '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>';
  const IC_CLIENTE = '<path d="M3 21V8.5L9 4l6 4.5V21"/><path d="M15 21h6V11l-6-3"/>';
  const IC_SQUADRA = '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0"/><circle cx="17.2" cy="9.4" r="2.6"/><path d="M15.4 14.6a5 5 0 0 1 5.8 4.8"/>';

  // ---------- Offerta di cui si compone la squadra ----------
  const OFFERTA = {
    codice: "OFF-2026-014",
    descrizione: "Percorso di leadership per middle management",
    cliente: "TechSolutions S.p.A.",
    tariffaGiornaliera: 780,
    attiva: true,
  };

  // ---------- Collaboratori ----------
  // "ingaggiato" = esiste l'abilitazione fra questo collaboratore e
  // l'offerta. Un profilo disattivato già ingaggiato resta in elenco
  // (e resta revocabile), ma non è più proponibile nel dialog.
  const COLLABORATORI = [
    { nome:"Giulia",     cognome:"Conti",   email:"giulia.conti@coachingpartners.it",     attivo:true,  ingaggiato:true  },
    { nome:"Marco",      cognome:"Bianchi", email:"marco.bianchi@coachingpartners.it",    attivo:true,  ingaggiato:true  },
    { nome:"Elena",      cognome:"Ferrari", email:"elena.ferrari@coachingpartners.it",    attivo:false, ingaggiato:true  },
    { nome:"Luca",       cognome:"Romano",  email:"luca.romano@coachingpartners.it",      attivo:true,  ingaggiato:false },
    { nome:"Sara",       cognome:"Greco",   email:"sara.greco@coachingpartners.it",       attivo:true,  ingaggiato:false },
    { nome:"Davide",     cognome:"Costa",   email:"davide.costa@coachingpartners.it",     attivo:true,  ingaggiato:false },
    { nome:"Chiara",     cognome:"Bruno",   email:"chiara.bruno@coachingpartners.it",     attivo:true,  ingaggiato:false },
    { nome:"Alessandro", cognome:"Rizzo",   email:"alessandro.rizzo@coachingpartners.it", attivo:true,  ingaggiato:false },
    { nome:"Francesca",  cognome:"Moretti", email:"francesca.moretti@coachingpartners.it",attivo:false, ingaggiato:false },
  ];

  const nomeCompleto = (c) => `${c.nome} ${c.cognome}`;
  const chiave = (c) => `${c.nome}-${c.cognome}`;

  // selezione corrente nel dialog
  let selezione = new Set();

  // ---------- Testata dell'offerta ----------
  function renderTestata(){
    const el = document.getElementById("testataOfferta");
    if (!el) return;
    const badge = OFFERTA.attiva
      ? '<span class="badge-stato-offerta attiva"><span class="d"></span>Attiva</span>'
      : '<span class="badge-stato-offerta non-attiva"><span class="d"></span>Non attiva</span>';
    el.innerHTML = `
      <div class="o-marchio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>
      </div>
      <div class="o-testi">
        <div class="o-riga1">
          <span class="codice-offerta">${OFFERTA.codice}</span>
          ${badge}
        </div>
        <h1>${OFFERTA.descrizione}</h1>
        <div class="o-meta">
          <span class="voce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_CLIENTE}</svg>
            <b>${OFFERTA.cliente}</b>
          </span>
          <span class="voce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 6.5c0-2-2.2-3-5-3s-5 .9-5 2.8c0 4.3 10 2.2 10 6.4 0 2-2.2 3.1-5 3.1s-5-1-5-3"/></svg>
            Tariffa giornaliera <b>${fmtEuro.format(OFFERTA.tariffaGiornaliera)}</b>
          </span>
        </div>
      </div>
      <div class="o-squadra">
        <span class="et">Squadra</span>
        <span class="val" id="valSquadra">0</span>
        <span class="u" id="uSquadra">collaboratori</span>
      </div>`;
  }

  // ---------- Elenco degli ingaggiati ----------
  const ingaggiati = () => COLLABORATORI.filter((c) => c.ingaggiato);
  const ingaggiabili = () => COLLABORATORI.filter((c) => !c.ingaggiato && c.attivo);

  function rigaIngaggiato(c, appena){
    const badge = c.attivo
      ? '<span class="badge-stato-persona attivo"><span class="d"></span>Attivo</span>'
      : '<span class="badge-stato-persona disattivato"><span class="d"></span>Disattivato</span>';
    return `
      <tr class="${appena ? "appena-ingaggiato " : ""}${c.attivo ? "" : "profilo-spento"}" data-k="${chiave(c)}">
        <td>
          <div class="cella-persona">
            <span class="p-ini ${c.attivo ? "" : "spento"}">${iniziali(nomeCompleto(c))}</span>
            <span class="p-testi">
              <span class="p-nome">${nomeCompleto(c)}</span>
              <span class="p-email">${c.email}</span>
            </span>
          </div>
        </td>
        <td class="col-stato">${badge}</td>
        <td class="destra">
          <button class="btn-revoca" type="button" data-k="${chiave(c)}"
                  aria-label="Revoca l'ingaggio di ${nomeCompleto(c)} sull'offerta ${OFFERTA.codice}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_CESTINO}</svg>
            <span class="lbl-revoca">Revoca</span>
          </button>
        </td>
      </tr>`;
  }

  function renderIngaggiati(chiaviAppena){
    const el = document.getElementById("elencoIngaggiati");
    if (!el) return;
    const lista = ingaggiati();
    const appena = new Set(chiaviAppena || []);

    if (lista.length === 0){
      el.innerHTML = `
        <div class="empty-state">
          <div class="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SQUADRA}</svg>
          </div>
          <h3>Nessun collaboratore ingaggiato</h3>
          <p>Su questa offerta non è ancora ingaggiato nessuno. Usa "Ingaggia collaboratori" per scegliere fra i collaboratori attivi chi comporrà la squadra.</p>
        </div>`;
    } else {
      el.innerHTML = `
        <section class="card tabella-wrap">
          <table class="tbl-collab" aria-label="Collaboratori ingaggiati sull'offerta ${OFFERTA.codice}">
            <thead>
              <tr>
                <th>Collaboratore</th>
                <th class="col-stato-h" style="width:170px;">Stato</th>
                <th class="destra" style="width:140px;">Azioni</th>
              </tr>
            </thead>
            <tbody>${lista.map((c) => rigaIngaggiato(c, appena.has(chiave(c)))).join("")}</tbody>
          </table>
        </section>`;
      el.querySelectorAll(".btn-revoca").forEach((btn) => {
        btn.addEventListener("click", () => revoca(btn.dataset.k));
      });
    }

    const conta = document.getElementById("contaIngaggi");
    if (conta){
      conta.innerHTML = `<b>${lista.length}</b> ${lista.length === 1 ? "collaboratore ingaggiato" : "collaboratori ingaggiati"}`;
    }
    const val = document.getElementById("valSquadra");
    const u = document.getElementById("uSquadra");
    if (val) val.textContent = String(lista.length);
    if (u) u.textContent = lista.length === 1 ? "collaboratore" : "collaboratori";
  }

  // ---------- Azione: revoca del singolo ingaggio (AC-3) ----------
  function revoca(k){
    const c = COLLABORATORI.find((x) => chiave(x) === k);
    if (!c) return;
    c.ingaggiato = false;
    renderIngaggiati();
    mostraToast(`Ingaggio revocato`, `${nomeCompleto(c)} — ${OFFERTA.codice}`, false);
  }

  // ---------- Dialog "Ingaggia collaboratori" ----------
  const normalizza = (t) => t.toLowerCase();

  function opzioneCollaboratore(c){
    const sel = selezione.has(chiave(c));
    return `
      <label class="opt-row ${sel ? "selezionata" : ""}" data-k="${chiave(c)}">
        <span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SPUNTA}</svg></span>
        <input type="checkbox" ${sel ? "checked" : ""} data-k="${chiave(c)}">
        <span class="opt-ini">${iniziali(nomeCompleto(c))}</span>
        <span class="opt-testi">
          <span class="opt-nome">${nomeCompleto(c)}</span>
          <span class="opt-email">${c.email}</span>
        </span>
      </label>`;
  }

  function renderOpzioni(){
    const el = document.getElementById("modalBody");
    if (!el) return;
    const q = normalizza(document.getElementById("modalSearch").value.trim());
    const candidati = ingaggiabili().filter((c) => {
      if (!q) return true;
      return normalizza(`${nomeCompleto(c)} ${c.email}`).includes(q);
    });

    if (candidati.length === 0){
      const messaggio = ingaggiabili().length === 0
        ? "Tutti i collaboratori attivi sono già ingaggiati su questa offerta."
        : "Nessun collaboratore attivo corrisponde alla ricerca.";
      el.innerHTML = `
        <div class="modal-vuoto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <div>${messaggio}</div>
        </div>`;
    } else {
      el.innerHTML =
        `<div class="gruppo-et">Collaboratori attivi non ancora ingaggiati</div>` +
        candidati.map(opzioneCollaboratore).join("");
      el.querySelectorAll(".opt-row input").forEach((chk) => {
        chk.addEventListener("change", () => {
          if (chk.checked) selezione.add(chk.dataset.k);
          else selezione.delete(chk.dataset.k);
          chk.closest(".opt-row").classList.toggle("selezionata", chk.checked);
          aggiornaRiepilogo();
        });
      });
    }
    aggiornaRiepilogo();
  }

  function aggiornaRiepilogo(){
    const el = document.getElementById("riepilogoSel");
    const btn = document.getElementById("btnIngaggiaSelezionati");
    const n = selezione.size;
    if (el){
      el.className = "riepilogo-sel" + (n === 0 ? " vuoto" : "");
      el.innerHTML = `<b>${n}</b> ${n === 1 ? "collaboratore selezionato" : "collaboratori selezionati"}`;
    }
    if (btn) btn.disabled = n === 0;
  }

  function apriDialog(){
    selezione = new Set();
    const overlay = document.getElementById("modalIngaggia");
    const search = document.getElementById("modalSearch");
    if (search) search.value = "";
    overlay.classList.add("aperto");
    renderOpzioni();
    if (search) search.focus();
  }

  function chiudiDialog(){
    document.getElementById("modalIngaggia").classList.remove("aperto");
  }

  function confermaIngaggio(){
    const chiavi = [...selezione];
    if (chiavi.length === 0) return;
    chiavi.forEach((k) => {
      const c = COLLABORATORI.find((x) => chiave(x) === k);
      if (c) c.ingaggiato = true;
    });
    chiudiDialog();
    renderIngaggiati(chiavi);
    mostraToast(
      chiavi.length === 1 ? "1 collaboratore ingaggiato" : `${chiavi.length} collaboratori ingaggiati`,
      "Ingaggi salvati sull'offerta " + OFFERTA.codice,
      true,
    );
  }

  function initDialog(){
    document.getElementById("btnApriDialog")?.addEventListener("click", apriDialog);

    const overlay = document.getElementById("modalIngaggia");
    if (overlay){
      overlay.addEventListener("click", (e) => { if (e.target === overlay) chiudiDialog(); });
    }
    document.getElementById("modalClose")?.addEventListener("click", chiudiDialog);
    document.getElementById("btnAnnulla")?.addEventListener("click", chiudiDialog);
    document.getElementById("btnIngaggiaSelezionati")?.addEventListener("click", confermaIngaggio);
    document.getElementById("modalSearch")?.addEventListener("input", renderOpzioni);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay?.classList.contains("aperto")) chiudiDialog();
    });
  }

  // ---------- Toast di conferma ----------
  function toastWrap(){
    let wrap = document.getElementById("toastWrap");
    if (!wrap){
      wrap = document.createElement("div");
      wrap.id = "toastWrap";
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function mostraToast(titolo, dettaglio, positivo){
    const wrap = toastWrap();
    const contenitore = document.createElement("div");
    contenitore.innerHTML = `
      <div class="toast ${positivo ? "ok" : "revoca"}">
        <span class="t-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${positivo ? IC_SPUNTA : IC_DIVIETO}</svg></span>
        <div class="t-testo">${titolo}<span>${dettaglio}</span></div>
      </div>`.trim();
    const nodo = contenitore.firstChild;
    wrap.appendChild(nodo);
    setTimeout(() => { nodo.classList.add("uscita"); setTimeout(() => nodo.remove(), 300); }, 2600);
  }

  // ---------- Init: pagina con collaboratori ingaggiati ----------
  function initPagina(){
    renderTestata();
    renderIngaggiati();
    initDialog();
  }

  // ---------- Init: stato vuoto (nessun ingaggio) ----------
  function initStatoVuoto(){
    COLLABORATORI.forEach((c) => { c.ingaggiato = false; });
    renderTestata();
    renderIngaggiati();
    initDialog();
  }

  // ---------- Init: dialog aperto con ricerca digitata e 2 selezionati ----------
  function initDialogAperto(){
    renderTestata();
    renderIngaggiati();
    initDialog();
    const overlay = document.getElementById("modalIngaggia");
    const search = document.getElementById("modalSearch");
    selezione = new Set(["Luca-Romano", "Alessandro-Rizzo"]);
    if (search) search.value = "ro";
    overlay.classList.add("aperto");
    renderOpzioni();
  }

  // ---------- Init: elenco offerte (punto di ingresso, AC-1) ----------
  const ELENCO_OFFERTE = [
    { codice:"OFF-2026-014", descrizione:"Percorso di leadership per middle management", cliente:"TechSolutions S.p.A.", tariffa:780, squadra:3, corrente:true },
    { codice:"OFF-2026-021", descrizione:"Team coaching reparto vendite",                cliente:"DataFlow Srl",         tariffa:640, squadra:2 },
    { codice:"OFF-2026-018", descrizione:"Coaching direzione acquisti",                  cliente:"NovaRetail S.p.A.",    tariffa:700, squadra:1 },
    { codice:"OFF-2026-031", descrizione:"Sviluppo competenze di negoziazione",          cliente:"Meridiano Consulting", tariffa:820, squadra:0 },
  ];

  function initElencoOfferte(){
    const el = document.getElementById("corpoOfferte");
    if (!el) return;
    el.innerHTML = ELENCO_OFFERTE.map((o) => `
      <tr>
        <td>
          <span class="codice-offerta">${o.codice}</span>
          <span class="off-desc">${o.descrizione}</span>
        </td>
        <td class="cella-cliente-td">
          <div class="cella-cliente">
            <span class="cl-ini">${iniziali(o.cliente)}</span>
            <span>${o.cliente}</span>
          </div>
        </td>
        <td class="destra" style="font-variant-numeric:tabular-nums;font-weight:600;">${fmtEuro.format(o.tariffa)}</td>
        <td class="destra">
          <div class="azioni-riga">
            <a class="link-azione nuovo" href="${o.corrente ? "index.html" : "#"}"
               ${o.corrente ? "" : 'onclick="return false"'}
               title="Collaboratori ingaggiati su ${o.codice}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SQUADRA}</svg>
              Collaboratori
            </a>
            <a class="link-azione" href="#" onclick="return false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z"/></svg>
              Modifica
            </a>
            <button class="link-azione pericolo" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/></svg>
              Elimina
            </button>
          </div>
        </td>
      </tr>`).join("");
  }

  return { initTheme, initPagina, initStatoVuoto, initDialogAperto, initElencoOfferte };
})();
