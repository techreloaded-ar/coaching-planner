---
id: decisions.calcoli-puri
type: decision
decision_status: accepted
summary: Isolare validazioni e calcoli di consuntivazione in funzioni pure testabili
status: generated
links:
  - id: engineering.code-map
    relation: affects
  - id: domains.attivita
    relation: affects
  - id: domains.offerte
    relation: affects
  - id: domains.fatturazione-clienti
    relation: affects
sources:
  - path: "docs/wiki/sources/prd.md"
    role: decision-source
  - path: "src/domain/consuntivi/index.ts"
    role: implementation
  - path: "src/domain/calendario/index.ts"
    role: implementation
  - path: "src/domain/anagrafiche/valida-cliente.ts"
    role: implementation
  - path: "tests/unit/riepilogo-mese.test.ts"
    role: verification
  - path: "tests/unit/avanzamento-offerte.test.ts"
    role: verification
---
# Calcoli di dominio in funzioni pure

<!-- archetipo:wiki section=context -->
## Contesto

Conversioni, rimborsi, riepiloghi e avanzamento devono essere verificabili senza framework o database. Il PRD, ADR-006, registra questa scelta per ridurre accoppiamento e rendere i calcoli testabili.

<!-- archetipo:wiki section=decision -->
## Decisione

Collocare validazioni e calcoli deterministici in moduli TypeScript puri, passando input serializzabili e lasciando query, sessione e persistenza agli adapter applicativi.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Implementare i calcoli direttamente nelle pagine, Server Action o query Prisma. Il PRD la scarta perché aumenterebbe duplicazione e renderebbe più difficile il test in isolamento.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Le stesse regole possono essere riusate da UI, report e lista offerte e sono coperte da unit test veloci. Il modulo fisico `consuntivi` raccoglie però regole di più capability e richiede attenzione per non confondere riuso tecnico con un unico confine di dominio.

<!-- archetipo:wiki section=verification -->
## Verifica

`src/domain/consuntivi/index.ts` non importa Next o Prisma e implementa validazione, rimborsi, riepilogo, fatturazione e avanzamento. Calendario e validatori anagrafici sono anch'essi puri. Le suite unitarie importano direttamente queste funzioni. La decisione è adottata, mentre orchestrazione e scritture restano correttamente nei moduli `lib` e nelle Server Action.
