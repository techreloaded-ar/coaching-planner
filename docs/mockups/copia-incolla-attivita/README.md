# Copia e incolla di una riga attività sul calendario

Mockup isolato della nuova esperienza di duplicazione nel front office
(`/attivita`). Sostituisce il pannello modale «Duplica su più giorni» di
US-057: il collaboratore copia una riga e sceglie i giorni di destinazione
direttamente sul calendario mensile. Nessun file di `src/` è toccato: le pagine
si aprono direttamente nel browser.

Mese di riferimento: **novembre 2026**, con oggi fissato a lunedì 23.

## Decisioni rappresentate

- Si copia **una riga**, non una giornata intera.
- La copia è **totale**: cliente, offerta, ore, nota, fatturabilità e rimborso
  trasferta, senza interruttori.
- **Nessun avviso** sul totale ore del giorno di destinazione.
- Un clic aggiunge il giorno, un secondo clic lo toglie; nulla viene scritto
  fino alla **conferma unica** «Incolla su N giorni» (la duplicazione atomica
  già esistente: tutti i giorni o nessuno).
- La selezione **sopravvive al cambio mese**.
- Il giorno di origine è marcato e **non selezionabile**.
- Una riga su offerta non più abilitata ha «Copia» **spento in partenza**, con
  il motivo accanto.

## Schermate

| File | Cosa mostra |
| --- | --- |
| `index.html` | Calendario con l'icona di copia nelle celle. Prototipo interattivo dell'intero flusso. |
| `index.html?stato=scelta-riga` | Menu di scelta della riga su un giorno che ne ha più di una. |
| `index.html?stato=incolla` | Modalità incolla: vassoio degli appunti, giorni scelti con la riga in anteprima, origine marcata. |
| `index.html?stato=mese-diverso` | La stessa selezione vista da dicembre: il vassoio tiene il conto per mese. |
| `index.html?stato=esito` | Dopo la conferma: banner d'esito e celle valorizzate senza ricaricare. |
| `index.html?stato=errore` | Rifiuto del server (abilitazione revocata nel frattempo): errore nel vassoio, selezione conservata. |
| `elenco.html` | Ingresso «Copia» dalla vista Elenco. |
| `giornata.html` | Ingresso «Copia su altri giorni» dal dettaglio giornata, al posto di «Duplica…». |

`shared.css` contiene token e componenti condivisi; `app.js` i dati finti e la
logica del prototipo. La barra in fondo a ogni pagina collega gli stati fra
loro. Nel calendario solo la cella dell'11 novembre apre il dettaglio giornata.

## Direzione visiva

Stessa lingua dell'area attività reale e del mockup US-057: neutri zinc, rosa
sui comandi, ambra per il rimborso trasferta, rosso per i rifiuti. La cella del
calendario ricalca quella vera (numero nel cerchio, contatore righe, etichette
cliente, totale ore in basso, banda laterale).

L'elemento memorabile è il **vassoio degli appunti**: una barra scura ancorata
in basso che tiene in mano la riga copiata, mentre il calendario vero diventa
la superficie su cui incollarla. I giorni scelti mostrano la riga in anteprima,
tratteggiata, accanto a ciò che contengono già, con il totale del giorno
aggiornato.
