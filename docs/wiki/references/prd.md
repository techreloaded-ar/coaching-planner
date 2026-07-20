---
type: reference
title: Documento dei Requisiti di Prodotto
description: PRD originale di Coaching Planner, conservato come fonte di intento e decisioni attribuite
status: generated
sources:
- path: docs/PRD.md
  role: original
---
# Coaching Planner - Documento dei Requisiti di Prodotto (PRD)

**Autore:** ARchetipo
**Data:** 2026-06-11
**Versione:** 1.1

---

## Elevator Pitch

> Coaching Planner trasforma la consuntivazione mensile di una società di consulenza da rincorsa manuale a processo automatico: i collaboratori registrano le attività giorno per giorno, il titolare ottiene a fine mese sia gli importi da fatturare ai clienti sia le fatture da attendersi dai collaboratori.
>
> Per **le società di consulenza e coaching che lavorano con collaboratori a partita IVA**, che hanno il problema di **consuntivare manualmente ore, trasferte e importi tra collaboratori, clienti e offerte**, **Coaching Planner** è un **gestionale web** che **automatizza il doppio consuntivo mensile: fatturazione attiva verso i clienti e fatture passive attese dai collaboratori**. A differenza di **fogli di calcolo condivisi e raccolte dati via email**, il nostro prodotto **centralizza anagrafiche, tariffe e attività in un'unica fonte di verità, con calcoli automatici e visibilità in tempo reale sull'avanzamento delle offerte**.

---

## Visione

Coaching Planner è il punto di riferimento operativo dell'azienda: ogni cliente, offerta e collaboratore è censito in un unico sistema, ogni ora lavorata è tracciata alla fonte da chi la eroga, e i numeri di fine mese — quanto fatturare a ogni cliente, quanto riconoscere a ogni collaboratore, quante giornate residue per ogni offerta — emergono automaticamente dai dati, senza riconciliazioni manuali. Nel tempo, il sistema evolverà da strumento di consuntivazione a strumento di governo del business, con il monitoraggio della marginalità per cliente e offerta.

### Differenziatore di Prodotto

