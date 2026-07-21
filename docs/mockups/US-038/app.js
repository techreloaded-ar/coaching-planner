/* ============================================================
   Coaching Planner — US-038
   Pagina di dettaglio del collaboratore con storico attività
   mensile.

   Rende l'header di profilo e lo storico come timeline di
   stazioni mensili in ordine decrescente. Ogni stazione ha
   un'intestazione con totale ore e giornate equivalenti
   (1 giornata = 8 ore) e la tabella delle attività del mese:
   giorno, cliente, offerta (codice + descrizione), ore,
   indicazione fatturabile/non fatturabile e nota quando presente.

   Nessuna persistenza: dati dimostrativi in memoria.
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
  const IC_SPUNTA = '<path d="M20 6 9 17l-5-5"/>';
  const IC_DIVIETO = '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>';
  const IC_NODO = '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>';

  // ---------- Collaboratore dimostrativo ----------
  const COLLABORATORE = {
    nome: "Giulia", cognome: "Conti",
    email: "giulia.conti@coachingpartners.it",
    tariffaGiornaliera: 640,
    attivo: true,
  };

  // ---------- Storico dimostrativo ----------
  // Ogni mese elenca le sue attività (dal più recente).
  // Le ore/giornate del mese sono calcolate a runtime.
  const STORICO = [
    {
      anno: 2026, mese: 6, // Giugno 2026
      attivita: [
        { giorno: 24, cliente:"TechSolutions S.p.A.", offerta:"OFF-2026-014", descrizione:"Percorso di leadership per middle management", ore:8, fatturabile:true,  nota:"Sessione plenaria di kick-off con i 12 team leader." },
        { giorno: 18, cliente:"DataFlow Srl",          offerta:"OFF-2026-021", descrizione:"Team coaching reparto vendite",                  ore:6, fatturabile:true,  nota:"" },
        { giorno: 12, cliente:"TechSolutions S.p.A.", offerta:"OFF-2026-014", descrizione:"Percorso di leadership per middle management", ore:4, fatturabile:true,  nota:"Coaching individuale, due partecipanti in remoto." },
        { giorno: 5,  cliente:"Interno",                offerta:"OFF-2026-000", descrizione:"Preparazione materiali e allineamento interno",  ore:3, fatturabile:false, nota:"Aggiornamento slide e questionari di ingresso." },
      ],
    },
    {
      anno: 2026, mese: 5, // Maggio 2026
      attivita: [
        { giorno: 29, cliente:"NovaRetail S.p.A.",     offerta:"OFF-2026-018", descrizione:"Coaching direzione acquisti",                    ore:8, fatturabile:true,  nota:"" },
        { giorno: 22, cliente:"DataFlow Srl",          offerta:"OFF-2026-021", descrizione:"Team coaching reparto vendite",                  ore:8, fatturabile:true,  nota:"Simulazioni di trattativa con role-play." },
        { giorno: 15, cliente:"NovaRetail S.p.A.",     offerta:"OFF-2026-018", descrizione:"Coaching direzione acquisti",                    ore:5, fatturabile:true,  nota:"" },
        { giorno: 8,  cliente:"Interno",                offerta:"OFF-2026-000", descrizione:"Formazione continua e supervisione",             ore:4, fatturabile:false, nota:"Intervisione mensile del team coach." },
      ],
    },
    {
      anno: 2026, mese: 4, // Aprile 2026
      attivita: [
        { giorno: 30, cliente:"TechSolutions S.p.A.", offerta:"OFF-2026-014", descrizione:"Percorso di leadership per middle management", ore:6, fatturabile:true, nota:"" },
        { giorno: 16, cliente:"NovaRetail S.p.A.",     offerta:"OFF-2026-018", descrizione:"Coaching direzione acquisti",                    ore:8, fatturabile:true, nota:"Prima sessione di assessment con il comitato acquisti." },
      ],
    },
  ];

  // ---------- Render ----------
  function nomeCompleto(c){ return `${c.nome} ${c.cognome}`; }

  function totaliMese(mese){
    const ore = mese.attivita.reduce((somma, a) => somma + a.ore, 0);
    return { ore, giornate: ore / ORE_PER_GIORNATA, righe: mese.attivita.length };
  }

  function rigaAttivita(att, anno, mese){
    const data = new Date(anno, mese - 1, att.giorno);
    const dow = GIORNI_SETT[data.getDay()];
    const badgeFatt = att.fatturabile
      ? `<span class="badge-fatt si"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SPUNTA}</svg>Fatturabile</span>`
      : `<span class="badge-fatt no"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_DIVIETO}</svg>Non fatturabile</span>`;
    const nota = att.nota
      ? `<span class="testo">${att.nota}</span>`
      : `<span class="vuota">—</span>`;

    return `
      <tr>
        <td class="cella-giorno">
          <span class="g-num">${att.giorno}</span>
          <span class="g-dow">${dow}</span>
        </td>
        <td>
          <div class="cella-cliente">
            <span class="cl-ini">${iniziali(att.cliente)}</span>
            <b>${att.cliente}</b>
          </div>
        </td>
        <td class="cella-offerta">
          <span class="codice-offerta">${att.offerta}</span>
          <span class="o-desc">${att.descrizione}</span>
        </td>
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
            <span class="conteggio-att">${t.righe} ${t.righe === 1 ? "attività" : "attività"}</span>
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

  function renderRiepilogo(){
    const el = document.getElementById("riepilogo");
    if (!el) return;
    const oreTot = STORICO.reduce((s, m) => s + totaliMese(m).ore, 0);
    const ggTot = oreTot / ORE_PER_GIORNATA;
    el.innerHTML = `
      <span class="titolo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>
        Storico attività
      </span>
      <span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${STORICO.length} mesi</span>
      <span class="chip"><b>${fmtOre.format(oreTot)}</b> ore totali</span>
      <span class="chip"><b>${fmtGiornate.format(ggTot)}</b> giornate equivalenti</span>`;
  }

  function renderStorico(){
    const el = document.getElementById("timeline");
    if (!el) return;
    el.innerHTML = STORICO.map((m, i) => sezioneMese(m, i)).join("");
  }

  function initDettaglio(){
    renderProfilo();
    renderRiepilogo();
    renderStorico();
  }

  return { initTheme, initDettaglio, nomeCompleto, iniziali, COLLABORATORE };
})();
