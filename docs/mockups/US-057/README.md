# US-057 — Duplicazione di una riga attività su più giorni scelti

Mockup isolato della pagina di dettaglio giornata del front office
(`/attivita/[data]`) con la nuova azione di duplicazione. Nessun file di `src/`
è toccato: queste pagine si aprono direttamente nel browser.

Giornata di riferimento: **mercoledì 11 marzo 2026**.

## Schermate

| File | Cosa mostra | Criteri |
| --- | --- | --- |
| `index.html` | Righe salvate con la nuova azione **Duplica…** nella barra azioni, selettore compilato con tre date non contigue su due mesi e banner di esito con il numero di giorni replicati. Prototipo interattivo: aggiungi, togli e conferma. | AC-1, AC-2 |
| `selettore-vuoto.html` | Selettore appena aperto: pista vuota, **Duplica** non disponibile, avviso inline sul giorno di origine non selezionabile. | AC-3 |
| `esito-errore.html` | Duplicazione rifiutata perché l'offerta non è più abilitata: errore visibile dentro il selettore, giorni scelti conservati, nessuna riga creata. | AC-4 |
| `calendario-mese-diverso.html` | Il calendario sul mese di destinazione con la cella già valorizzata dalla duplicazione, senza ricaricare la pagina. | AC-5 |

`shared.css` contiene token e componenti condivisi; `app.js` la logica del
prototipo (tema chiaro/scuro, aggiunta/rimozione delle date, esito). La barra
demo in fondo a ogni pagina collega le schermate fra loro.

## Direzione visiva

La superficie è il **front office**, non la console amministrativa: la scala
primaria è quindi il rosa dell'area attività reale (`rose-600` sui comandi,
`rose-800` sui numeri) sui neutri zinc condivisi, con l'ambra riservata al
rimborso trasferta e il rosso ai rifiuti.

L'elemento memorabile è la **pista dei giorni**: le destinazioni scelte non
sono un elenco verticale ma una fila di tessere-calendario con il numero
grande, raggruppate per mese e separate da un divisorio. Rende immediatamente
leggibile ciò che la storia chiede — date arbitrarie, non contigue, anche di
mesi diversi — senza doverlo spiegare a parole.
