/* ============================================================
   Coaching Planner — US-032
   Dettaglio avanzamento espandibile nella pagina Offerte.

   Rende la tabella trasversale delle offerte con righe
   cliccabili: il click espande sotto la riga il pannello di
   avanzamento (badge stato, KPI, barra, ripartizione per
   collaboratore); un secondo click la richiude. Vale anche per
   le offerte non attive (riga attenuata).
   ============================================================ */
const CP = (() => {

  // ---------- Tema chiaro/scuro ----------
  function initTheme(){
    const root = document.documentElement;
    const salvato = null; // mockup: nessuna persistenza
    if (salvato) root.setAttribute("data-theme", salvato);
    const toggle = document.getElementById("themeToggle");
    if (toggle){
      toggle.addEventListener("click", () => {
        const attuale = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        root.setAttribute("data-theme", attuale === "dark" ? "light" : "dark");
      });
    }
  }

  // ---------- Formattatori (stile it-IT, coerenti col dominio) ----------
  const fmtGiorni = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
  const fmtPct    = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
  const fmtEuro   = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

  const iniziali = (nome) => nome.split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join("");

  // ---------- Configurazione visiva per stato di avanzamento ----------
  const CONFIG_STATO = {
    IN_CORSO:     { chiave:"in_corso",     etichetta:"In corso",     icona:'<path d="M20 6 9 17l-5-5"/>' },
    IN_ALLERTA:   { chiave:"in_allerta",   etichetta:"In allerta",   icona:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>' },
    ESAURITA:     { chiave:"esaurita",     etichetta:"Esaurita",     icona:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>' },
    OLTRE_BUDGET: { chiave:"oltre_budget", etichetta:"Oltre budget", icona:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>' },
  };

  // ---------- Dati dimostrativi ----------
  // gg = ore / 8 ; le quote sono calcolate a runtime.
  const OFFERTE = [
    {
      id:"o1", codice:"OFF-2025-021",
      descrizione:"Percorso di leadership per middle management",
      cliente:"TechSolutions S.p.A.",
      tariffa:850, previste:40, erogate:22, stato:"IN_CORSO", attiva:true,
      collaboratori:[
        { nome:"Giulia Conti", ore:96, gg:12 },
        { nome:"Marco Rossi",  ore:48, gg:6 },
        { nome:"Elena Bruni",  ore:32, gg:4 },
      ],
    },
    {
      id:"o2", codice:"OFF-2025-018",
      descrizione:"Team coaching reparto vendite",
      cliente:"DataFlow Srl",
      tariffa:780, previste:25, erogate:21, stato:"IN_ALLERTA", attiva:true,
      collaboratori:[
        { nome:"Luca Ferrari", ore:120, gg:15 },
        { nome:"Sara Neri",    ore:48,  gg:6 },
      ],
    },
    {
      id:"o3", codice:"OFF-2025-014",
      descrizione:"Assessment competenze digitali",
      cliente:"NovaByte Group",
      tariffa:900, previste:18, erogate:18, stato:"ESAURITA", attiva:true,
      collaboratori:[
        { nome:"Paolo Verdi", ore:96, gg:12 },
        { nome:"Anna Galli",  ore:48, gg:6 },
      ],
    },
    {
      id:"o4", codice:"OFF-2025-009",
      descrizione:"Programma onboarding nuovi manager",
      cliente:"OmegaLab Spa",
      tariffa:820, previste:30, erogate:34, stato:"OLTRE_BUDGET", attiva:true,
      collaboratori:[
        { nome:"Davide Costa", ore:160, gg:20 },
        { nome:"Chiara Ricci", ore:112, gg:14 },
      ],
    },
    {
      id:"o5", codice:"OFF-2025-025",
      descrizione:"Workshop comunicazione efficace",
      cliente:"TechSolutions S.p.A.",
      tariffa:760, previste:12, erogate:0, stato:"IN_CORSO", attiva:true,
      collaboratori:[], // caso vuoto: nessuna attività registrata
    },
    {
      id:"o6", codice:"OFF-2025-003",
      descrizione:"Coaching individuale C-level",
      cliente:"LegacyCorp Srl",
      tariffa:1100, previste:20, erogate:8, stato:"IN_CORSO", attiva:false,
      collaboratori:[
        { nome:"Roberto Sala", ore:64, gg:8 },
      ],
    },
  ];

  // ---------- Derivazioni ----------
  function statoDi(o){
    const residuo = o.previste - o.erogate;
    if (residuo < 0)  return "OLTRE_BUDGET";
    if (residuo === 0 && o.previste > 0) return "ESAURITA";
    return o.stato; // IN_CORSO / IN_ALLERTA gestiti dal dato
  }
  const residuoDi = (o) => o.previste - o.erogate;
  const pctDi     = (o) => o.previste > 0 ? (o.erogate / o.previste) * 100 : 0;
  const critica   = (o) => o.attiva && residuoDi(o) <= 0 && o.previste > 0;

  // ---------- Render della tabella ----------
  function inizializzaElenco(){
    const corpo = document.getElementById("corpoOfferte");
    corpo.innerHTML = OFFERTE.map(rigaOfferta).join("");

    // conteggi in toolbar
    const attive   = OFFERTE.filter(o => o.attiva).length;
    const critiche = OFFERTE.filter(critica).length;
    document.getElementById("conteggioOfferte").textContent =
      `${OFFERTE.length} offerte · ${attive} attive · ${OFFERTE.length - attive} non attive`;
    const pill = document.getElementById("pillCritiche");
    if (critiche > 0){ pill.hidden = false; document.getElementById("numCritiche").textContent = critiche; }

    // interazione: click / tastiera sulla riga per espandere
    corpo.querySelectorAll(".riga-offerta").forEach((riga) => {
      riga.addEventListener("click", (e) => {
        if (e.target.closest(".no-expand")) return; // switch, azioni non espandono
        toggleRiga(riga);
      });
      riga.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " "){ e.preventDefault(); toggleRiga(riga); }
      });
    });
  }

  function toggleRiga(riga){
    const dettaglio = riga.nextElementSibling;
    const aperta = riga.classList.toggle("espansa");
    riga.setAttribute("aria-expanded", aperta ? "true" : "false");
    dettaglio.classList.toggle("aperta", aperta);
  }

  // ---------- Riga di offerta + riga di dettaglio ----------
  function rigaOfferta(o){
    const stato   = statoDi(o);
    const residuo = residuoDi(o);
    const pct     = pctDi(o);
    const pctVis  = Math.min(pct, 100);
    const oltre   = residuo < 0;
    const esaur   = residuo === 0 && o.previste > 0;
    const crit    = oltre || esaur;

    const classiRiga = [
      "riga-offerta",
      !o.attiva ? "riga-non-attiva" : "",
      crit && o.attiva ? "riga-critica" : "",
    ].filter(Boolean).join(" ");

    const miniBarClasse = oltre ? "is-err" : esaur ? "is-err" : stato === "IN_ALLERTA" ? "is-warn" : "";
    const residuoTesto = (residuo < 0 ? "−" : "") + fmtGiorni.format(Math.abs(residuo));

    return `
      <tr class="${classiRiga}" tabindex="0" role="button" aria-expanded="false" data-testid="riga-offerta-${o.codice}">
        <td>
          <div class="offerta-cell">
            <span class="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 6 6 6-6 6"/></svg>
            </span>
            <span class="oc-testi">
              <span class="codice-offerta">${o.codice}</span>
              <span class="descr" title="${o.descrizione}">${o.descrizione}</span>
            </span>
          </div>
        </td>
        <td>
          <div class="cliente-cell">
            <span class="av-sq">${iniziali(o.cliente)}</span>
            <span class="nome" title="${o.cliente}">${o.cliente}</span>
          </div>
        </td>
        <td class="num tariffa">${fmtEuro.format(o.tariffa)}</td>
        <td class="num">${fmtGiorni.format(o.previste)}<span class="unita">gg</span></td>
        <td class="num">
          <b>${fmtGiorni.format(o.erogate)}</b><span class="unita">gg</span>
          <span class="mini-bar ${miniBarClasse}"><i style="width:${pctVis}%"></i></span>
        </td>
        <td class="num residuo ${crit && o.attiva ? "critico" : ""}">
          <span class="valore">${residuoTesto}<span class="unita">gg</span></span>
          ${oltre ? `<span class="residuo-flag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12l7-7 7 7"/></svg>Oltre budget</span>` : ""}
          ${esaur ? `<span class="residuo-flag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>Esaurita</span>` : ""}
        </td>
        <td>
          <div class="stato-cell ${o.attiva ? "" : "is-off"}">
            <label class="switch no-expand" title="${o.attiva ? "Disattiva offerta" : "Attiva offerta"}">
              <input type="checkbox" ${o.attiva ? "checked" : ""} aria-label="${o.attiva ? "Disattiva" : "Attiva"}">
              <span class="track"><i></i></span>
            </label>
            <span class="stato-testo">${o.attiva ? "Attiva" : "Non attiva"}</span>
          </div>
        </td>
        <td class="azioni">
          <div class="row-actions no-expand">
            <a class="act-btn" href="#" onclick="return false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z"/></svg>
              Modifica
            </a>
            <button class="act-btn danger" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/></svg>
              Elimina
            </button>
          </div>
        </td>
      </tr>
      <tr class="riga-dettaglio" data-testid="dettaglio-${o.codice}">
        <td colspan="8">
          <div class="dettaglio-wrap"><div class="dettaglio-inner">
            ${pannelloAvanzamento(o, stato, residuo, pct)}
          </div></div>
        </td>
      </tr>`;
  }

  // ---------- Pannello di avanzamento (linguaggio della scheda report) ----------
  function pannelloAvanzamento(o, stato, residuo, pct){
    const cfg   = CONFIG_STATO[stato];
    const st    = cfg.chiave;
    const oltre = residuo < 0;
    const esaur = residuo === 0 && o.previste > 0;
    const pctVis = Math.min(pct, 100);
    const sottoResiduo = oltre ? "oltre il previsto" : esaur ? "nessun giorno" : "ancora disponibili";

    const righeCollab = o.collaboratori.length === 0
      ? `<div class="av-vuoto">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16v14H8l-4 4V4Z"/><path d="M9 10h6M9 13h4"/></svg>
           Nessuna attività registrata per questa offerta
         </div>`
      : `<table class="tbl-collab" aria-label="Giornate erogate per collaboratore">
           <thead>
             <tr>
               <th>Collaboratore</th>
               <th>Ore consuntivate</th>
               <th>Giornate erogate</th>
               <th>Quota</th>
             </tr>
           </thead>
           <tbody>
             ${o.collaboratori.map(c => {
               const quota = o.erogate > 0 ? (c.gg / o.erogate) * 100 : 0;
               return `<tr>
                 <td>
                   <span class="collab-nome">
                     <span class="av-collab-ini">${iniziali(c.nome)}</span>
                     <b>${c.nome}</b>
                   </span>
                 </td>
                 <td class="ore">${fmtGiorni.format(c.ore)} h</td>
                 <td class="gg">${fmtGiorni.format(c.gg)} gg</td>
                 <td class="quota">${fmtPct.format(quota)}%</td>
               </tr>`;
             }).join("")}
           </tbody>
         </table>`;

    return `
      <div class="avanzamento st-${st}">
        <div class="av-head">
          <span class="titolo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/></svg>
            Dettaglio avanzamento
          </span>
          <span class="badge-stato st-${st}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${cfg.icona}</svg>
            ${cfg.etichetta}
          </span>
        </div>

        <div class="av-body">
          <div class="kpi">
            <div class="cella">
              <span class="etichetta">Giornate previste</span>
              <span class="valore">${fmtGiorni.format(o.previste)}<span class="u">gg</span></span>
            </div>
            <div class="cella">
              <span class="etichetta">Giornate erogate</span>
              <span class="valore">${fmtGiorni.format(o.erogate)}<span class="u">gg</span></span>
            </div>
            <div class="cella residuo st-${st}">
              <span class="etichetta">Residuo</span>
              <span class="valore">${(residuo < 0 ? "−" : "") + fmtGiorni.format(Math.abs(residuo))}<span class="u">gg</span></span>
              <span class="sotto">${sottoResiduo}</span>
            </div>
          </div>

          <div class="av-barra st-${st}">
            <div class="riga-testo">
              <span class="lbl">Avanzamento erogato sul previsto</span>
              <span class="pct">${fmtPct.format(pct)}%</span>
            </div>
            <div class="track-barra"><i style="width:${pctVis}%"></i></div>
            <div class="sotto">
              <span>${fmtGiorni.format(o.erogate)} di ${fmtGiorni.format(o.previste)} gg erogate</span>
              ${oltre ? `<span class="over-flag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12l7-7 7 7"/></svg>${fmtGiorni.format(Math.abs(residuo))} gg oltre il previsto</span>` : ""}
            </div>
          </div>
        </div>

        <div class="av-collab">
          <div class="cap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 19a6.2 6.2 0 0 1 12.4 0"/><circle cx="17.2" cy="9.2" r="2.4"/><path d="M15.5 14.3a5 5 0 0 1 5.7 4.7"/></svg>
            Giornate erogate per collaboratore
          </div>
          ${righeCollab}
        </div>
      </div>`;
  }

  return { initTheme, inizializzaElenco };
})();
