# Mockup US-007 — Anagrafica clienti con dati di fatturazione

Prototipo HTML statico, autonomo rispetto al codice dell'applicazione (`src/` non è toccato).
Aprire i file direttamente nel browser.

## Layout: console gestionale

Il back office è una **web app console**: sidebar di navigazione fissa a sinistra e view popolate
nell'area contenuto a destra. Non esiste più una pagina "snodo a card".

- **Sidebar** — logo/nome app "Coaching Planner" in alto; voci di navigazione: **Clienti** (attiva
  ed evidenziata), Offerte, Collaboratori, Scaglioni km e Report marcate "In arrivo" e disabilitate.
  In fondo: utente (avatar con iniziali, nome, ruolo Amministratore), toggle tema e pulsante **Esci**.
- **Area contenuto** — titolo della view corrente + contenuto; la sidebar resta sempre visibile.
- Sotto i 920px la sidebar collassa in una rail a sole icone.

## Schermate

| File | View |
|------|------|
| `index.html` | Console con la view **Elenco clienti**: tabella con ragione sociale, P.IVA, città, badge Attivo/Disattivato, righe disattivate attenuate, azioni **Modifica** e **Disattiva** (con conferma)/**Riattiva**, ricerca, pulsante **Nuovo cliente** |
| `cliente-form.html` | View **Form cliente** (creazione); con `?id=cli-001` passa in modalità **Modifica** precompilata |

## Comportamenti del prototipo

- I dati demo dei clienti sono persistiti in `localStorage` (chiave `cp-us007-clienti`): creazioni, modifiche e cambi di stato sopravvivono alla navigazione tra le view. Per ripartire dal seme demo, svuotare la chiave dal browser.
- La **disattivazione** chiede conferma in una modale e rende la riga attenuata (badge "Disattivato", nome barrato); la **riattivazione** è immediata.
- La **validazione** del form è per campo: ragione sociale e P.IVA (11 cifre) obbligatorie; CF, CAP, provincia, PEC e codice SDI validati nel formato solo se compilati.
- Tema chiaro/scuro con toggle nel piede della sidebar (chiave `cp-mockup-tema`, condivisa con i mockup precedenti).

## Stile

Tema allineato all'app reale del Back Office: zinc + indigo, raggi 10–11px, font di sistema, dark mode. L'architettura dei file (`shared.css` con token CSS, `app.js` con utilità) e il vocabolario dei componenti (badge con pallino, tabelle, card, toast) seguono i mockup `docs/mockups/MVP` e `docs/mockups/US-005`.
