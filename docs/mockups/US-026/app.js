/* ============================================================
   US-026 — Gestione delle offerte dalla pagina Offerte
   Back office · ruolo AMMINISTRATORE · route /offerte
   Prototipo: ciclo di vita completo delle offerte gestito da un
   unico punto — creazione (con scelta del cliente), modifica,
   attivazione/disattivazione tramite flag di stato ed eliminazione
   (bloccata quando esistono righe di attività collegate).
   ============================================================ */

window.CP = (function () {

  /* ---------- Tema chiaro/scuro ---------- */
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
  function escapeHtml(testo) {
    return String(testo).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function interpretaImporto(testo) {
    const normalizzato = String(testo).trim().replace(/\./g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalizzato)) return NaN;
    return parseFloat(normalizzato);
  }

  /* ============================================================
     Clienti — solo gli ATTIVI sono selezionabili nel form offerta.
     ============================================================ */
  const CLIENTI = [
    { id: 'cli-001', ragioneSociale: 'Banca Sintesi', attivo: true },
    { id: 'cli-002', ragioneSociale: 'TechNova Consulting', attivo: true },
    { id: 'cli-003', ragioneSociale: 'Molini Riuniti SpA', attivo: true },
    { id: 'cli-004', ragioneSociale: 'Ospedale San Verano', attivo: true },
    { id: 'cli-005', ragioneSociale: 'Studio Legale Ferrandi', attivo: true },
    { id: 'cli-006', ragioneSociale: 'Cooperativa Aurora', attivo: false } // cessato: non selezionabile
  ];
  function trovaCliente(id) { return CLIENTI.find((c) => c.id === id) || null; }
  function clientiAttivi() { return CLIENTI.filter((c) => c.attivo); }

  /* ============================================================
     Dataset demo — offerte di tutti i clienti.
     `attivitaCollegate` = numero di righe di attività registrate
     sull'offerta: se > 0 l'eliminazione è bloccata.
     ============================================================ */
  const OFFERTE = [
    {
      id: 'off-001', clienteId: 'cli-001', codice: 'OFF-2025-012',
      descrizione: 'Coaching executive per il middle management',
      tariffaGiornaliera: 950, giorniPrevisti: 24, giornateErogate: 9.5,
      attiva: true, attivitaCollegate: 12
    },
    {
      id: 'off-002', clienteId: 'cli-002', codice: 'OFF-2025-004',
      descrizione: 'Coaching individuale C-level — percorso annuale',
      tariffaGiornaliera: 1100, giorniPrevisti: 12, giornateErogate: 13.5,
      attiva: true, attivitaCollegate: 27 // oltre budget
    },
    {
      id: 'off-003', clienteId: 'cli-001', codice: 'OFF-2024-031',
      descrizione: 'Percorso leadership per responsabili di filiale',
      tariffaGiornaliera: 900, giorniPrevisti: 18, giornateErogate: 18,
      attiva: true, attivitaCollegate: 18 // esaurita
    },
    {
      id: 'off-004', clienteId: 'cli-003', codice: 'OFF-2025-019',
      descrizione: 'Team coaching per le squadre di produzione',
      tariffaGiornaliera: 850, giorniPrevisti: 20, giornateErogate: 4,
      attiva: true, attivitaCollegate: 5
    },
    {
      id: 'off-005', clienteId: 'cli-002', codice: 'OFF-2025-008',
      descrizione: 'Facilitazione OKR e rituali agili di team',
      tariffaGiornaliera: 780, giorniPrevisti: 15, giornateErogate: 0,
      attiva: true, attivitaCollegate: 0 // nessuna attività: eliminabile
    },
    {
      id: 'off-006', clienteId: 'cli-004', codice: 'OFF-2025-002',
      descrizione: 'Sviluppo competenze manageriali dei caposala',
      tariffaGiornaliera: 820, giorniPrevisti: 30, giornateErogate: 16.5,
      attiva: true, attivitaCollegate: 20
    },
    {
      id: 'off-007', clienteId: 'cli-003', codice: 'OFF-2023-027',
      descrizione: 'Workshop di comunicazione efficace (edizione 2023)',
      tariffaGiornaliera: 700, giorniPrevisti: 10, giornateErogate: 6,
      attiva: false, attivitaCollegate: 8 // non attiva, con attività
    },
    {
      id: 'off-008', clienteId: 'cli-005', codice: 'OFF-2024-015',
      descrizione: 'Coaching per soci e associati senior',
      tariffaGiornaliera: 1000, giorniPrevisti: 8, giornateErogate: 0,
      attiva: false, attivitaCollegate: 0 // non attiva e senza attività: eliminabile
    }
  ];
  function trovaOfferta(id) { return OFFERTE.find((o) => o.id === id) || null; }
  function offerteDelCliente(clienteId) { return OFFERTE.filter((o) => o.clienteId === clienteId); }

  /* ---------- Derivazioni ---------- */
  function residuoDi(offerta) { return offerta.giorniPrevisti - offerta.giornateErogate; }
  function eCritica(offerta) { return residuoDi(offerta) <= 0; }

  /* ============================================================
     ELENCO — rendering tabella con azioni di riga + banner esito
     ============================================================ */

  /* ---------- Banner di esito (verde) ---------- */
  const MESSAGGI_ESITO = {
    creata:      'Offerta creata con successo.',
    salvata:     'Modifiche all\'offerta salvate.',
    eliminata:   'Offerta eliminata.',
    attivata:    'Offerta attivata: ora è visibile come attiva nell\'elenco.',
    disattivata: 'Offerta disattivata: non concorre più al lavoro in corso.'
  };
  function mostraBannerEsito(chiave, dettaglio) {
    const banner = document.getElementById('bannerEsito');
    if (!banner || !MESSAGGI_ESITO[chiave]) return;
    const testo = banner.querySelector('.testo');
    testo.innerHTML = `<b>Fatto.</b> ${escapeHtml(MESSAGGI_ESITO[chiave])}` +
      (dettaglio ? ` <span style="opacity:.85">(${escapeHtml(dettaglio)})</span>` : '');
    banner.hidden = false;
    banner.classList.remove('banner-in'); void banner.offsetWidth; banner.classList.add('banner-in');
  }
  function inizializzaBanner() {
    const banner = document.getElementById('bannerEsito');
    if (!banner) return;
    banner.querySelector('.chiudi')?.addEventListener('click', () => { banner.hidden = true; });
    // esito proveniente dal form crea/modifica (redirect con ?esito=…&codice=…)
    const parametri = new URLSearchParams(location.search);
    const esito = parametri.get('esito');
    if (esito) mostraBannerEsito(esito, parametri.get('codice') || '');
  }

  /* ---------- Riga di offerta ---------- */
  function rigaOfferta(offerta) {
    const cliente = trovaCliente(offerta.clienteId);
    const nomeCliente = cliente ? cliente.ragioneSociale : '—';
    const residuo = residuoDi(offerta);
    const esaurita = residuo === 0;
    const oltreBudget = residuo < 0;
    const critica = esaurita || oltreBudget;

    const percentuale = offerta.giorniPrevisti > 0
      ? Math.min((offerta.giornateErogate / offerta.giorniPrevisti) * 100, 100) : 0;
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

    const residuoTesto = (residuo < 0 ? '−' : '') + formattaGiornate(Math.abs(residuo));

    return `
      <tr class="${classiRiga}" data-id="${offerta.id}">
        <td>
          <div class="offerta-cell">
            <span class="codice-offerta">${escapeHtml(offerta.codice)}</span>
            <span class="descr" title="${escapeHtml(offerta.descrizione)}">${escapeHtml(offerta.descrizione)}</span>
          </div>
        </td>
        <td>
          <div class="cliente-cell">
            <span class="av-sq">${iniziali(nomeCliente)}</span>
            <span class="nome" title="${escapeHtml(nomeCliente)}">${escapeHtml(nomeCliente)}</span>
          </div>
        </td>
        <td class="num tariffa">${formattaEuro(offerta.tariffaGiornaliera)}</td>
        <td class="num">${formattaGiornate(offerta.giorniPrevisti)}<span class="unita">gg</span></td>
        <td class="num erogate">
          <b>${formattaGiornate(offerta.giornateErogate)}</b><span class="unita">gg</span>
          <span class="mini-bar ${classeBarra}" role="img"
                aria-label="Erogato ${Math.round(percentuale)}% del previsto"><i style="width:${percentuale}%"></i></span>
        </td>
        <td class="num residuo ${critica ? 'critico' : ''}">
          <b class="valore">${residuoTesto}<span class="unita">gg</span></b>
          ${flagResiduo}
        </td>
        <td>
          <div class="stato-cell ${offerta.attiva ? '' : 'is-off'}">
            <label class="switch" title="${offerta.attiva ? 'Disattiva offerta' : 'Attiva offerta'}">
              <input type="checkbox" data-azione="toggle" ${offerta.attiva ? 'checked' : ''}
                     aria-label="Stato attiva/disattiva per ${escapeHtml(offerta.codice)}">
              <span class="track"><i></i></span>
            </label>
            <span class="stato-testo">${offerta.attiva ? 'Attiva' : 'Non attiva'}</span>
          </div>
        </td>
        <td class="azioni">
          <div class="row-actions">
            <a class="act-btn" href="offerta-form.html?id=${offerta.id}" title="Modifica offerta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Modifica
            </a>
            <button class="act-btn danger" type="button" data-azione="elimina" title="Elimina offerta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>
              Elimina
            </button>
          </div>
        </td>
      </tr>`;
  }

  /* ---------- Rendering tabella + toolbar ---------- */
  let campoRicercaCorrente = '';
  function disegnaTabellaOfferte() {
    const corpo = document.getElementById('corpoOfferte');
    const conteggio = document.getElementById('conteggioOfferte');
    const pillCritiche = document.getElementById('pillCritiche');
    const numCritiche = document.getElementById('numCritiche');

    const filtro = campoRicercaCorrente.trim().toLowerCase();
    const filtrate = OFFERTE.filter((o) => {
      const nome = (trovaCliente(o.clienteId)?.ragioneSociale || '').toLowerCase();
      return !filtro || nome.includes(filtro) ||
        o.codice.toLowerCase().includes(filtro) ||
        o.descrizione.toLowerCase().includes(filtro);
    });

    const ordinate = [...filtrate].sort((a, b) => {
      if (a.attiva !== b.attiva) return a.attiva ? -1 : 1;
      const critA = a.attiva && eCritica(a) ? 0 : 1;
      const critB = b.attiva && eCritica(b) ? 0 : 1;
      if (critA !== critB) return critA - critB;
      const nomeA = trovaCliente(a.clienteId)?.ragioneSociale || '';
      const nomeB = trovaCliente(b.clienteId)?.ragioneSociale || '';
      return nomeA.localeCompare(nomeB) || a.codice.localeCompare(b.codice);
    });

    corpo.innerHTML = ordinate.length
      ? ordinate.map(rigaOfferta).join('')
      : `<tr><td colspan="8" class="nessun-risultato">Nessuna offerta corrisponde alla ricerca.</td></tr>`;

    const attive = filtrate.filter((o) => o.attiva).length;
    const nonAttive = filtrate.length - attive;
    conteggio.textContent =
      `${filtrate.length} offert${filtrate.length === 1 ? 'a' : 'e'} · ${attive} attive · ${nonAttive} non attive`;

    const critiche = filtrate.filter((o) => o.attiva && eCritica(o)).length;
    if (pillCritiche) { pillCritiche.hidden = critiche === 0; numCritiche.textContent = critiche; }
  }

  /* ============================================================
     Interazioni dell'elenco: ricerca, toggle stato, elimina
     ============================================================ */
  function inizializzaElenco() {
    inizializzaBanner();
    disegnaTabellaOfferte();

    const campoRicerca = document.getElementById('campoRicerca');
    campoRicerca?.addEventListener('input', () => {
      campoRicercaCorrente = campoRicerca.value;
      disegnaTabellaOfferte();
    });

    const corpo = document.getElementById('corpoOfferte');

    // toggle attiva/disattiva — cambiamento immediatamente visibile
    corpo.addEventListener('change', (evento) => {
      const input = evento.target.closest('[data-azione="toggle"]');
      if (!input) return;
      const id = input.closest('tr')?.dataset.id;
      const offerta = trovaOfferta(id);
      if (!offerta) return;
      offerta.attiva = input.checked;
      disegnaTabellaOfferte();
      mostraBannerEsito(offerta.attiva ? 'attivata' : 'disattivata', offerta.codice);
    });

    // elimina — apre la modale nella variante corretta
    corpo.addEventListener('click', (evento) => {
      const bottone = evento.target.closest('[data-azione="elimina"]');
      if (!bottone) return;
      const id = bottone.closest('tr')?.dataset.id;
      apriModaleElimina(trovaOfferta(id));
    });

    inizializzaModale();
  }

  /* ============================================================
     Modale di eliminazione — due varianti (conferma / bloccata)
     ============================================================ */
  let offertaInEliminazione = null;

  function apriModaleElimina(offerta) {
    if (!offerta) return;
    offertaInEliminazione = offerta;
    const backdrop = document.getElementById('modaleElimina');
    const modal = backdrop.querySelector('.modal');
    const cliente = trovaCliente(offerta.clienteId);
    const bloccata = offerta.attivitaCollegate > 0;

    // riquadro con l'offerta oggetto dell'azione (comune a entrambe le varianti)
    backdrop.querySelector('#mtAvatar').textContent = iniziali(cliente?.ragioneSociale || '—');
    backdrop.querySelector('#mtCodice').textContent = offerta.codice;
    backdrop.querySelector('#mtDescr').textContent = `${cliente?.ragioneSociale || '—'} · ${offerta.descrizione}`;

    modal.classList.toggle('is-blocked', bloccata);
    backdrop.querySelector('#modaleConferma').hidden = bloccata;
    backdrop.querySelector('#modaleBloccata').hidden = !bloccata;

    if (bloccata) {
      const n = offerta.attivitaCollegate;
      backdrop.querySelector('#numAttivita').textContent =
        `${n} rig${n === 1 ? 'a' : 'he'} di attività collegat${n === 1 ? 'a' : 'e'}`;
      // se già non attiva, l'azione rapida "Disattiva" non ha senso: la nascondo
      backdrop.querySelector('#bottoneDisattiva').hidden = !offerta.attiva;
      backdrop.querySelector('#giaDisattivata').hidden = offerta.attiva;
    }

    backdrop.classList.add('open');
    (bloccata
      ? backdrop.querySelector('#bottoneChiudiBloccata')
      : backdrop.querySelector('#bottoneAnnullaElimina'))?.focus();
  }

  function chiudiModale() {
    document.getElementById('modaleElimina').classList.remove('open');
    offertaInEliminazione = null;
  }

  function eliminaOffertaCorrente() {
    if (!offertaInEliminazione) return;
    const indice = OFFERTE.findIndex((o) => o.id === offertaInEliminazione.id);
    const codice = offertaInEliminazione.codice;
    if (indice >= 0) OFFERTE.splice(indice, 1);
    chiudiModale();
    disegnaTabellaOfferte();
    mostraBannerEsito('eliminata', codice);
  }

  function disattivaDaModale() {
    if (!offertaInEliminazione) return;
    offertaInEliminazione.attiva = false;
    const codice = offertaInEliminazione.codice;
    chiudiModale();
    disegnaTabellaOfferte();
    mostraBannerEsito('disattivata', codice);
  }

  function inizializzaModale() {
    const backdrop = document.getElementById('modaleElimina');
    if (!backdrop) return;
    backdrop.querySelector('#bottoneAnnullaElimina')?.addEventListener('click', chiudiModale);
    backdrop.querySelector('#bottoneChiudiBloccata')?.addEventListener('click', chiudiModale);
    backdrop.querySelector('#bottoneConfermaElimina')?.addEventListener('click', eliminaOffertaCorrente);
    backdrop.querySelector('#bottoneDisattiva')?.addEventListener('click', disattivaDaModale);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) chiudiModale(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) chiudiModale();
    });
  }

  return {
    initTheme, iniziali, formattaEuro, formattaGiornate, interpretaImporto, escapeHtml,
    clienti: CLIENTI, offerte: OFFERTE,
    trovaCliente, clientiAttivi, trovaOfferta, offerteDelCliente,
    inizializzaElenco, disegnaTabellaOfferte
  };
})();
