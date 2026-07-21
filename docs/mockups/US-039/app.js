/* ============================================================
   Coaching Planner — US-039
   Elenco e censimento degli utenti nella console di
   amministrazione.

   - initElenco: rende la tabella utenti con avatar-anello per
     ruolo, badge ruolo/stato, annotazione "profilo collaboratore
     disattivato", ricerca live per nome/email.
   - initNuovo / initModifica: comportamento leggero dei form,
     incluso l'errore inline di email duplicata (AC-4).

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

  // ---------- Utilità ----------
  const iniziali = (testo) =>
    testo.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- Icone inline ----------
  const IC_SCUDO   = '<path d="M12 3l7 2.5v5.2c0 4.3-2.9 7.4-7 8.8-4.1-1.4-7-4.5-7-8.8V5.5L12 3Z"/>';
  const IC_UTENTE  = '<circle cx="12" cy="8.5" r="3.3"/><path d="M6 19a6 6 0 0 1 12 0"/>';
  const IC_BUSTA   = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>';
  const IC_MATITA  = '<path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z"/>';

  // ---------- Utenti dimostrativi ----------
  // "collaboratoreDisattivato": ha un profilo collaboratore ma è
  // stato disattivato nell'anagrafica collaboratori (nota attenuata).
  const UTENTI = [
    { nome: "Stefano Marello", email: "stefano.marello@coachingpartners.it", ruolo: "AMMINISTRATORE", stato: "ATTIVO" },
    { nome: "Giulia Conti",    email: "giulia.conti@coachingpartners.it",    ruolo: "COLLABORATORE",  stato: "ATTIVO" },
    { nome: "Marco Ferretti",  email: "marco.ferretti@coachingpartners.it",  ruolo: "COLLABORATORE",  stato: "ATTIVO", collaboratoreDisattivato: true },
    { nome: "Elena Ruffini",   email: "elena.ruffini@coachingpartners.it",   ruolo: "AMMINISTRATORE", stato: "ATTIVO" },
    { nome: "Davide Sartori",  email: "davide.sartori@coachingpartners.it",  ruolo: "COLLABORATORE",  stato: "INVALIDATO" },
    { nome: "Chiara Vitali",   email: "chiara.vitali@coachingpartners.it",   ruolo: "COLLABORATORE",  stato: "ATTIVO" },
  ];

  // ---------- Badge ----------
  function badgeRuolo(ruolo){
    if (ruolo === "AMMINISTRATORE"){
      return `<span class="badge-ruolo amministratore"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_SCUDO}</svg>Amministratore</span>`;
    }
    return `<span class="badge-ruolo collaboratore"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_UTENTE}</svg>Collaboratore</span>`;
  }

  function badgeStato(stato){
    if (stato === "ATTIVO"){
      return '<span class="badge-stato attivo"><span class="d"></span>Attivo</span>';
    }
    return '<span class="badge-stato invalidato"><span class="d"></span>Invalidato</span>';
  }

  // ---------- Riga utente ----------
  function rigaUtente(u){
    const invalido = u.stato !== "ATTIVO";
    const classeAvatar = invalido ? "spento" : (u.ruolo === "AMMINISTRATORE" ? "amministratore" : "collaboratore");
    const icoRuolo = u.ruolo === "AMMINISTRATORE" ? IC_SCUDO : IC_UTENTE;

    const annota = u.collaboratoreDisattivato
      ? `<span class="u-annota" title="Il profilo collaboratore è disattivato nell'anagrafica Collaboratori">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
           Profilo collaboratore disattivato
         </span>`
      : "";

    return `
      <tr class="${invalido ? "invalidato" : ""}" data-cerca="${esc((u.nome + " " + u.email).toLowerCase())}">
        <td>
          <div class="cella-utente">
            <span class="u-avatar ${classeAvatar}">
              ${esc(iniziali(u.nome))}
              <span class="ruolo-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${icoRuolo}</svg></span>
            </span>
            <span class="u-testi">
              <span class="u-nome">${esc(u.nome)}</span>
              ${annota}
            </span>
          </div>
        </td>
        <td class="cella-email-td">
          <span class="cella-email" title="${esc(u.email)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_BUSTA}</svg>
            <span>${esc(u.email)}</span>
          </span>
        </td>
        <td class="cella-ruolo">${badgeRuolo(u.ruolo)}</td>
        <td>${badgeStato(u.stato)}</td>
        <td class="riga-azioni">
          <a class="azione-link" href="modifica-utente.html">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${IC_MATITA}</svg>
            Modifica
          </a>
        </td>
      </tr>`;
  }

  function renderConteggio(totale, amm){
    const el = document.getElementById("conteggio");
    if (!el) return;
    el.innerHTML =
      `<span><b>${totale}</b> utenti</span><span class="pt"></span>` +
      `<span><b>${amm}</b> amministratori</span><span class="pt"></span>` +
      `<span><b>${totale - amm}</b> collaboratori</span>`;
  }

  function initElenco(){
    const corpo = document.getElementById("corpo-tabella");
    if (!corpo) return;
    corpo.innerHTML = UTENTI.map(rigaUtente).join("");
    renderConteggio(UTENTI.length, UTENTI.filter((u) => u.ruolo === "AMMINISTRATORE").length);

    // Ricerca live per nome/email
    const cerca = document.getElementById("cerca");
    if (cerca){
      cerca.addEventListener("input", () => {
        const q = cerca.value.trim().toLowerCase();
        let visibili = 0;
        corpo.querySelectorAll("tr[data-cerca]").forEach((tr) => {
          const match = !q || tr.getAttribute("data-cerca").includes(q);
          tr.style.display = match ? "" : "none";
          if (match) visibili++;
        });
        let vuota = corpo.querySelector(".riga-vuota");
        if (visibili === 0){
          if (!vuota){
            vuota = document.createElement("tr");
            vuota.className = "riga-vuota";
            vuota.innerHTML = '<td colspan="5">Nessun utente corrisponde alla ricerca.</td>';
            corpo.appendChild(vuota);
          }
        } else if (vuota){
          vuota.remove();
        }
      });
    }
  }

  // ---------- Form: censimento nuovo utente ----------
  // Dimostra l'errore inline di email duplicata (AC-4) con un
  // toggle nella barra demo; l'invio "riuscito" resta simulato.
  function initNuovo(){
    const form = document.getElementById("form-utente");
    if (!form) return;

    const toggleErrore = document.getElementById("toggle-errore");
    if (toggleErrore){
      toggleErrore.addEventListener("click", () => {
        form.classList.toggle("mostra-errore-email");
        const on = form.classList.contains("mostra-errore-email");
        toggleErrore.setAttribute("aria-pressed", on ? "true" : "false");
        toggleErrore.textContent = on ? "Nascondi errore email duplicata" : "Mostra errore email duplicata";
      });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Mockup: nessuna persistenza. In app reale qui si torna
      // all'elenco con il nuovo utente in stato attivo.
      window.location.href = "index.html";
    });
  }

  function initModifica(){
    const form = document.getElementById("form-utente");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      window.location.href = "index.html";
    });
  }

  return { initTheme, initElenco, initNuovo, initModifica };
})();
