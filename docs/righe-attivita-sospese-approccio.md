# Righe attività sospese: approccio

Contesto: un import iniziale da Excel ricarica utenti, clienti, offerte e righe attività su
un database vuoto. I fogli anagrafici e il foglio di pianificazione non sono coerenti tra
loro: la pianificazione cita collaboratori, clienti e codici offerta che non esistono nei
fogli anagrafici. L'import non deve perdere righe né fermarsi, e un amministratore deve
poter vedere dall'applicazione cosa non è entrato e perché.

## Principio

L'import non prende decisioni sulle anagrafiche. Una riga di pianificazione o combacia con
collaboratore, cliente e offerta già censiti e viene importata come `RigaAttivita`, oppure
viene conservata così com'è nell'Excel in `RigaAttivitaSospesa`, con il motivo. Niente
clienti o offerte creati "in attesa di verifica", niente errori bloccanti sulle singole
righe: l'import arriva sempre in fondo.

Le decisioni restano all'amministratore, che per ora le prende fuori dall'applicazione
(censisce a mano, corregge l'Excel, reimporta) e marca le righe come risolte. Le azioni
guidate (censisci e importa, sposta su altro cliente) sono una evoluzione futura che si
costruisce sopra questa tabella senza cambiarne lo schema.

## Schema

```prisma
enum MotivoSospensione {
  COLLABORATORE_SCONOSCIUTO
  CLIENTE_SCONOSCIUTO
  OFFERTA_SCONOSCIUTA
  OFFERTA_ALTRO_CLIENTE
  DATI_NON_VALIDI
}

model RigaAttivitaSospesa {
  id                    String   @id @default(uuid())
  collaboratore         String?
  data                  String?
  cliente               String?
  codiceOfferta         String?
  ore                   String?
  tipologiaFatturazione String?
  motivo                MotivoSospensione
  nota                  String?
  risoltaIl             DateTime?
  createdAt             DateTime @default(now())
}
```

- I campi descrittivi sono stringhe grezze, tutte facoltative, senza foreign key: devono
  poter contenere qualsiasi cosa ci sia nell'Excel, anche valori che non corrispondono a
  nulla. `data` è normalizzata in `YYYY-MM-DD` quando è leggibile, altrimenti il valore
  grezzo.
- `risoltaIl` è la sola informazione che l'amministratore modifica: nulla finché la riga è
  da guardare, valorizzata quando la considera chiusa. Il motivo e i dati non cambiano mai.

## Motivi di sospensione

| Motivo | Quando |
|---|---|
| COLLABORATORE_SCONOSCIUTO | Il collaboratore dichiarato non corrisponde a nessun utente censito |
| CLIENTE_SCONOSCIUTO | Il cliente dichiarato non esiste in anagrafica |
| OFFERTA_SCONOSCIUTA | Il cliente esiste, ma la coppia (cliente, codice offerta) non esiste |
| OFFERTA_ALTRO_CLIENTE | Come sopra, ma lo stesso codice esiste su un altro cliente: in `nota` l'import indica quale |
| DATI_NON_VALIDI | Data illeggibile, ore non numeriche, tipologia di fatturazione sconosciuta |

Una riga ha un solo motivo: il primo che si verifica nell'ordine della tabella. Risolto
quello, un reimport fa emergere l'eventuale successivo.

Il confronto tra valori dell'Excel e anagrafiche avviene sempre su valori normalizzati
(trim e maiuscolo).

## Cosa entra comunque come RigaAttivita

- Riga con cliente censito e codice offerta vuoto: importata con `offertaId = null`, cioè
  "offerta da definire", già supportata dall'applicazione.
- Riga con ore vuote o zero: importata con ore 0 e una nota sulla riga. Non è una
  sospensione, l'attività è reale e il collaboratore può correggerla.
- Righe ripetute nel foglio: importate tutte. In un lancio additivo una riga entra solo se
  la sua chiave (collaboratore, data, cliente, offerta) non è già nel database.

## Pagina di back-office

Rotta sotto `(back-office)`, solo amministratori. Una tabella con le righe sospese, colonne
nell'ordine: collaboratore, data, cliente, codice offerta, ore, tipologia di fatturazione,
motivo (descrizione leggibile), nota. In testa il conteggio delle righe aperte e, dove le
ore sono numeriche, il totale delle ore non importate.

Interazione: selezione di una o più righe e un'azione "Segna come risolte" che valorizza
`risoltaIl`. Filtro per motivo e per stato (aperte, risolte, tutte); predefinito aperte.
Nessun'altra azione.

Le descrizioni leggibili dei motivi stanno in una mappa `Record<MotivoSospensione, string>`
nel codice, così la build fallisce se un nuovo motivo resta senza descrizione.

## Script di import

Implementato in `scripts/importa-storico/` (`npm run db:importa-storico`, vedi il README lì).

- `--reset` svuota le tabelle applicative, compresa `RigaAttivitaSospesa`, prima di
  scrivere; senza `--reset` lo script è additivo: inserisce solo ciò che manca, per chiave,
  e non modifica ciò che esiste.
- `--dry-run` produce solo il report senza scrivere.
- Scrittura in un'unica transazione.
- A fine esecuzione stampa il conteggio delle righe importate e delle righe sospese per
  motivo.
- La logica di abbinamento (normalizzazione, risoluzione di collaboratore, cliente e
  offerta, scelta del motivo) va in un modulo riusabile, perché le future azioni guidate
  dovranno rilanciarla sulle righe sospese.
