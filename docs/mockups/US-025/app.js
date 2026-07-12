/* ============================================================
   US-025 — Pagina Offerte trasversale con stato e avanzamento
   Back office · ruolo AMMINISTRATORE · route /offerte
   Prototipo: elenco di TUTTE le offerte di TUTTI i clienti con
   tariffa, giorni previsti, giornate erogate e residuo.
   Erogate e residuo sono derivati a runtime dagli stessi dati
   della vista di avanzamento (1 giornata = 8 ore consuntivate).
   ============================================================ */

window.CP = (function () {

  /* ---------- Tema chiaro/scuro (coerente con i mockup back office) ---------- */
  function initTheme() {
    const salvato = localStorage.getItem('cp-mockup-tema');
    const preferisceScuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applicaTema(salvato || (preferisceScuro ? 'dark' : 'light'));
    const bottone = document.getElementById('themeToggle');
    if (bottone) bottone.addEventListener('click', alternaTema);
  }
  function applicaTema(tema) {
    if (tema === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }
  function alternaTema() {
    const prossimo = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applicaTema(prossimo);
    localStorage.setItem('cp-mockup-tema', prossimo);
  }

  /* ---------- Formattazione ---------- */
  function formattaEuro(valore) {
    return valore.toLocaleString('it-IT', {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function formattaGiornate(valore) {
    if (Number.isInteger(valore)) return String(valore);
    return valore.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function iniziali(nome) {
    const parole = nome.trim().split(/\s+/);
    return ((parole[0]?.[0] || '') + (parole[1]?.[0] || '')).toUpperCase();
  }

  /* ============================================================
     Dataset demo — offerte di tutti i clienti.
     `giornateErogate` deriva dalle ore consuntivate dai collaboratori
     (qui precalcolate per il prototipo); residuo = previsti − erogate.
     Include: offerte attive in corso, un'attiva ESAURITA (residuo 0),
     un'attiva OLTRE BUDGET (residuo negativo) e due NON ATTIVE.
     ============================================================ */
  const OFFERTE = [
    {
      cliente: 'Banca Sintesi', codice: 'OFF-2025-012',
      descrizione: 'Coaching executive per il middle management',
      tariffaGiornaliera: 950, giorniPrevisti: 24, giornateErogate: 9.5, attiva: true
    },
    {
      cliente: 'TechNova Consulting', codice: 'OFF-2025-004',
      descrizione: 'Coaching individuale C-level — percorso annuale',
      tariffaGiornaliera: 1100, giorniPrevisti: 12, giornateErogate: 13.5, attiva: true // oltre budget
    },
    {
      cliente: 'Banca Sintesi', codice: 'OFF-2024-031',
      descrizione: 'Percorso leadership per responsabili di filiale',
      tariffaGiornaliera: 900, giorniPrevisti: 18, giornateErogate: 18, attiva: true // esaurita
    },
    {
      cliente: 'Molini Riuniti SpA', codice: 'OFF-2025-019',
      descrizione: 'Team coaching per le squadre di produzione',
      tariffaGiornaliera: 850, giorniPrevisti: 20, giornateErogate: 4, attiva: true
    },
    {
      cliente: 'TechNova Consulting', codice: 'OFF-2025-008',
      descrizione: 'Facilitazione OKR e rituali agili di team',
      tariffaGiornaliera: 780, giorniPrevisti: 15, giornateErogate: 11, attiva: true
    },
    {
      cliente: 'Ospedale San Verano', codice: 'OFF-2025-002',
      descrizione: 'Sviluppo competenze manageriali dei caposala',
      tariffaGiornaliera: 820, giorniPrevisti: 30, giornateErogate: 16.5, attiva: true
    },
    {
      cliente: 'Molini Riuniti SpA', codice: 'OFF-2023-027',
      descrizione: 'Workshop di comunicazione efficace (edizione 2023)',
      tariffaGiornaliera: 700, giorniPrevisti: 10, giornateErogate: 6, attiva: false // non attiva, residuo inutilizzato
    },
    {
      cliente: 'Studio Legale Ferrandi', codice: 'OFF-2024-015',
      descrizione: 'Coaching per soci e associati senior',
      tariffaGiornaliera: 1000, giorniPrevisti: 8, giornateErogate: 8, attiva: false // non attiva ed esaurita
    }
  ];

  /* ---------- Derivazioni ---------- */
  function residuoDi(offerta) {
    return offerta.giorniPrevisti - offerta.giornateErogate;
  }
  function eCritica(offerta) {
    return residuoDi(offerta) <= 0; // esaurita o oltre budget
  }

  /* ---------- Rendering di una riga ---------- */
  function rigaOfferta(offerta) {
    const residuo = residuoDi(offerta);
    const esaurita = residuo === 0;
    const oltreBudget = residuo < 0;
    const critica = esaurita || oltreBudget;

    const percentuale = offerta.giorniPrevisti > 0
      ? Math.min((offerta.giornateErogate / offerta.giorniPrevisti) * 100, 100)
      : 0;
    const quasiEsaurita = !critica && offerta.giorniPrevisti > 0 &&
      offerta.giornateErogate / offerta.giorniPrevisti >= 0.85;

    const classiRiga = [
      !offerta.attiva ? 'riga-non-attiva' : '',
      offerta.attiva && critica ? 'riga-critica' : ''
    ].filter(Boolean).join(' ');

    const classeBarra = oltreBudget ? 'is-err' : (quasiEsaurita ? 'is-warn' : '');

    const flagResiduo = oltreBudget
      ? `<span class="residuo-flag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12l7-7 7 7"/></svg>Oltre budget</span>`
      : esaurita
        ? `<span class="residuo-flag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>Esaurita</span>`
        : '';

    const badgeStato = offerta.attiva
      ? `<span class="badge b-ok"><span class="d"></span>Attiva</span>`
      : `<span class="badge b-off"><span class="d"></span>Non attiva</span>`;

    // meno tipografico per il residuo negativo
    const residuoTesto = (residuo < 0 ? '−' : '') + formattaGiornate(Math.abs(residuo));

    return `
      <tr class="${classiRiga}">
        <td>
          <div class="offerta-cell">
            <span class="codice-offerta">${offerta.codice}</span>
            <span class="descr" title="${offerta.descrizione}">${offerta.descrizione}</span>
          </div>
        </td>
        <td>
          <div class="cliente-cell">
            <span class="av-sq">${iniziali(offerta.cliente)}</span>
            <span class="nome" title="${offerta.cliente}">${offerta.cliente}</span>
          </div>
        </td>
        <td class="num tariffa">${formattaEuro(offerta.tariffaGiornaliera)}</td>
        <td class="num">${formattaGiornate(offerta.giorniPrevisti)}<span class="unita">gg</span></td>
        <td class="num erogate">
          <b>${formattaGiornate(offerta.giornateErogate)}</b><span class="unita">gg</span>
          <span class="mini-bar ${classeBarra}" role="img"
                aria-label="Erogato ${Math.round(percentuale)}% del previsto"
                title="${formattaGiornate(offerta.giornateErogate)} di ${formattaGiornate(offerta.giorniPrevisti)} gg erogate">
            <i style="width:${percentuale}%"></i>
          </span>
        </td>
        <td class="num residuo ${critica ? 'critico' : ''}">
          <b class="valore">${residuoTesto}<span class="unita">gg</span></b>
          ${flagResiduo}
        </td>
        <td>${badgeStato}</td>
      </tr>`;
  }

  /* ---------- Rendering tabella + toolbar ---------- */
  function disegnaTabellaOfferte() {
    const corpo = document.getElementById('corpoOfferte');
    const conteggio = document.getElementById('conteggioOfferte');
    const pillCritiche = document.getElementById('pillCritiche');
    const numCritiche = document.getElementById('numCritiche');
    const campoRicerca = document.getElementById('campoRicerca');

    function aggiorna() {
      const filtro = (campoRicerca?.value || '').trim().toLowerCase();
      const filtrate = OFFERTE.filter((o) =>
        !filtro ||
        o.cliente.toLowerCase().includes(filtro) ||
        o.codice.toLowerCase().includes(filtro) ||
        o.descrizione.toLowerCase().includes(filtro)
      );

      // ordinamento: prima le attive critiche, poi le attive, in coda le non attive
      const ordinate = [...filtrate].sort((a, b) => {
        if (a.attiva !== b.attiva) return a.attiva ? -1 : 1;
        const critA = a.attiva && eCritica(a) ? 0 : 1;
        const critB = b.attiva && eCritica(b) ? 0 : 1;
        if (critA !== critB) return critA - critB;
        return a.cliente.localeCompare(b.cliente) || a.codice.localeCompare(b.codice);
      });

      corpo.innerHTML = ordinate.length
        ? ordinate.map(rigaOfferta).join('')
        : `<tr><td colspan="7" class="nessun-risultato">Nessuna offerta corrisponde alla ricerca.</td></tr>`;

      const attive = filtrate.filter((o) => o.attiva).length;
      const nonAttive = filtrate.length - attive;
      conteggio.textContent =
        `${filtrate.length} offert${filtrate.length === 1 ? 'a' : 'e'} · ${attive} attive · ${nonAttive} non attive`;

      const critiche = filtrate.filter((o) => o.attiva && eCritica(o)).length;
      if (pillCritiche) {
        pillCritiche.hidden = critiche === 0;
        numCritiche.textContent = critiche;
      }
    }

    campoRicerca?.addEventListener('input', aggiorna);
    aggiorna();
  }

  return { initTheme, disegnaTabellaOfferte, formattaEuro, formattaGiornate, iniziali };
})();
