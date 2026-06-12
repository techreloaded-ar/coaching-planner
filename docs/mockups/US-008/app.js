/* ============================================================
   Coaching Planner — US-008 · utilità condivise del prototipo
   (tema chiaro/scuro, clienti demo in sola lettura, offerte
   demo persistite in localStorage, formattazione € italiana)
   ============================================================ */

const CP = {

  CHIAVE_OFFERTE: 'cp-us008-offerte',

  /** Clienti demo (anagrafica US-007, qui in sola lettura). */
  clienti: [
    {
      id: 'cli-001',
      ragioneSociale: 'Banca Sintesi S.p.A.',
      partitaIva: '04127730961',
      codiceFiscale: '04127730961',
      indirizzo: 'Via Monte di Pietà 12',
      citta: 'Milano',
      cap: '20121',
      provincia: 'MI',
      pec: 'amministrazione@pec.bancasintesi.it',
      codiceSdi: 'M5UXCR1',
      attivo: true
    },
    {
      id: 'cli-002',
      ragioneSociale: 'Logistica Adria S.r.l.',
      partitaIva: '01893450327',
      codiceFiscale: '01893450327',
      indirizzo: 'Riva Grumula 4',
      citta: 'Trieste',
      cap: '34123',
      provincia: 'TS',
      pec: 'fatture@pec.logisticaadria.it',
      codiceSdi: '',
      attivo: true
    },
    {
      id: 'cli-003',
      ragioneSociale: 'Innovatech S.r.l.',
      partitaIva: '09773410015',
      codiceFiscale: '09773410015',
      indirizzo: 'Corso Castelfidardo 30/A',
      citta: 'Torino',
      cap: '10129',
      provincia: 'TO',
      pec: '',
      codiceSdi: 'KRRH6B9',
      attivo: true
    }
  ],

  /** Offerte demo iniziali, agganciate ai clienti qui sopra. */
  semeOfferte: [
    {
      id: 'off-001',
      clienteId: 'cli-001',
      codice: 'OFF-2026-001',
      descrizione: 'Programma di coaching executive — comitato di direzione',
      tariffaGiornaliera: 1150,
      giorniPrevisti: 18
    },
    {
      id: 'off-002',
      clienteId: 'cli-001',
      codice: 'OFF-2026-007',
      descrizione: 'Percorso leadership per quadri — sportelli individuali',
      tariffaGiornaliera: 870.5,
      giorniPrevisti: 12
    },
    {
      id: 'off-003',
      clienteId: 'cli-001',
      codice: 'OFF-2025-031',
      descrizione: 'Team coaching filiali area Nord-Ovest',
      tariffaGiornaliera: 690,
      giorniPrevisti: 8
    },
    {
      id: 'off-004',
      clienteId: 'cli-002',
      codice: 'OFF-2026-004',
      descrizione: 'Coaching operativo responsabili di magazzino',
      tariffaGiornaliera: 720,
      giorniPrevisti: 10
    }
  ],

  /** Trova un cliente per id (o undefined). */
  trovaCliente(idCliente) {
    return this.clienti.find((cliente) => cliente.id === idCliente);
  },

  /** Carica le offerte dal localStorage; al primo accesso usa il seme demo. */
  caricaOfferte() {
    try {
      const grezzo = localStorage.getItem(this.CHIAVE_OFFERTE);
      if (grezzo) {
        const lista = JSON.parse(grezzo);
        if (Array.isArray(lista) && lista.length) return lista;
      }
    } catch (errore) { /* dati corrotti → riparti dal seme */ }
    const copia = JSON.parse(JSON.stringify(this.semeOfferte));
    this.salvaOfferte(copia);
    return copia;
  },

  /** Persiste l'elenco offerte del prototipo. */
  salvaOfferte(listaOfferte) {
    localStorage.setItem(this.CHIAVE_OFFERTE, JSON.stringify(listaOfferte));
  },

  /** Offerte di un singolo cliente, ordinate per codice. */
  offerteDelCliente(idCliente) {
    return this.caricaOfferte()
      .filter((offerta) => offerta.clienteId === idCliente)
      .sort((a, b) => a.codice.localeCompare(b.codice));
  },

  /** Trova un'offerta per id (o undefined). */
  trovaOfferta(idOfferta) {
    return this.caricaOfferte().find((offerta) => offerta.id === idOfferta);
  },

  /** Genera un nuovo id progressivo per il prototipo. */
  nuovoIdOfferta() {
    const numeri = this.caricaOfferte()
      .map((offerta) => parseInt(String(offerta.id).replace('off-', ''), 10))
      .filter((numero) => !Number.isNaN(numero));
    const prossimo = (numeri.length ? Math.max(...numeri) : 0) + 1;
    return 'off-' + String(prossimo).padStart(3, '0');
  },

  /** Formatta un importo in euro all'italiana: 1.150,00 €. */
  formattaEuro(importo) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(importo);
  },

  /**
   * Interpreta un importo digitato all'italiana (virgola decimale,
   * eventuale punto delle migliaia). Restituisce un numero o NaN.
   */
  interpretaImporto(testo) {
    const normalizzato = String(testo).trim()
      .replace(/\./g, '')
      .replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalizzato)) return NaN;
    return parseFloat(normalizzato);
  },

  /** Iniziali della ragione sociale (ignora le forme societarie). */
  iniziali(ragioneSociale) {
    const stop = new Set(['spa', 'srl', 'srls', 'snc', 'sas', 'di', 'e', '&', 'societa', 'società']);
    const parole = ragioneSociale
      .split(/\s+/)
      .map((parola) => parola.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((parola) => parola && !stop.has(parola.toLowerCase()));
    const base = parole.length ? parole : [ragioneSociale];
    return base.slice(0, 2).map((parola) => parola[0]).join('').toUpperCase() || '–';
  },

  /** Applica il tema salvato (o la preferenza di sistema) e collega il toggle. */
  initTheme() {
    const radice = document.documentElement;
    const temaSalvato = localStorage.getItem('cp-mockup-tema');
    const preferisceScuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applica(temaSalvato || (preferisceScuro ? 'dark' : 'light'));

    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const nuovoTema = radice.dataset.theme === 'dark' ? 'light' : 'dark';
        applica(nuovoTema);
        localStorage.setItem('cp-mockup-tema', nuovoTema);
      });
    }

    function applica(tema) {
      if (tema === 'dark') radice.dataset.theme = 'dark';
      else delete radice.dataset.theme;
    }
  },

  /** Mostra un toast di conferma in fondo alla pagina. */
  toast(messaggio) {
    let toast = document.getElementById('cpToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cpToast';
      toast.className = 'toast';
      toast.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
      document.body.appendChild(toast);
    }
    toast.querySelector('span').textContent = messaggio;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
};
