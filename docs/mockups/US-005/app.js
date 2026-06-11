/* ============================================================
   Coaching Planner — US-005 · utilità condivise del prototipo
   (gestione tema chiaro/scuro + helper per gli alert)
   ============================================================ */

const CP = {

  /** Applica il tema salvato (o la preferenza di sistema) e collega il toggle. */
  initTheme() {
    const radice = document.documentElement;
    const temaSalvato = localStorage.getItem('cp-mockup-tema');
    const preferisceScuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const temaIniziale = temaSalvato || (preferisceScuro ? 'dark' : 'light');

    applica(temaIniziale);

    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const nuovoTema = radice.dataset.theme === 'dark' ? 'light' : 'dark';
        applica(nuovoTema);
        localStorage.setItem('cp-mockup-tema', nuovoTema);
      });
    }

    function applica(tema) {
      if (tema === 'dark') {
        radice.dataset.theme = 'dark';
      } else {
        delete radice.dataset.theme;
      }
    }
  },

  /** Mostra un elemento (alert) con una piccola animazione di comparsa. */
  show(selettore) {
    const elemento = document.querySelector(selettore);
    if (!elemento) return;
    elemento.hidden = false;
    elemento.classList.remove('pop');
    // forza il restart dell'animazione
    void elemento.offsetWidth;
    elemento.classList.add('pop');
  },

  /** Nasconde un elemento (alert). */
  hide(selettore) {
    const elemento = document.querySelector(selettore);
    if (elemento) elemento.hidden = true;
  }
};
