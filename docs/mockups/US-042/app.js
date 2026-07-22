/* ============================================================
   Coaching Planner — US-042
   Dettaglio collaboratore con la sezione "Offerte abilitate".

   La sezione elenca SOLO le offerte su cui il collaboratore è
   abilitato (codice, descrizione, ragione sociale del cliente e
   azione "Revoca" per riga). Le offerte non abilitate non
   compaiono nella pagina.

   Il bottone "Abilita offerte" apre un dialog modale con:
   - ricerca su codice / descrizione / cliente;
   - elenco delle sole offerte ATTIVE non ancora abilitate, con
     checkbox a selezione multipla;
   - riepilogo delle selezionate e azione "Abilita selezionate".

   AC-4: al primo rilascio le offerte con attività già registrate
   nascono abilitate. Nessuna persistenza reale: stato in memoria.
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

  // ---------- Formattatori (stile it-IT) ----------
  const ORE_PER_GIORNATA = 8;
  const fmtOre      = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
  const fmtGiornate = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
  const fmtEuro     = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

  const iniziali = (testo) =>
    testo.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

  const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  const GIORNI_SETT = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];

  // ---------- Icone inline ----------
  const IC_SPUNTA  = '<path d="M20 6 9 17l-5-5"/>';
  const IC_DIVIETO = '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>';
  const IC_NODO    = '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>';
  const IC_CLIENTE = '<path d="M3 21V8.5L9 4l6 4.5V21"/><path d="M15 21h6V11l-6-3"/>';

  // ---------- Collaboratore dimostrativo ----------
  const COLLABORATORE = {
    nome: "Giulia", cognome: "Conti",
    email: "giulia.conti@coachingpartners.it",
    tariffaGiornaliera: 640,
    attivo: true,
  };

  // ---------- Offerte ATTIVE + stato abilitazione ----------
  // "conAttivita" segna le offerte su cui il collaboratore ha già
  // registrato ore: al primo rilascio nascono abilitate (AC-4).
  const OFFERTE = [
    { codice:"OFF-2026-014", descrizione:"Percorso di leadership per middle management", cliente:"TechSolutions S.p.A.", abilitata:true,  conAttivita:true  },
    { codice:"OFF-2026-021", descrizione:"Team coaching reparto vendite",                cliente:"DataFlow Srl",         abilitata:true,  conAttivita:true  },
    { codice:"OFF-2026-018", descrizione:"Coaching direzione acquisti",                  cliente:"NovaRetail S.p.A.",    abilitata:true,  conAttivita:true  },
    { codice:"OFF-2026-027", descrizione:"Onboarding manageriale neo-assunti",           cliente:"TechSolutions S.p.A.", abilitata:false, conAttivita:false },
    { codice:"OFF-2026-031", descrizione:"Sviluppo competenze di negoziazione",          cliente:"Meridiano Consulting", abilitata:false, conAttivita:false },
    { codice:"OFF-2026-035", descrizione:"Coaching di transizione per nuovi ruoli",      cliente:"DataFlow Srl",         abilitata:false, conAttivita:false },
    { codice:"OFF-2026-039", descrizione:"Public speaking per il comitato direttivo",    cliente:"NovaRetail S.p.A.",    abilitata:false, conAttivita:false },
    { codice:"OFF-2026-042", descrizione:"Gestione dei conflitti nei team di progetto",  cliente:"Meridiano Consulting", abilitata:false, conAttivita:false },
  ];

  // selezione corrente nel dialog (codici offerta)
  let selezione = new Set();

  // ---------- Storico dimostrativo (contesto sotto la sezione) ----------
  const STORICO = [
    {
      anno: 2026, mese: 6,
      attivita: [
        { giorno: 24, cliente:"TechSolutions S.p.A.", offerta:"OFF-2026-014", descrizione:"Percorso di leadership per middle management", ore:8, fatturabile:true,  nota:"Sessione plenaria di kick-off con i 12 team leader." },
        { giorno: 18, cliente:"DataFlow Srl",          offerta:"OFF-2026-021", descrizione:"Team coaching reparto vendite",                  ore:6, fatturabile:true,  nota:"" },
        { giorno: 5,  cliente:"NovaRetail S.p.A.",     offerta:"OFF-2026-018", descrizione:"Coaching direzione acquisti",                    ore:4, fatturabile:true,  nota:"Coaching individuale sul comitato acquisti." },
      ],
    },
    {
      anno: 2026, mese: 5,
      attivita: [
        { giorno: 22, cliente:"DataFlow Srl",          offerta:"OFF-2026-021", descrizione:"Team coaching reparto vendite",  ore:8, fatturabile:true, nota:"Simulazioni di trattativa con role-play." },
        { giorno: 15, cliente:"NovaRetail S.p.A.",     offerta:"OFF-2026-018", descrizione:"Coaching direzione acquisti",    ore:5, fatturabile:true, nota:"" },
      ],
    },
  ];

  // ---------- Render header profilo ----------
  const nomeCompleto = (c) => `${c.nome} ${c.cognome}`;

  function renderProfilo(){
    const c = COLLABORATORE;
    const el = document.getElementById("profilo");
    if (!el) return;
    const badge = c.attivo
      ? '<span class="badge-stato-persona attivo"><span class="d"></span>Attivo</span>'
      : '<span class="badge-stato-persona disattivato"><span class="d"></span>Disattivato</span>';
    el.innerHTML = `
      <div class="p-avatar">${iniziali(nomeCompleto(c))}</div>
      <div class="p-testi">
        <div class="p-nome"><h1>${nomeCompleto(c)}</h1>${badge}</div>
        <div class="p-meta">
          <span class="voce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            ${c.email}
          </span>
        </div>
      </div>
      <div class="p-tariffa">
        <span class="et">Tariffa giornaliera</span>
        <span class="val">${fmtEuro.format(c.tariffaGiornaliera)}</span>
      </div>`;
  }

  // ---------- Sezione "Offerte abilitate" ----------
  const abilitate = () => OFFERTE.filter((o) => o.abilitata);
  const nonAbilitate = () => OFFERTE.filter((o) => !o.abilitata);

  function cardAbilitata(off, appena){
    return `
      <div class="off-card ${appena ? "appena-abilitata" : ""}" data-cod="${off.codice}">
        <span class="cl-ini">${iniziali(off.cliente)}</span>
        <div class="off-testi">
          <div class="off-riga1">
            <span class="codice-offerta">${off.codice}</span>
            <span class="off-desc">${off.descrizione}</span>
          </div>
          <div class="off-cliente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_CLIENTE}</svg>
            ${off.cliente}
          </div>
        </div>
        <span class="badge-abil si"><span class="d"></span>Abilitata</span>
        <button class="btn-revoca" type="button" data-cod="${off.codice}"
                aria-label="Revoca l'abilitazione di ${nomeCompleto(COLLABORATORE)} su ${off.codice}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          Revoca
        </button>
      </div>`;
  }

  function renderAbilitate(codiciAppena){
    const el = document.getElementById("offLista");
    if (!el) return;
    const lista = abilitate();
    const appena = new Set(codiciAppena || []);

    if (lista.length === 0){
      el.innerHTML = `
        <div class="empty-state">
          <div class="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>
          </div>
          <h3>Nessuna offerta abilitata</h3>
          <p>Questo collaboratore non è abilitato su alcuna offerta. Usa "Abilita offerte" per selezionare le offerte attive su cui potrà inserire ore.</p>
        </div>`;
    } else {
      el.innerHTML = lista.map((o) => cardAbilitata(o, appena.has(o.codice))).join("");
      el.querySelectorAll(".btn-revoca").forEach((btn) => {
        btn.addEventListener("click", () => revoca(btn.dataset.cod));
      });
    }

    const conta = document.getElementById("contaAbil");
    if (conta){
      conta.innerHTML = `<b>${lista.length}</b> ${lista.length === 1 ? "offerta abilitata" : "offerte abilitate"}`;
    }
  }

  // ---------- Azione: revoca (server action simulata) ----------
  function revoca(codice){
    const off = OFFERTE.find((o) => o.codice === codice);
    if (!off) return;
    off.abilitata = false;
    renderAbilitate();
    mostraToast(off, false);
  }

  // ---------- Dialog "Abilita offerte" ----------
  const normalizza = (t) => t.toLowerCase();

  function opzioneOfferta(off){
    const sel = selezione.has(off.codice);
    return `
      <label class="opt-row ${sel ? "selezionata" : ""}" data-cod="${off.codice}">
        <span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SPUNTA}</svg></span>
        <input type="checkbox" ${sel ? "checked" : ""} data-cod="${off.codice}">
        <span class="opt-testi">
          <span class="opt-riga1">
            <span class="codice-offerta">${off.codice}</span>
            <span class="opt-desc">${off.descrizione}</span>
          </span>
          <span class="opt-cliente">${off.cliente}</span>
        </span>
      </label>`;
  }

  function renderOpzioni(){
    const el = document.getElementById("modalBody");
    if (!el) return;
    const q = normalizza(document.getElementById("modalSearch").value.trim());
    const candidate = nonAbilitate().filter((o) => {
      if (!q) return true;
      return normalizza(`${o.codice} ${o.descrizione} ${o.cliente}`).includes(q);
    });

    if (candidate.length === 0){
      const messaggio = nonAbilitate().length === 0
        ? "Tutte le offerte attive sono già abilitate."
        : "Nessuna offerta attiva corrisponde alla ricerca.";
      el.innerHTML = `
        <div class="modal-vuoto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <div>${messaggio}</div>
        </div>`;
    } else {
      el.innerHTML =
        `<div class="gruppo-et">Offerte attive non ancora abilitate</div>` +
        candidate.map(opzioneOfferta).join("");
      el.querySelectorAll(".opt-row input").forEach((chk) => {
        chk.addEventListener("change", () => {
          if (chk.checked) selezione.add(chk.dataset.cod);
          else selezione.delete(chk.dataset.cod);
          chk.closest(".opt-row").classList.toggle("selezionata", chk.checked);
          aggiornaRiepilogo();
        });
      });
    }
    aggiornaRiepilogo();
  }

  function aggiornaRiepilogo(){
    const el = document.getElementById("riepilogoSel");
    const btn = document.getElementById("btnAbilitaSelezionate");
    const n = selezione.size;
    if (el){
      el.className = "riepilogo-sel" + (n === 0 ? " vuoto" : "");
      el.innerHTML = `<b>${n}</b> ${n === 1 ? "offerta selezionata" : "offerte selezionate"}`;
    }
    if (btn) btn.disabled = n === 0;
  }

  function apriDialog(){
    selezione = new Set();
    const overlay = document.getElementById("modalAbilita");
    const search = document.getElementById("modalSearch");
    if (search) search.value = "";
    overlay.classList.add("aperto");
    renderOpzioni();
    if (search) search.focus();
  }

  function chiudiDialog(){
    document.getElementById("modalAbilita").classList.remove("aperto");
  }

  function confermaAbilitazione(){
    const codici = [...selezione];
    if (codici.length === 0) return;
    codici.forEach((c) => {
      const off = OFFERTE.find((o) => o.codice === c);
      if (off) off.abilitata = true;
    });
    chiudiDialog();
    renderAbilitate(codici);
    mostraToastMultiplo(codici.length);
  }

  function initDialog(){
    const btnApri = document.getElementById("btnApriDialog");
    if (btnApri) btnApri.addEventListener("click", apriDialog);

    const overlay = document.getElementById("modalAbilita");
    if (overlay){
      overlay.addEventListener("click", (e) => { if (e.target === overlay) chiudiDialog(); });
    }
    document.getElementById("modalClose")?.addEventListener("click", chiudiDialog);
    document.getElementById("btnAnnulla")?.addEventListener("click", chiudiDialog);
    document.getElementById("btnAbilitaSelezionate")?.addEventListener("click", confermaAbilitazione);
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
  function spingiToast(html){
    const wrap = toastWrap();
    const toast = document.createElement("div");
    toast.innerHTML = html.trim();
    const nodo = toast.firstChild;
    wrap.appendChild(nodo);
    setTimeout(() => { nodo.classList.add("uscita"); setTimeout(() => nodo.remove(), 300); }, 2600);
  }
  function mostraToast(off, abil){
    spingiToast(`
      <div class="toast ${abil ? "ok" : "revoca"}">
        <span class="t-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${abil ? IC_SPUNTA : IC_DIVIETO}</svg></span>
        <div class="t-testo">${abil ? "Abilitazione salvata" : "Abilitazione revocata"}<span>${off.codice} — ${off.cliente}</span></div>
      </div>`);
  }
  function mostraToastMultiplo(n){
    spingiToast(`
      <div class="toast ok">
        <span class="t-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SPUNTA}</svg></span>
        <div class="t-testo">${n === 1 ? "1 offerta abilitata" : n + " offerte abilitate"}<span>Abilitazioni salvate</span></div>
      </div>`);
  }

  // ---------- Render storico (contesto) ----------
  function totaliMese(mese){
    const ore = mese.attivita.reduce((s, a) => s + a.ore, 0);
    return { ore, giornate: ore / ORE_PER_GIORNATA, righe: mese.attivita.length };
  }
  function rigaAttivita(att, anno, mese){
    const data = new Date(anno, mese - 1, att.giorno);
    const dow = GIORNI_SETT[data.getDay()];
    const badgeFatt = att.fatturabile
      ? `<span class="badge-fatt si"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SPUNTA}</svg>Fatturabile</span>`
      : `<span class="badge-fatt no"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_DIVIETO}</svg>Non fatturabile</span>`;
    const nota = att.nota ? `<span class="testo">${att.nota}</span>` : `<span class="vuota">—</span>`;
    return `
      <tr>
        <td class="cella-giorno"><span class="g-num">${att.giorno}</span><span class="g-dow">${dow}</span></td>
        <td><div class="cella-cliente"><span class="cl-ini">${iniziali(att.cliente)}</span><b>${att.cliente}</b></div></td>
        <td class="cella-offerta"><span class="codice-offerta">${att.offerta}</span><span class="o-desc">${att.descrizione}</span></td>
        <td class="num ore"><span class="oh">${fmtOre.format(att.ore)}</span><span class="u">h</span></td>
        <td>${badgeFatt}</td>
        <td class="cella-nota">${nota}</td>
      </tr>`;
  }
  function sezioneMese(mese, indice){
    const t = totaliMese(mese);
    const recente = indice === 0 ? " mese-recente" : "";
    const righe = mese.attivita.map((a) => rigaAttivita(a, mese.anno, mese.mese)).join("");
    return `
      <section class="mese${recente}">
        <div class="nodo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_NODO}</svg></div>
        <div class="mese-head">
          <div class="etichetta">
            <h2>${MESI[mese.mese - 1]}</h2>
            <span class="anno">${mese.anno}</span>
            <span class="conteggio-att">${t.righe} attività</span>
          </div>
          <div class="mese-tot">
            <span class="tot-box"><span class="n">${fmtOre.format(t.ore)}</span><span class="et">ore totali</span></span>
            <span class="tot-box giornate"><span class="n">${fmtGiornate.format(t.giornate)}</span><span class="et">giornate equivalenti</span></span>
          </div>
        </div>
        <div class="card mese-card">
          <table class="tbl-att" aria-label="Attività di ${MESI[mese.mese - 1]} ${mese.anno}">
            <thead>
              <tr>
                <th style="width:78px;">Giorno</th>
                <th>Cliente</th>
                <th class="col-off-h">Offerta</th>
                <th class="num" style="width:82px;">Ore</th>
                <th style="width:150px;">Fatturazione</th>
                <th class="col-nota-h">Nota</th>
              </tr>
            </thead>
            <tbody>${righe}</tbody>
          </table>
        </div>
      </section>`;
  }
  function renderStorico(){
    const el = document.getElementById("timeline");
    if (!el) return;
    el.innerHTML = STORICO.map((m, i) => sezioneMese(m, i)).join("");
  }

  // ---------- Init: pagina principale ----------
  function initDettaglio(){
    renderProfilo();
    renderAbilitate();
    renderStorico();
    initDialog();
  }

  // ---------- Init: stato vuoto (nessuna offerta abilitata) ----------
  function initStatoVuoto(){
    OFFERTE.forEach((o) => { o.abilitata = false; });
    renderProfilo();
    renderAbilitate();
    renderStorico();
    initDialog();
  }

  // ---------- Init: dialog aperto (ricerca digitata + 2 selezionate) ----------
  function initDialogAperto(){
    renderProfilo();
    renderAbilitate();
    renderStorico();
    initDialog();
    // apre il dialog con una ricerca digitata e due offerte già spuntate
    const overlay = document.getElementById("modalAbilita");
    const search = document.getElementById("modalSearch");
    selezione = new Set(["OFF-2026-031", "OFF-2026-042"]);
    if (search) search.value = "Meridiano";
    overlay.classList.add("aperto");
    renderOpzioni();
  }

  return { initTheme, initDettaglio, initStatoVuoto, initDialogAperto };
})();
