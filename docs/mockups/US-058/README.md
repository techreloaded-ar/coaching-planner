# US-058 — Selettore di mese compatto sull'etichetta

Mockup isolato della barra del calendario mensile del front office
(`/attivita`) con il nuovo selettore di mese. Nessun file di `src/`, `tests/` o
`prisma/` è toccato: queste pagine si aprono direttamente nel browser
(`index.html`), non richiedono server né build.

Mese di riferimento: **agosto 2026** — «oggi» nel mockup è giovedì 6 agosto 2026.

## Schermate

| File | Cosa mostra | Criteri |
| --- | --- | --- |
| `index.html` | Barra con il selettore **chiuso**: l'etichetta è un controllo (chevron rosa, tinta e bordo al passaggio), il campo mese nativo con «Vai» non c'è più. In fondo un confronto **prima / dopo** che documenta la rimozione. Prototipo completo: apri, naviga, scegli. | AC-1, AC-3, AC-4 |
| `selettore-aperto.html` | Pannello aperto sull'anno in griglia: navigazione anno e griglia 3 × 4 dei dodici mesi abbreviati, **ago** evidenziato in pieno rosa. | AC-1, AC-2 |
| `selettore-altro-anno.html` | Pannello portato sul **2024** con «Anno precedente»: nessuna cella evidenziata, perché il mese in griglia (agosto 2026) è fuori anno; la riga dell'anno lo dichiara e la griglia sotto non cambia. | AC-1, AC-5 |
| `focus-tastiera.html` | Focus da tastiera su **nov**: anello rosa netto, distinto dal pieno del mese in griglia. Le dodici celle sono un unico stop di tabulazione, le frecce si muovono al loro interno. | AC-6, AC-2 |

`shared.css` contiene token e componenti condivisi; `app.js` la logica del
prototipo (tema chiaro/scuro, apertura e chiusura, navigazione dell'anno,
scelta del mese, ridisegno della griglia). La barra demo in fondo a ogni pagina
collega le schermate fra loro.

## Cosa è provabile davvero

Le quattro pagine non sono immagini: il selettore funziona.

- **AC-2** — un clic su una cella mese chiude il pannello e ridisegna subito la
  griglia. Non esiste alcun pulsante di conferma.
- **AC-4** — la finta barra indirizzo in alto a destra mostra il token
  `?mese=YYYY-MM` e lampeggia a ogni cambio di mese.
- **AC-5** — <kbd>Esc</kbd> e il clic fuori chiudono lasciando il mese
  invariato; anche navigare l'anno senza scegliere non tocca nulla.
- **AC-6** — <kbd>Invio</kbd> sull'etichetta apre e porta il focus sul mese in
  griglia, le frecce si muovono nella griglia 3 × 4, <kbd>Invio</kbd> sceglie,
  <kbd>Esc</kbd> chiude; in entrambi i casi il focus torna sull'etichetta.

Frecce mese, «Mese corrente» e «Riepilogo mese» restano nella barra e restano
vivi nel prototipo, ma sono fuori perimetro: servono solo a mostrare che la
barra non perde nient'altro. Cache, prefetch e indicatore di attesa non sono
riprodotti.

## Direzione visiva

La superficie è l'**area attività del collaboratore**, quindi la scala primaria
è il rosa reale dell'app (`rose-600` sui comandi, `rose-800` sui numeri) sui
neutri zinc, con gli stessi arrotondamenti (10 px sui comandi, 11 px sulle
superfici) e le stesse ombre `shadow-sm` del codice vero.

L'elemento memorabile è il **trigger-titolo**. L'etichetta del mese resta il
testo più grande della barra ma smette di essere una didascalia: non guadagna
un bordo da pulsante — guadagna un chevron rosa e una tinta che compare solo al
passaggio e al focus. La gerarchia tipografica della barra non cambia, cambia
solo l'affordance. Il pannello scende da lì, agganciato da un becco sotto
l'etichetta: si legge come una continuazione del titolo, non come una finestra
separata. Per questo è un popover ancorato e non una modale — niente velo
scuro, niente centratura, la griglia resta leggibile sotto.

Due dettagli minori portano il peso dei casi limite: il **puntino** sotto
l'abbreviazione marca il mese reale di oggi quando non coincide con quello in
griglia, e la riga dell'anno mostra «in griglia: …» appena si esce dall'anno
del mese mostrato, così un pannello senza evidenziazione non risulta mai muto.
