/* ============================================================
   Coaching Planner — US-027 Pagina radice di accesso
   Script del mockup: tema chiaro/scuro + simulazione del
   reindirizzamento a Google. Nessuna dipendenza esterna.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Tema chiaro/scuro ----------
     Parte dalla preferenza di sistema (prefers-color-scheme),
     poi ricorda la scelta esplicita per la sessione del mockup. */
  var radice = document.documentElement;
  var CHIAVE_TEMA = "cp-mockup-tema";

  function applicaTema(tema) {
    if (tema === "dark") {
      radice.setAttribute("data-theme", "dark");
    } else {
      radice.removeAttribute("data-theme");
    }
  }

  var temaSalvato = null;
  try { temaSalvato = sessionStorage.getItem(CHIAVE_TEMA); } catch (e) {}
  if (temaSalvato) {
    applicaTema(temaSalvato);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applicaTema("dark");
  }

  var bottoneTema = document.getElementById("themeToggle");
  if (bottoneTema) {
    bottoneTema.addEventListener("click", function () {
      var temaAttuale = radice.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var temaNuovo = temaAttuale === "dark" ? "light" : "dark";
      applicaTema(temaNuovo);
      try { sessionStorage.setItem(CHIAVE_TEMA, temaNuovo); } catch (e) {}
    });
  }

  /* ---------- Pulsante "Accedi con Google" ----------
     Nel prodotto reale avvia il flusso OAuth (/api/auth/google).
     Qui simula lo stato di reindirizzamento e poi si ripristina. */
  var bottoneGoogle = document.getElementById("googleBtn");
  if (bottoneGoogle) {
    var contenutoOriginale = bottoneGoogle.innerHTML;
    bottoneGoogle.addEventListener("click", function () {
      if (bottoneGoogle.disabled) return;
      bottoneGoogle.disabled = true;
      bottoneGoogle.innerHTML =
        '<span class="spinner" aria-hidden="true"></span>' +
        '<span class="lbl">Reindirizzamento a Google…</span>';
      window.setTimeout(function () {
        bottoneGoogle.disabled = false;
        bottoneGoogle.innerHTML = contenutoOriginale;
      }, 2200);
    });
  }
})();
