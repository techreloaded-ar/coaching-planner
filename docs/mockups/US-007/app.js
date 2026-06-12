/* ============================================================
   Coaching Planner — US-007 · utilità condivise del prototipo
   (tema chiaro/scuro, dataset clienti demo persistito in
   localStorage, helper per toast e iniziali)
   ============================================================ */

const CP = {

  CHIAVE_CLIENTI: 'cp-us007-clienti',

  /** Dataset demo iniziale: 11 cifre di P.IVA, un cliente disattivato. */
  semeClienti: [
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
    },
    {
      id: 'cli-004',
      ragioneSociale: 'Studio Ferrante & Partners',
      partitaIva: '02456780542',
      codiceFiscale: 'FRRGPP74D12G478S',
      indirizzo: 'Via dei Priori 18',
      citta: 'Perugia',
      cap: '06123',
      provincia: 'PG',
      pec: 'studioferrante@pec.it',
      codiceSdi: '0000000',
      attivo: true
    },
    {
      id: 'cli-005',
      ragioneSociale: 'Cantieri Riuniti S.p.A.',
      partitaIva: '00541230101',
      codiceFiscale: '00541230101',
      indirizzo: 'Calata Gadda 1',
      citta: 'Genova',
      cap: '16128',
      provincia: 'GE',
      pec: 'cantieririuniti@legalmail.it',
      codiceSdi: 'SUBM70N',
      attivo: false
    }
  ],

  /** Carica i clienti dal localStorage; al primo accesso usa il seme demo. */
  caricaClienti() {
    try {
      const grezzo = localStorage.getItem(this.CHIAVE_CLIENTI);
      if (grezzo) {
        const lista = JSON.parse(grezzo);
        if (Array.isArray(lista) && lista.length) return lista;
      }
    } catch (errore) { /* dati corrotti → riparti dal seme */ }
    const copia = JSON.parse(JSON.stringify(this.semeClienti));
    this.salvaClienti(copia);
    return copia;
  },

  /** Persiste l'elenco clienti del prototipo. */
  salvaClienti(listaClienti) {
    localStorage.setItem(this.CHIAVE_CLIENTI, JSON.stringify(listaClienti));
  },

  /** Trova un cliente per id (o undefined). */
  trovaCliente(idCliente) {
    return this.caricaClienti().find((cliente) => cliente.id === idCliente);
  },

  /** Genera un nuovo id progressivo per il prototipo. */
  nuovoIdCliente() {
    const numeri = this.caricaClienti()
      .map((cliente) => parseInt(String(cliente.id).replace('cli-', ''), 10))
      .filter((numero) => !Number.isNaN(numero));
    const prossimo = (numeri.length ? Math.max(...numeri) : 0) + 1;
    return 'cli-' + String(prossimo).padStart(3, '0');
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