Il doppio consuntivo automatico su un unico inserimento dati: la stessa riga di attività registrata dal collaboratore alimenta contemporaneamente la fattura attiva verso il cliente (tariffa dell'offerta), la fattura passiva attesa dal collaboratore (tariffa del collaboratore) e l'avanzamento delle giornate erogate rispetto a quelle previste dall'offerta. Nessun gestionale generalista copre questo flusso specifico per collaboratori a partita IVA senza pesanti personalizzazioni.

---

## Personas Utente

### Persona 1: Stefano

**Ruolo:** Titolare e amministratore della società (utente Back Office)
**Età:** 37 | **Background:** Fondatore della società di consulenza, segue commerciale, contratti e amministrazione; oggi gestisce la consuntivazione con fogli di calcolo.

**Obiettivi:**
- Sapere a fine mese, senza elaborazioni manuali, quanto fatturare a ogni cliente e quanto attendersi come fatture dai collaboratori.
- Tenere sotto controllo l'avanzamento delle offerte: giornate erogate rispetto a quelle vendute.
- Configurare una sola volta tariffe, offerte e regole di rimborso trasferte, e non doverci più pensare.

**Pain Point:**
- Raccolta manuale delle ore dai collaboratori, con solleciti, formati diversi ed errori di trascrizione.
- Nessuna visibilità in corso d'opera su quanto è stato erogato di un'offerta: il superamento dei giorni venduti si scopre tardi.
- Verifica faticosa della coerenza tra le fatture ricevute dai collaboratori e il lavoro effettivamente svolto.

**Comportamenti e Strumenti:**
- Lavora da desktop, usa quotidianamente fogli di calcolo, email e gestionale di fatturazione.
- Controlla i numeri a fine mese, ma vorrebbe poterli guardare in qualsiasi momento.

**Motivazioni:** Ridurre il tempo amministrativo, eliminare gli errori, decidere con numeri aggiornati.
**Confidenza Tecnologica:** Alta — usa strumenti digitali con disinvoltura e apprezza l'automazione.

#### Customer Journey - Stefano

| Fase | Azione | Pensiero | Emozione | Opportunità |
|---|---|---|---|---|
| Consapevolezza | A fine mese passa ore a riconciliare fogli di calcolo dei collaboratori | "Sto perdendo tempo e prima o poi sbaglio una fattura" | Frustrazione | Mostrare il costo nascosto della consuntivazione manuale |
| Considerazione | Valuta gestionali generalisti e decide di far sviluppare uno strumento su misura | "Mi serve esattamente il mio flusso, non cento funzioni inutili" | Determinazione | Prodotto su misura per il flusso collaboratori a P.IVA |
| Primo Utilizzo | Censisce clienti, offerte, collaboratori e scaglioni di rimborso km | "Se configuro bene ora, dopo va tutto da solo" | Fiducia prudente | Onboarding guidato delle anagrafiche e validazione dei dati |
| Uso Regolare | Apre i report mensili e la vista di avanzamento offerte | "So già quanto fatturare e cosa aspettarmi, senza chiedere niente a nessuno" | Sollievo, controllo | Report sempre aggiornati in tempo reale |
| Advocacy | Consiglia l'approccio ad altri imprenditori con collaboratori a P.IVA | "Questo flusso vale per chiunque lavori così" | Orgoglio | Possibile evoluzione multi-azienda |

---

### Persona 2: Giulia

**Ruolo:** Collaboratrice a partita IVA (utente Front Office)
**Età:** 32 | **Background:** Consulente/coach freelance, collabora con più aziende, fattura mensilmente la società per le giornate erogate.

**Obiettivi:**
- Registrare le attività in pochi secondi al giorno, anche su più clienti e offerte nella stessa giornata.
- Sapere in ogni momento quante ore e giornate ha lavorato nel mese e quanto dovrà fatturare alla società.
- Vedere i rimborsi trasferta calcolati automaticamente, senza dover ricordare gli scaglioni.

**Pain Point:**
- Annotare le ore su strumenti personali e doverle ricopiare a fine mese per la società.
- Incertezza sull'importo della fattura da emettere: il conteggio manuale di ore, fatturabilità e rimborsi è soggetto a errori.
- Solleciti dell'amministrazione quando i dati mancano o non tornano.

**Comportamenti e Strumenti:**
- Lavora da laptop, spesso in mobilità tra un cliente e l'altro.
- Compila i dati a fine giornata o a fine settimana: l'inserimento deve essere veloce e tollerare la compilazione differita.

**Motivazioni:** Meno burocrazia, certezza dell'importo da fatturare, zero ricopiature.
**Confidenza Tecnologica:** Media — a suo agio con le web app, nessuna voglia di strumenti complicati.

#### Customer Journey - Giulia

| Fase | Azione | Pensiero | Emozione | Opportunità |
|---|---|---|---|---|
| Consapevolezza | La società le chiede di usare il nuovo strumento al posto del foglio di calcolo | "Un altro strumento da imparare?" | Scetticismo | Esperienza di primo accesso semplicissima |
| Considerazione | Prova l'inserimento di una giornata di attività | "Ok, sono due campi e un click" | Sorpresa positiva | Inserimento riga in pochi secondi, default intelligenti |
| Primo Utilizzo | Compila la sua prima settimana con clienti, offerte e una trasferta | "Il rimborso me lo calcola da solo" | Soddisfazione | Calcolo automatico rimborsi e totali |
| Uso Regolare | Naviga il mese, controlla il riepilogo e a fine mese emette la fattura con l'importo indicato | "So esattamente quanto fatturare, niente più conti a mano" | Fiducia | Riepilogo mensile come incentivo alla compilazione puntuale |
| Advocacy | Suggerisce miglioramenti e usa volentieri lo strumento | "Mi fa risparmiare tempo ogni mese" | Affezione | Raccolta feedback per evoluzioni future |

---

## Insight dal Brainstorming

> Scoperte chiave e direzioni alternative esplorate durante la sessione di inception.

### Assunzioni Sfidate

- **"Ogni collaboratore ha una tariffa giornaliera unica"** — Sfidata da Costanza (e se variasse per cliente/offerta?). **Confermata dal committente**: la tariffa è unica per collaboratore. Il modello dati resta semplice; un eventuale override per offerta è rimandato alla fase di crescita se emergerà il bisogno.
- **"Il prodotto è diviso in due applicazioni web"** — Riletta da Leonardo: si realizza come **un'unica applicazione web con due aree e ruoli distinti** (Collaboratore → Front Office, Amministratore → Back Office). Stessa base dati, meno infrastruttura, stessa esperienza percepita.
- **"Tariffe giornaliere ma caricamento a ore"** — La regola di conversione mancava nelle note ed era critica per tutti i calcoli. **Risolta con il committente**: conversione fissa **1 giornata = 8 ore**.

### Nuove Direzioni Emerse

- **Chiusura del mese**: dal "what if" di Costanza (cosa succede se un collaboratore modifica una riga di un mese già fatturato?) è emersa l'ipotesi di un meccanismo di chiusura/blocco del mese consuntivato. **Decisione del committente**: il mese resta aperto e modificabile anche dopo la sua conclusione; nessun blocco è previsto. Le eventuali divergenze tra consuntivi e fatture già emesse vengono gestite organizzativamente.
- **Il riepilogo mensile come leva di adozione**: per i collaboratori il valore immediato è vedere crescere l'importo della propria fattura man mano che compilano; questo trasforma un obbligo amministrativo in un beneficio personale.

### Assunzioni da Validare

- **Ribaltamento trasferte al cliente con lo stesso importo**: il committente ha confermato che i rimborsi trasferta vengono anche ribaltati in fattura al cliente; si assume che l'importo ribaltato coincida con il rimborso forfettario riconosciuto al collaboratore (stessi scaglioni, nessun ricarico). Da validare se servirà un ricarico o una tariffazione diversa lato cliente.
- **Hosting dell'applicazione**: il database sarà un Postgres su SiteGround (decisione del committente); si assume che l'app Next.js sia ospitata su una piattaforma Node-compatibile con accesso remoto al database. Da verificare che il piano SiteGround consenta connessioni remote a Postgres con TLS.
- **Emissione fatture fuori scope**: il sistema calcola gli imponibili (consuntivi) ma non emette documenti fiscali; la fatturazione elettronica resta sui sistemi esistenti.
- **Volumi attesi contenuti**: una sola azienda, ordine di grandezza di decine di collaboratori e clienti; l'architettura monolitica è dimensionata su questa assunzione.

### Rischi Principali

- **Adozione dei collaboratori**: se l'inserimento quotidiano è macchinoso, i dati arrivano tardi o incompleti e i consuntivi perdono affidabilità. Mitigazione: inserimento riga in pochi secondi, riepilogo fattura sempre visibile come incentivo.
- **Modifiche retroattive**: righe modificate dopo la fatturazione del mese generano divergenze tra consuntivo e fatture emesse. Per decisione del committente il mese resta sempre aperto: il rischio è accettato e gestito organizzativamente; i report ricalcolano sempre i dati correnti, quindi le differenze emergono rieseguendo il report del mese.
- **Errori di configurazione**: tariffe o scaglioni km errati propagano errori su tutti i calcoli. Mitigazione: validazioni in back office e tracciabilità dei parametri usati nei calcoli.
- **Esecuzione tecnica del deploy**: la combinazione app Node + Postgres su SiteGround va validata presto (connettività remota, TLS, latenza) per non scoprire vincoli a ridosso del rilascio.

---

## Scope di Prodotto

### MVP - Minimum Viable Product

**Front Office (Collaboratore)**
- Navigazione mensile delle proprie attività (mese per mese, giorno per giorno).
- Inserimento di una o più righe di attività per giornata, ognuna associata a cliente e offerta, con ore lavorate, nota descrittiva e flag "fatturabile".
- Registrazione della trasferta con distanza in km e calcolo automatico del rimborso forfettario in base agli scaglioni configurati.
- Riepilogo mensile automatico: ore e giornate lavorate per offerta, rimborsi trasferta, importo totale della fattura da emettere alla società (solo righe fatturabili).

**Back Office (Amministratore)**
- Anagrafica clienti con dati di fatturazione.
- Anagrafica offerte per cliente: codice, descrizione, tariffa giornaliera, giorni previsti.
- Anagrafica collaboratori: dati anagrafici, partita IVA, tariffa giornaliera applicata alla società.
- Configurazione degli scaglioni chilometrici per i rimborsi trasferta (es. fino a 100 km → importo X, fino a 200 km → importo Y).

**Reportistica (Amministratore)**
- Report mensile per cliente: importi da fatturare calcolati dalle attività dei collaboratori (giornate × tariffa dell'offerta), inclusi i rimborsi trasferta ribaltati al cliente.
- Vista avanzamento offerte: giornate erogate per collaboratore rispetto alle giornate previste, con residuo.

**Trasversale**
- Autenticazione con ruoli (Amministratore / Collaboratore) e segregazione dei dati: ogni collaboratore vede e modifica solo le proprie attività.
- Conversione fissa 1 giornata = 8 ore in tutti i calcoli.

### Funzionalità di Crescita (Post-MVP)

- **Analisi della marginalità** (decisione presa in riunione: posticipata dopo il rilascio iniziale): confronto per periodo tra ricavi da clienti (tariffe offerte × giornate) e costi dai collaboratori (tariffe collaboratori × giornate), per cliente e per offerta.
- Esportazione di report e riepiloghi (Excel/PDF).
- Promemoria automatici di compilazione per i collaboratori.
- Tariffa collaboratore con override per offerta, se il bisogno emergerà.

### Visione (Futuro)

- Integrazione con sistemi di fatturazione elettronica (generazione automatica delle bozze di fattura attiva e riconciliazione delle fatture passive).
- Dashboard direzionale con andamento di ricavi, costi e marginalità nel tempo.
- Supporto multi-azienda per offrire lo strumento ad altre realtà con lo stesso modello operativo.

---

## Architettura Tecnica

> **Proposta da:** Leonardo (Architect)

### Architettura di Sistema

Unica applicazione web full-stack (monolite) che serve sia il Front Office dei collaboratori sia il Back Office amministrativo, differenziati tramite ruoli. Il rendering e le API convivono nello stesso progetto Next.js; la persistenza è su PostgreSQL gestito esternamente (SiteGround). Nessun servizio aggiuntivo: i volumi attesi (una azienda, decine di utenti) non giustificano complessità distribuita.

**Pattern Architetturale:** Monolite full-stack server-rendered (Next.js App Router) con accesso al database tramite ORM; logica di calcolo (conversioni ore/giorni, rimborsi, consuntivi) isolata in moduli di dominio puri e testabili.

**Componenti Principali:**
- **Area Front Office**: vista calendario mensile, gestione righe di attività e trasferte, riepilogo mensile del collaboratore.
- **Area Back Office**: CRUD anagrafiche (clienti, offerte, collaboratori), configurazione scaglioni km, reportistica.
- **Modulo di dominio "Consuntivi"**: funzioni pure per conversione ore→giorni (8h = 1g), calcolo rimborsi a scaglioni, totali fattura collaboratore, importi per cliente, avanzamento offerte.
- **Livello dati**: schema relazionale PostgreSQL gestito via ORM con migrazioni versionate.
- **Autenticazione e autorizzazione**: sessioni con ruoli (Amministratore/Collaboratore) e policy di accesso per risorsa.

### Stack Tecnologico

| Livello | Tecnologia | Versione | Motivazione |
|---|---|---|---|
| Linguaggio | TypeScript | 5.x | Tipizzazione end-to-end su frontend, backend e schema dati |
| Framework Backend | Next.js (App Router, Server Actions / Route Handlers) | 15.x | Scelta confermata dal committente; un solo progetto per UI e API |
| Framework Frontend | React | 19.x | Integrato in Next.js; ecosistema maturo per UI a calendario e tabelle |
| Database | PostgreSQL (hosting SiteGround) | 16.x (versione effettiva da verificare sul piano SiteGround) | Decisione del committente; relazionale, adatto a dati contabili |
| ORM | Prisma | 6.x | Migrazioni versionate, schema tipizzato, produttività per CRUD |
| Auth | Auth.js (NextAuth) v5, credenziali + sessioni con ruolo | | |
| Testing | Vitest (unit, modulo consuntivi) + Playwright (e2e flussi chiave) | | |

UI: Tailwind CSS 4.x con componenti shadcn/ui per tabelle, form e date picker. Importi gestiti come `Decimal` (mai float) in tutta la catena.

### Struttura del Progetto

**Pattern organizzativo:** Feature-based dentro la convenzione Next.js App Router: le route raggruppate per area (front office / back office), la logica di dominio separata dalle route e indipendente dal framework.

```text
coaching-planner/
├── prisma/
│   ├── schema.prisma          # Schema dati e migrazioni
│   └── seed.ts                # Dati di esempio per sviluppo
├── src/
│   ├── app/
│   │   ├── (front-office)/    # Area collaboratore: calendario mensile, attività, riepilogo
│   │   ├── (back-office)/     # Area admin: anagrafiche, tariffe, scaglioni km, report
│   │   ├── api/               # Route handlers (se necessari oltre alle Server Actions)
│   │   └── login/             # Autenticazione
│   ├── domain/
│   │   ├── consuntivi/        # Funzioni pure: ore→giorni, rimborsi, totali, avanzamento
│   │   └── types.ts           # Tipi di dominio condivisi
│   ├── lib/
│   │   ├── db.ts              # Client Prisma
│   │   └── auth.ts            # Configurazione Auth.js e policy ruoli
│   └── components/            # Componenti UI condivisi
├── tests/
│   ├── unit/                  # Vitest sul modulo consuntivi
│   └── e2e/                   # Playwright sui flussi chiave
└── docs/                      # PRD, mockup, risultati test
```

### Ambiente di Sviluppo

Sviluppo locale su Windows 11 con Node.js LTS e un'istanza PostgreSQL locale (container Docker o installazione nativa) per non dipendere dal database SiteGround durante lo sviluppo; `prisma migrate dev` per evolvere lo schema e `seed` per i dati di prova. Variabili d'ambiente in `.env.local` (mai committate) con `DATABASE_URL` distinta per locale e produzione.

**Strumenti richiesti:** Node.js 22 LTS, npm/pnpm, Docker Desktop (Postgres locale), Git.

### CI/CD e Deployment

**Build tool:** Next.js build (`next build`) via npm/pnpm.

**Pipeline:** Ad ogni push: install → lint → test unit (Vitest) → build → test e2e (Playwright) sui flussi critici; migrazioni applicate con `prisma migrate deploy` in fase di rilascio.

**Deployment:** App Next.js su piattaforma Node-compatibile (es. Vercel o VPS), collegata via TLS al database PostgreSQL ospitato su SiteGround. La connettività remota al Postgres SiteGround va validata come primo spike tecnico.

**Infrastruttura target:** Singolo ambiente di produzione + ambiente locale di sviluppo; database PostgreSQL gestito su SiteGround con backup a cura dell'hosting.

### Architecture Decision Records (ADR)

1. **ADR-001 — Unica web app con ruoli invece di due applicazioni separate**: stessa base dati e un solo deploy; le "due applicazioni" delle note diventano due aree con autorizzazioni distinte.
2. **ADR-002 — Conversione fissa 1 giornata = 8 ore**: confermata dal committente; implementata come costante centralizzata nel modulo di dominio, così un'eventuale futura configurabilità resta un cambiamento locale.
3. **ADR-003 — Tariffa unica per collaboratore**: confermata dal committente; il modello dati non prevede override per offerta nel MVP.
4. **ADR-004 — PostgreSQL su SiteGround**: vincolo del committente; lo sviluppo locale usa un Postgres equivalente e l'accesso remoto TLS va validato a inizio progetto.
5. **ADR-005 — Importi come Decimal**: tutti i valori monetari usano tipi decimali (DB e applicazione) per evitare errori di arrotondamento nei consuntivi.
6. **ADR-006 — Logica di calcolo in funzioni pure**: conversioni, rimborsi e totali vivono in `src/domain/consuntivi`, senza dipendenze dal framework, per essere testabili in isolamento.

---

## Requisiti Funzionali

### Autenticazione e Ruoli

- **RF-01** — Il sistema deve consentire l'accesso autenticato con credenziali e distinguere due ruoli: Amministratore (Back Office) e Collaboratore (Front Office).
- **RF-02** — Ogni collaboratore deve poter visualizzare e modificare esclusivamente le proprie attività; l'amministratore deve poter consultare i dati di tutti i collaboratori.

### Anagrafiche e Configurazione (Back Office)

- **RF-03** — L'amministratore deve poter creare, modificare e disattivare i clienti, includendo i dati di fatturazione.
- **RF-04** — L'amministratore deve poter gestire le offerte associate a ciascun cliente, specificando codice, descrizione, tariffa giornaliera e numero di giorni previsti.
- **RF-05** — L'amministratore deve poter gestire i collaboratori con dati anagrafici, partita IVA e tariffa giornaliera applicata alla società.
- **RF-06** — L'amministratore deve poter configurare gli scaglioni chilometrici per i rimborsi trasferta, definendo per ogni soglia di distanza l'importo forfettario corrispondente.

### Consuntivazione Attività (Front Office)

- **RF-07** — Il collaboratore deve poter navigare le proprie attività su base mensile, spostandosi tra i mesi e visualizzando i giorni del mese selezionato.
- **RF-08** — Il collaboratore deve poter inserire per ogni giornata una o più righe di attività, ciascuna associata a un cliente e a un'offerta, indicando le ore lavorate.
- **RF-09** — Per ogni riga di attività il collaboratore deve poter aggiungere una nota descrittiva e contrassegnare la riga come fatturabile o non fatturabile; solo le righe fatturabili concorrono al totale della fattura.
- **RF-10** — Il collaboratore deve poter registrare una trasferta indicando la distanza in km; il sistema calcola automaticamente il rimborso forfettario in base agli scaglioni configurati.
- **RF-11** — Il Front Office deve mostrare un riepilogo mensile aggiornato automaticamente: ore e giornate lavorate per offerta, totale rimborsi trasferta e importo complessivo della fattura che il collaboratore emetterà alla società.

### Calcoli e Regole di Dominio

- **RF-12** — Tutti i calcoli devono applicare la conversione fissa 1 giornata = 8 ore lavorate.
- **RF-13** — L'importo dovuto al collaboratore deve essere calcolato come giornate fatturabili × tariffa giornaliera del collaboratore, più i rimborsi trasferta del periodo.
- **RF-14** — I rimborsi trasferta devono essere ribaltati anche in fattura al cliente: ogni trasferta registrata concorre, con lo stesso importo forfettario, sia alla fattura del collaboratore sia all'importo da fatturare al cliente di riferimento.
- **RF-15** — Le attività devono rimanere sempre modificabili dal collaboratore, anche per mesi conclusi: il sistema non prevede alcun blocco o chiusura del mese e i report riflettono sempre i dati correnti.

### Reportistica (Back Office)

- **RF-16** — Il sistema deve generare un report mensile per cliente con l'importo da fatturare, calcolato dalle giornate lavorate dai collaboratori sulle offerte di quel cliente moltiplicate per la tariffa giornaliera di ciascuna offerta, più i rimborsi trasferta ribaltati al cliente nel mese.
- **RF-17** — Il sistema deve offrire una vista di avanzamento per offerta che mostri le giornate erogate (con dettaglio per collaboratore) rispetto alle giornate previste, evidenziando il residuo.

---

## Requisiti Non Funzionali

### Sicurezza

- Le password devono essere memorizzate con hashing robusto (es. bcrypt/argon2); le sessioni devono essere protette e scadere dopo inattività prolungata.
- Tutte le comunicazioni devono avvenire su HTTPS; la connessione al database SiteGround deve usare TLS.
- L'autorizzazione deve essere applicata lato server su ogni operazione: nessun dato di altri collaboratori deve essere accessibile aggirando l'interfaccia.
- I dati personali trattati (anagrafiche, partite IVA) rientrano nel perimetro GDPR: accesso limitato per ruolo e possibilità di rettifica dei dati.
- I valori monetari devono essere gestiti con tipi decimali per garantire correttezza contabile.

### Integrazioni

- Nessuna integrazione esterna nel MVP: l'emissione delle fatture (attive e passive) resta sui sistemi esistenti; Coaching Planner fornisce gli importi consuntivati.
- Unica dipendenza infrastrutturale esterna: il database PostgreSQL ospitato su SiteGround, raggiunto tramite connessione remota TLS (da validare come primo spike tecnico).
- Predisposizione futura (visione): integrazione con sistemi di fatturazione elettronica.

---

## Prossimi Passi

1. **Backlog** - Esegui `/archetipo-spec` per trasformare questo PRD in un backlog
2. **Design** - Esegui `/archetipo-design` per i mockup UI (quando applicabile)
3. **Validazione** - Rivedi con gli stakeholder e testa le assunzioni più rischiose (connettività Postgres SiteGround, eventuale ricarico sui rimborsi trasferta ribaltati al cliente)

---

_PRD generato tramite ARchetipo Product Inception - 2026-06-11_
_Sessione condotta da: Stefano Marello con il team ARchetipo_

## Concetti correlati

Questa fonte d’intento è distinta dal comportamento osservato nella [panoramica](/overview.md) e alimenta le decisioni architetturali nella sezione [Decisioni](/decisions/unica-app-ruoli.md).
