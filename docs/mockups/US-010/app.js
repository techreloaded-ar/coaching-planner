/* ============================================================
   Coaching Planner — US-010 · utilità condivise del prototipo
   (tema chiaro/scuro, dataset scaglioni km demo persistito in
   localStorage, formattazione € italiana, toast, calcolo fasce)
   ============================================================ */

const CP = {

  CHIAVE_SCAGLIONI: 'cp-us010-scaglioni',

  /** Dataset demo iniziale: soglie strettamente crescenti, importi forfettari. */
  semeScaglioni: [
    { id: 'scg-001', finoAKm: 50,  importo: 15 },
    { id: 'scg-002', finoAKm: 100, importo: 28 },
    { id: 'scg-003', finoAKm: 200, importo: 50 },
    { id: 'scg-004', finoAKm: 400, importo: 90 }
  ],

  /** Carica gli scaglioni dal localStorage; al primo accesso usa il seme demo. */
  caricaScaglioni() {
    try {
      const grezzo = localStorage.getItem(this.CHIAVE_SCAGLIONI);
      if (grezzo) {
        const lista = JSON.parse(grezzo);
        if (Array.isArray(lista)) return this.ordina(lista);
      }
    } catch (errore) { /* dati corrotti → riparti dal seme */ }
    const copia = JSON.parse(JSON.stringify(this.semeScaglioni));
    this.salvaScaglioni(copia);
    return this.ordina(copia);
  },

  /** Persiste l'elenco scaglioni del prototipo. */
  salvaScaglioni(listaScaglioni) {
    localStorage.setItem(this.CHIAVE_SCAGLIONI, JSON.stringify(listaScaglioni));
  },

  /** Ordina gli scaglioni per soglia massima crescente. */
  ordina(lista) {
    return [...lista].sort((a, b) => a.finoAKm - b.finoAKm);
  },

  /** Trova uno scaglione per id (o undefined). */
  trovaScaglione(idScaglione) {
    return this.caricaScaglioni().find((scaglione) => scaglione.id === idScaglione);
  },

  /** Genera un nuovo id progressivo per il prototipo. */
  nuovoIdScaglione() {
    const numeri = this.caricaScaglioni()
      .map((scaglione) => parseInt(String(scaglione.id).replace('scg-', ''), 10))
      .filter((numero) => !Number.isNaN(numero));
    const prossimo = (numeri.length ? Math.max(...numeri) : 0) + 1;
    return 'scg-' + String(prossimo).padStart(3, '0');
  },

  /**
   * Soglia minima di una fascia: la soglia dello scaglione precedente + 1.
   * Per il primo scaglione la fascia parte da 0 km.
   */
  sogliaMinima(idScaglione, finoAKm) {
    const precedenti = this.caricaScaglioni()
      .filter((scaglione) => scaglione.id !== idScaglione && scaglione.finoAKm < finoAKm)
      .map((scaglione) => scaglione.finoAKm);
    return precedenti.length ? Math.max(...precedenti) + 1 : 0;
  },

  /** Etichetta leggibile della fascia: «Da A a B km» / «Fino a B km». */
  etichettaFascia(da, a) {
    return da > 0 ? `Da ${da} a ${a} km` : `Fino a ${a} km`;
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
