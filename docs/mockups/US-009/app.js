/* ============================================================
   Coaching Planner — US-009 · utilità condivise del prototipo
   (tema chiaro/scuro, dataset collaboratori demo persistito in
   localStorage, formattazione € italiana, toast e iniziali)
   ============================================================ */

const CP = {

  CHIAVE_COLLABORATORI: 'cp-us009-collaboratori',

  /** Dataset demo iniziale: P.IVA di 11 cifre, un collaboratore disattivato. */
  semeCollaboratori: [
    {
      id: 'col-001',
      nome: 'Giulia',
      cognome: 'Mantovani',
      email: 'giulia.mantovani@gmail.com',
      partitaIva: '03481920457',
      tariffaGiornaliera: 520,
      attivo: true
    },
    {
      id: 'col-002',
      nome: 'Marco',
      cognome: 'Bellandi',
      email: 'marco.bellandi.coach@gmail.com',
      partitaIva: '02764530989',
      tariffaGiornaliera: 650,
      attivo: true
    },
    {
      id: 'col-003',
      nome: 'Elena',
      cognome: 'Castellani',
      email: 'elena.castellani@gmail.com',
      partitaIva: '01958274603',
      tariffaGiornaliera: 487.5,
      attivo: true
    },
    {
      id: 'col-004',
      nome: 'Davide',
      cognome: 'Ricciardi',
      email: 'davide.ricciardi.dr@gmail.com',
      partitaIva: '04612385071',
      tariffaGiornaliera: 550,
      attivo: false
    }
  ],

  /** Carica i collaboratori dal localStorage; al primo accesso usa il seme demo. */
  caricaCollaboratori() {
    try {
      const grezzo = localStorage.getItem(this.CHIAVE_COLLABORATORI);
      if (grezzo) {
        const lista = JSON.parse(grezzo);
        if (Array.isArray(lista) && lista.length) return lista;
      }
    } catch (errore) { /* dati corrotti → riparti dal seme */ }
    const copia = JSON.parse(JSON.stringify(this.semeCollaboratori));
    this.salvaCollaboratori(copia);
    return copia;
  },

  /** Persiste l'elenco collaboratori del prototipo. */
  salvaCollaboratori(listaCollaboratori) {
    localStorage.setItem(this.CHIAVE_COLLABORATORI, JSON.stringify(listaCollaboratori));
  },

  /** Trova un collaboratore per id (o undefined). */
  trovaCollaboratore(idCollaboratore) {
    return this.caricaCollaboratori().find((collaboratore) => collaboratore.id === idCollaboratore);
  },

  /** Genera un nuovo id progressivo per il prototipo. */
  nuovoIdCollaboratore() {
    const numeri = this.caricaCollaboratori()
      .map((collaboratore) => parseInt(String(collaboratore.id).replace('col-', ''), 10))
      .filter((numero) => !Number.isNaN(numero));
    const prossimo = (numeri.length ? Math.max(...numeri) : 0) + 1;
    return 'col-' + String(prossimo).padStart(3, '0');
  },

  /** Nome completo «Nome Cognome» del collaboratore. */
  nomeCompleto(collaboratore) {
    return [collaboratore.nome, collaboratore.cognome].filter(Boolean).join(' ');
  },

  /** Iniziali di una persona (prima lettera di nome e cognome). */
  inizialiPersona(nome, cognome) {
    return [(nome || '').trim()[0], (cognome || '').trim()[0]]
      .filter(Boolean).join('').toUpperCase() || '–';
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
