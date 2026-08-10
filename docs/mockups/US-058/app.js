/* ============================================================
   Coaching Planner — US-058 · comportamento del prototipo
   Nessuna dipendenza, nessun framework: solo ciò che serve a
   rendere provabile il selettore di mese sull'etichetta.

   Il mockup riproduce la soluzione decisa:
   - l'etichetta del mese è il trigger (`calendar-month-label`);
   - il pannello è un popover ancorato, non una modale;
   - la scelta di un mese chiude il pannello e cambia subito la
     griglia, senza conferma;
   - Esc e clic fuori chiudono lasciando invariato il mese;
   - il token `YYYY-MM` compare nell'URL solo a mese cambiato.
   ============================================================ */

const CP = (() => {
  const MESI = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
  ];
  const GIORNI_HEAD = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

  /** Giorno "oggi" del mockup, coerente con il mese di partenza. */
  const OGGI = { anno: 2026, mese: 8, giorno: 6 };
  const TOKEN_OGGI = "2026-08";

  const CLIENTI = [
    "Nordwind Logistica",
    "Bottega Cartaria",
    "Fonderia Vesta",
    "Atelier Rombo",
    "Marea Digitale",
  ];

  // ── Utilità sul token YYYY-MM ───────────────────────────────

  function parseToken(token) {
    const [anno, mese] = token.split("-").map(Number);
    return { anno, mese };
  }

  function componiToken(anno, mese) {
    return `${anno}-${String(mese).padStart(2, "0")}`;
  }

  function etichettaMese(token) {
    const { anno, mese } = parseToken(token);
    return `${MESI[mese - 1]} ${anno}`;
  }

  /** Indice 0=lunedì … 6=domenica. */
  function indiceLunedi(date) {
    return (date.getDay() + 6) % 7;
  }

  // ── Dati di attività, deterministici per token ──────────────
  // Servono solo a rendere credibile il cambio di mese: mesi
  // diversi devono avere griglie visibilmente diverse.

  function seme(token) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function attivitaDelMese(token) {
    const { anno, mese } = parseToken(token);
    const giorniNelMese = new Date(anno, mese, 0).getDate();
    let stato = seme(token);
    const prossimo = () => {
      stato = (Math.imul(stato, 1664525) + 1013904223) >>> 0;
      return stato / 4294967296;
    };

    const mappa = {};
    for (let giorno = 1; giorno <= giorniNelMese; giorno += 1) {
      const feriale = indiceLunedi(new Date(anno, mese - 1, giorno)) < 5;
      const soglia = feriale ? 0.52 : 0.06;
      if (prossimo() > soglia) continue;

      const righe = 1 + Math.floor(prossimo() * 3);
      const ore = Math.round((2 + prossimo() * 6) * 2) / 2;
      const quanti = Math.min(righe, 3);
      const scelti = [];
      for (let i = 0; i < quanti; i += 1) {
        const nome = CLIENTI[Math.floor(prossimo() * CLIENTI.length)];
        if (!scelti.includes(nome)) scelti.push(nome);
      }
      mappa[giorno] = {
        righe,
        ore,
        clienti: scelti.map((nome) => ({
          nome,
          ore: Math.round((ore / scelti.length) * 2) / 2,
        })),
      };
    }
    return mappa;
  }

  // ── Tema chiaro/scuro ───────────────────────────────────────

  function initTema() {
    const salvato = localStorage.getItem("cp-us058-theme");
    if (salvato) document.documentElement.setAttribute("data-theme", salvato);

    const bottone = document.getElementById("themeToggle");
    if (!bottone) return;

    bottone.addEventListener("click", () => {
      const scuro = document.documentElement.getAttribute("data-theme") === "dark";
      const prossimo = scuro ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", prossimo);
      localStorage.setItem("cp-us058-theme", prossimo);
    });
  }

  // ── Griglia del calendario ──────────────────────────────────

  function disegnaGriglia(token) {
    const contenitore = document.getElementById("griglia");
    if (!contenitore) return { righe: 0, ore: 0 };

    const { anno, mese } = parseToken(token);
    const attivita = attivitaDelMese(token);

    const primo = new Date(anno, mese - 1, 1);
    const inizio = new Date(anno, mese - 1, 1 - indiceLunedi(primo));
    const giorniNelMese = new Date(anno, mese, 0).getDate();
    const celle = Math.ceil((indiceLunedi(primo) + giorniNelMese) / 7) * 7;

    const frammento = document.createDocumentFragment();
    let totaleRighe = 0;
    let totaleOre = 0;

    for (let i = 0; i < celle; i += 1) {
      const data = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + i);
      const fuori = data.getMonth() !== mese - 1;
      const weekend = indiceLunedi(data) >= 5;
      const dati = fuori ? null : attivita[data.getDate()];
      const oggi =
        data.getFullYear() === OGGI.anno &&
        data.getMonth() === OGGI.mese - 1 &&
        data.getDate() === OGGI.giorno;

      if (dati) {
        totaleRighe += dati.righe;
        totaleOre += dati.ore;
      }

      const cella = document.createElement("a");
      cella.href = "#";
      cella.addEventListener("click", (e) => e.preventDefault());
      cella.className = [
        "cella",
        fuori ? "fuori" : "",
        !fuori && weekend && !dati ? "we" : "",
        dati ? "attiva" : "",
        oggi ? "oggi" : "",
        i >= celle - 7 ? "ultima-riga" : "",
      ].filter(Boolean).join(" ");
      cella.setAttribute("data-testid", "cella-giorno");

      let html = "";
      if (dati) html += '<span class="barretta"></span>';
      html += `<span class="num">${data.getDate()}</span>`;
      if (dati) {
        const tag = dati.clienti.slice(0, 2).map((c) =>
          `<span class="t-cliente">${c.nome} <span>${c.ore.toFixed(1)} h</span></span>`
        ).join("");
        const altri = dati.clienti.length > 2
          ? `<span class="t-altri">+${dati.clienti.length - 2}</span>`
          : "";
        html += `
          <span class="cella-piede">
            <span class="badge-riga">
              <span class="b-righe">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                ${dati.righe}
              </span>
              <span class="b-ore">${dati.ore.toFixed(1)} h</span>
            </span>
            <span class="clienti">${tag}${altri}</span>
          </span>`;
      }
      cella.innerHTML = html;
      frammento.appendChild(cella);
    }

    contenitore.replaceChildren(frammento);
    return { righe: totaleRighe, ore: totaleOre };
  }

  function disegnaIntestazioneGiorni() {
    const head = document.getElementById("dowHead");
    if (!head) return;
    head.replaceChildren(
      ...GIORNI_HEAD.map((nome, i) => {
        const el = document.createElement("div");
        el.textContent = nome;
        if (i >= 5) el.className = "we";
        return el;
      })
    );
  }

  function aggiornaTotali(totali) {
    const chip = document.getElementById("chipTotali");
    if (!chip) return;
    chip.style.display = totali.righe > 0 ? "" : "none";
    const righe = chip.querySelector("[data-righe]");
    const ore = chip.querySelector("[data-ore]");
    if (righe) righe.textContent = `${totali.righe} righe`;
    if (ore) ore.textContent = `${totali.ore.toFixed(1)} h`;
  }

  function aggiornaUrl(token, lampeggia) {
    const chip = document.getElementById("urlChip");
    if (!chip) return;
    const valore = chip.querySelector("[data-token]");
    if (valore) valore.textContent = `?mese=${token}`;
    if (!lampeggia) return;
    chip.classList.remove("lampeggia");
    void chip.offsetWidth;
    chip.classList.add("lampeggia");
  }

  // ── Selettore di mese ───────────────────────────────────────

  function init(opzioni = {}) {
    initTema();

    let tokenGriglia = opzioni.token ?? TOKEN_OGGI;
    let annoPannello = opzioni.anno ?? parseToken(tokenGriglia).anno;

    const selettore = document.getElementById("selettoreMese");
    const trigger = document.getElementById("triggerMese");
    const pannello = document.getElementById("pannelloMese");
    const etichetta = trigger ? trigger.querySelector(".etichetta") : null;
    const annoValore = document.getElementById("annoValore");
    const celleMese = pannello
      ? Array.from(pannello.querySelectorAll(".cella-mese"))
      : [];

    // ---- Rendering derivato dallo stato ----

    function rendiMeseInGriglia(lampeggiaUrl) {
      if (etichetta) etichetta.textContent = etichettaMese(tokenGriglia);
      disegnaIntestazioneGiorni();
      aggiornaTotali(disegnaGriglia(tokenGriglia));
      aggiornaUrl(tokenGriglia, lampeggiaUrl);
      const riepilogo = document.getElementById("linkRiepilogo");
      if (riepilogo) riepilogo.setAttribute("href", `#riepilogo-${tokenGriglia}`);
    }

    function rendiPannello() {
      const attuale = parseToken(tokenGriglia);

      if (annoValore) {
        const cifra = annoValore.querySelector("[data-anno]");
        if (cifra) cifra.textContent = String(annoPannello);
        const fuori = annoValore.querySelector("[data-fuori]");
        if (fuori) {
          // Quando l'anno navigato non contiene il mese in griglia, il pannello
          // lo dichiara invece di lasciare la selezione muta.
          fuori.textContent =
            annoPannello === attuale.anno
              ? ""
              : `in griglia: ${MESI[attuale.mese - 1]} ${attuale.anno}`;
        }
      }

      celleMese.forEach((cella) => {
        const mese = Number(cella.dataset.mese);
        const inGriglia = annoPannello === attuale.anno && mese === attuale.mese;
        cella.setAttribute("aria-current", inGriglia ? "true" : "false");
        cella.tabIndex = inGriglia ? 0 : -1;

        const oggi = parseToken(TOKEN_OGGI);
        const eOggi = annoPannello === oggi.anno && mese === oggi.mese;
        let dot = cella.querySelector(".oggi-dot");
        if (eOggi && !dot) {
          dot = document.createElement("span");
          dot.className = "oggi-dot";
          cella.appendChild(dot);
        } else if (!eOggi && dot) {
          dot.remove();
        }
      });

      // Se nessun mese è in griglia (anno diverso), il primo è raggiungibile.
      if (!celleMese.some((c) => c.tabIndex === 0) && celleMese[0]) {
        celleMese[0].tabIndex = 0;
      }
    }

    // ---- Apertura e chiusura ----

    function apri() {
      if (!selettore) return;
      annoPannello = parseToken(tokenGriglia).anno;
      selettore.classList.add("aperto");
      trigger.setAttribute("aria-expanded", "true");
      rendiPannello();
      const attivo = celleMese.find((c) => c.tabIndex === 0);
      if (attivo) attivo.focus();
    }

    function chiudi(riportaFocus) {
      if (!selettore) return;
      selettore.classList.remove("aperto");
      trigger.setAttribute("aria-expanded", "false");
      celleMese.forEach((c) => c.classList.remove("focus-tastiera"));
      if (riportaFocus) trigger.focus();
    }

    function eAperto() {
      return !!selettore && selettore.classList.contains("aperto");
    }

    // ---- Scelta del mese: nessuna conferma aggiuntiva (AC-2) ----

    function scegli(mese) {
      tokenGriglia = componiToken(annoPannello, mese);
      chiudi(true);
      rendiMeseInGriglia(true);
      rendiPannello();
    }

    // ---- Cablaggio ----

    if (trigger) {
      trigger.addEventListener("click", () => {
        if (eAperto()) chiudi(true);
        else apri();
      });
    }

    celleMese.forEach((cella, indice) => {
      cella.addEventListener("click", () => scegli(Number(cella.dataset.mese)));
      cella.addEventListener("keydown", (evento) => {
        const passi = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
        let destinazione = null;
        if (evento.key in passi) destinazione = indice + passi[evento.key];
        else if (evento.key === "Home") destinazione = 0;
        else if (evento.key === "End") destinazione = celleMese.length - 1;
        if (destinazione === null) return;
        evento.preventDefault();
        const limitata = Math.max(0, Math.min(celleMese.length - 1, destinazione));
        celleMese.forEach((c) => { c.tabIndex = -1; });
        celleMese[limitata].tabIndex = 0;
        celleMese[limitata].focus();
      });
    });

    document.querySelectorAll("[data-anno-passo]").forEach((bottone) => {
      bottone.addEventListener("click", () => {
        annoPannello += Number(bottone.dataset.annoPasso);
        rendiPannello();
      });
    });

    // Esc e clic fuori: il mese in griglia non cambia (AC-5)
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && eAperto()) {
        evento.preventDefault();
        chiudi(true);
      }
    });
    document.addEventListener("pointerdown", (evento) => {
      if (!eAperto()) return;
      if (selettore.contains(evento.target)) return;
      chiudi(false);
    });

    // Frecce mese e «Mese corrente» restano fuori perimetro ma vivi.
    const passoMese = (delta) => {
      const { anno, mese } = parseToken(tokenGriglia);
      const d = new Date(anno, mese - 1 + delta, 1);
      tokenGriglia = componiToken(d.getFullYear(), d.getMonth() + 1);
      annoPannello = d.getFullYear();
      rendiMeseInGriglia(true);
      rendiPannello();
    };
    document.querySelectorAll("[data-mese-passo]").forEach((bottone) => {
      bottone.addEventListener("click", () => passoMese(Number(bottone.dataset.mesePasso)));
    });
    const bottoneOggi = document.getElementById("btnMeseCorrente");
    if (bottoneOggi) {
      bottoneOggi.addEventListener("click", () => {
        tokenGriglia = TOKEN_OGGI;
        annoPannello = parseToken(TOKEN_OGGI).anno;
        rendiMeseInGriglia(true);
        rendiPannello();
      });
    }

    // ---- Stato iniziale della pagina ----

    rendiMeseInGriglia(false);
    rendiPannello();

    if (opzioni.aperto && selettore) {
      selettore.classList.add("aperto");
      trigger.setAttribute("aria-expanded", "true");
      if (opzioni.anno !== undefined) {
        annoPannello = opzioni.anno;
        rendiPannello();
      }
      if (opzioni.focusMese) {
        const bersaglio = celleMese.find(
          (c) => Number(c.dataset.mese) === opzioni.focusMese
        );
        if (bersaglio) {
          celleMese.forEach((c) => { c.tabIndex = -1; });
          bersaglio.tabIndex = 0;
          // La classe replica l'anello di :focus-visible anche su una pagina
          // aperta senza interazione da tastiera.
          bersaglio.classList.add("focus-tastiera");
          bersaglio.focus({ preventScroll: true });
        }
      }
    }
  }

  return { init, initTema, etichettaMese };
})();
