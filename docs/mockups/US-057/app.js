/* ============================================================
   Coaching Planner — US-057 · comportamento del prototipo
   Nessuna dipendenza, nessun framework: solo ciò che serve a
   rendere provabile il flusso di duplicazione.
   ============================================================ */

const CP = (() => {
  const MESI = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
  ];
  const MESI_BREVI = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic",
  ];
  const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

  /** Giorno di origine da cui parte la duplicazione. */
  const GIORNO_ORIGINE = "2026-03-11";

  function parti(data) {
    const [a, m, g] = data.split("-").map(Number);
    return { anno: a, mese: m, giorno: g, date: new Date(a, m - 1, g) };
  }

  function meseEsteso(data) {
    const p = parti(data);
    return `${MESI[p.mese - 1]} ${p.anno}`;
  }

  function dataEstesa(data) {
    const p = parti(data);
    return `${p.giorno} ${MESI[p.mese - 1]} ${p.anno}`;
  }

  // ── Tema chiaro/scuro ───────────────────────────────────────
  function initTheme() {
    const salvato = localStorage.getItem("cp-us057-theme");
    if (salvato) document.documentElement.setAttribute("data-theme", salvato);

    const bottone = document.getElementById("themeToggle");
    if (!bottone) return;

    bottone.addEventListener("click", () => {
      const scuro = document.documentElement.getAttribute("data-theme") === "dark";
      const prossimo = scuro ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", prossimo);
      localStorage.setItem("cp-us057-theme", prossimo);
    });
  }

  // ── Selettore di duplicazione ───────────────────────────────
  function initSelettore(opzioni = {}) {
    const dateIniziali = opzioni.dateIniziali ?? [];
    const erroreOfferta = opzioni.erroreOfferta ?? false;
    const apertoSubito = opzioni.aperto ?? false;

    const overlay = document.getElementById("overlayDuplica");
    const pista = document.getElementById("pista");
    const conta = document.getElementById("conta");
    const campoData = document.getElementById("campoData");
    const btnAggiungi = document.getElementById("btnAggiungi");
    const btnConferma = document.getElementById("btnConferma");
    const avviso = document.getElementById("avvisoInline");
    const erroreBox = document.getElementById("erroreDialog");
    const esitoHost = document.getElementById("esitoHost");

    if (!overlay) return;

    let scelte = [...dateIniziali];

    function mostraAvviso(testo) {
      if (!avviso) return;
      avviso.querySelector("span").textContent = testo;
      avviso.style.display = "flex";
      clearTimeout(mostraAvviso.timer);
      mostraAvviso.timer = setTimeout(() => {
        avviso.style.display = "none";
      }, 4000);
    }

    function raggruppaPerMese(date) {
      const gruppi = new Map();
      for (const data of [...date].sort()) {
        const chiave = data.slice(0, 7);
        if (!gruppi.has(chiave)) gruppi.set(chiave, []);
        gruppi.get(chiave).push(data);
      }
      return [...gruppi.entries()];
    }

    function disegna() {
      if (conta) {
        conta.textContent =
          scelte.length === 1 ? "1 giorno" : `${scelte.length} giorni`;
        conta.style.visibility = scelte.length ? "visible" : "hidden";
      }

      if (btnConferma) {
        btnConferma.disabled = scelte.length === 0;
        btnConferma.querySelector(".etichetta").textContent =
          scelte.length === 0
            ? "Duplica"
            : scelte.length === 1
              ? "Duplica su 1 giorno"
              : `Duplica su ${scelte.length} giorni`;
      }

      if (!pista) return;

      if (scelte.length === 0) {
        pista.innerHTML = `
          <div class="pista-vuota">
            <svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>
            Nessun giorno scelto.<br>Aggiungi almeno una data per abilitare la duplicazione.
          </div>`;
        return;
      }

      const gruppi = raggruppaPerMese(scelte);
      pista.innerHTML = `<div class="gruppi">${gruppi
        .map(([chiaveMese, giorni], indice) => {
          const p = parti(`${chiaveMese}-01`);
          const tessere = giorni
            .map((data) => {
              const d = parti(data);
              return `
                <div class="tessera">
                  <div class="cima">${MESI_BREVI[d.mese - 1]}</div>
                  <div class="num">${d.giorno}</div>
                  <div class="dow">${GIORNI[d.date.getDay()]}</div>
                  <button class="rimuovi" type="button" data-data="${data}"
                          aria-label="Togli il ${dataEstesa(data)} dalle destinazioni">
                    <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
                  </button>
                </div>`;
            })
            .join("");

          const divisore = indice > 0 ? '<div class="divisore-mese"></div>' : "";
          return `${divisore}
            <div class="gruppo-mese">
              <span class="mese-lbl">${MESI[p.mese - 1]} ${p.anno}</span>
              <div class="tessere">${tessere}</div>
            </div>`;
        })
        .join("")}</div>`;

      pista.querySelectorAll(".rimuovi").forEach((bottone) => {
        bottone.addEventListener("click", () => {
          scelte = scelte.filter((d) => d !== bottone.dataset.data);
          disegna();
        });
      });
    }

    function aggiungi() {
      const scelta = campoData?.value;

      if (!scelta) {
        mostraAvviso("Scegli prima una data dal calendario.");
        return;
      }
      if (scelta === GIORNO_ORIGINE) {
        mostraAvviso(
          `Il ${dataEstesa(GIORNO_ORIGINE)} è il giorno di origine: non è una destinazione selezionabile.`,
        );
        return;
      }
      if (scelte.includes(scelta)) {
        mostraAvviso(`Il ${dataEstesa(scelta)} è già fra i giorni scelti.`);
        return;
      }

      scelte.push(scelta);
      if (campoData) campoData.value = "";
      if (avviso) avviso.style.display = "none";
      disegna();
    }

    function apri() {
      overlay.classList.add("aperto");
      if (erroreBox) erroreBox.style.display = erroreOfferta ? "flex" : "none";
      setTimeout(() => campoData?.focus(), 60);
    }

    function chiudi() {
      overlay.classList.remove("aperto");
    }

    function conferma() {
      if (scelte.length === 0) return;

      if (erroreOfferta) {
        if (erroreBox) erroreBox.style.display = "flex";
        return;
      }

      const giorni = [...scelte].sort();
      chiudi();

      if (!esitoHost) return;
      esitoHost.innerHTML = `
        <div class="esito" role="status">
          <svg class="ic" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
          <div class="testo">
            Riga replicata su ${giorni.length} ${giorni.length === 1 ? "giorno" : "giorni"}.
            <div class="dettaglio">${giorni.map(dataEstesa).join(" · ")}</div>
          </div>
          <button class="chiudi" type="button" aria-label="Chiudi l'esito">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>`;
      esitoHost
        .querySelector(".chiudi")
        .addEventListener("click", () => (esitoHost.innerHTML = ""));
    }

    document.querySelectorAll("[data-apri-duplica]").forEach((bottone) => {
      bottone.addEventListener("click", apri);
    });
    document
      .querySelectorAll("[data-chiudi-duplica]")
      .forEach((bottone) => bottone.addEventListener("click", chiudi));
    overlay.addEventListener("click", (evento) => {
      if (evento.target === overlay) chiudi();
    });
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") chiudi();
    });
    btnAggiungi?.addEventListener("click", aggiungi);
    campoData?.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") {
        evento.preventDefault();
        aggiungi();
      }
    });
    btnConferma?.addEventListener("click", conferma);

    disegna();
    if (apertoSubito) apri();
  }

  return { initTheme, initSelettore, GIORNO_ORIGINE, dataEstesa, meseEsteso };
})();
