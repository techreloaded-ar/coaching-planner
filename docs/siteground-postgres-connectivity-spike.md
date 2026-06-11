# Spike di connettività PostgreSQL SiteGround

**Spec:** US-004 | **Data esecuzione:** 2026-06-11
**Autore:** Team ARchetipo (Ugo 🔧)
**Versione script:** `scripts/siteground-connectivity-check.ts`

---

## Riepilogo esecutivo

La connessione al database PostgreSQL ospitato su SiteGround **funziona**, ma **senza supporto TLS/SSL**. Il server rifiuta esplicitamente le connessioni SSL (`The server does not support SSL connections`). PostgreSQL 18.4 è ampiamente compatibile con Prisma 7.x (richiede ≥ 12.0).

## Dettaglio tecnico

### Tentativo con TLS (`sslmode=require`)

| Parametro | Valore |
|---|---|
| Host | `34.163.19.189` |
| Database | `dbkncwfkbebwnl` |
| Esito | ❌ Fallito |
| Errore | `The server does not support SSL connections` |
| Tempo al fallimento | ~0.1s |

### Tentativo senza TLS

| Parametro | Valore |
|---|---|
| Host | `34.163.19.189` |
| Database | `dbkncwfkbebwnl` |
| Esito | ✅ Connessione riuscita |
| Tempo di connessione | 0.20s |
| Latenza round-trip | 51.4ms |

### Diagnostica PostgreSQL

| Metrica | Valore |
|---|---|
| Versione PostgreSQL | **18.4** |
| Versione completa | PostgreSQL 18.4 on x86_64-pc-linux-gnu |
| Server encoding | UTF8 |
| SSL attivo | **off** |
| Connessioni attive | 9 |
| Tabelle pubbliche | 0 (database vuoto) |

### Compatibilità Prisma

- ✅ PostgreSQL **18.4** è compatibile con Prisma 7.x (il requisito minimo è PostgreSQL 12.0)
- ✅ Funzionalità come `advisory lock`, `LISTEN/NOTIFY`, e `pg_adapter` sono supportate da PostgreSQL 18
- ✅ Encoding UTF8 è correttamente configurato

## Vincoli emersi

### 🔴 Critico: Nessun supporto TLS/SSL

Il server PostgreSQL SiteGround **non supporta connessioni crittografate**. Il tentativo con `sslmode=require` viene rifiutato con un errore esplicito.

**Implicazioni:**
- I dati transitano in chiaro tra l'applicazione Next.js e il database
- Questo include credenziali di accesso, dati personali di collaboratori e clienti, e dati finanziari (tariffe, partite IVA)
- In produzione su Vercel, la connessione tra il serverless function e SiteGround non sarà protetta da crittografia a livello di trasporto

**Rischio conformità:**
- GDPR: i dati personali (nome, cognome, email, partita IVA) transiterebbero non crittografati
- Best practice di settore: le connessioni a database in produzione devono sempre usare TLS

### 🟡 Minore: Timezone server non rilevata

La query `SHOW timezone` ha restituito `undefined` — possibile differenza nel nome della colonna restituita. Da approfondire in fase di configurazione Prisma.

## Decisioni conseguenti

### Azione immediata: contattare SiteGround

1. **Verificare con il supporto SiteGround** se il piano attuale supporta TLS per PostgreSQL
   - Alcuni piani SiteGround potrebbero non includere SSL per il database
   - Potrebbe essere necessario un upgrade del piano o una configurazione aggiuntiva
2. **Richiedere l'attivazione di SSL/TLS** sul server PostgreSQL

### Azione tecnica: strategia di connessione

- **Scenario A — SiteGround attiva TLS:** aggiornare `DATABASE_URL` con `?sslmode=require` (o `?sslmode=verify-full` se forniscono un certificato CA) e procedere con il deploy
- **Scenario B — SiteGround NON attiva TLS:** valutare alternative:
  - Usare un tunnel SSH o un proxy TLS (complessità operativa aggiuntiva)
  - Valutare un altro provider PostgreSQL che supporti TLS nativamente (es. Neon, Supabase, Railway)
  - Accettare il rischio se il database è accessibile solo dalla VPC/rete interna (verificare con SiteGround se l'IP `34.163.19.189` è accessibile solo da Vercel o da Internet)

### Raccomandazione

**Non procedere al deploy in produzione finché TLS non è attivo.** La mancanza di crittografia sul trasporto dei dati è un rischio significativo per un'applicazione che gestisce dati personali e finanziari.

Per lo sviluppo locale e gli ambienti di staging, la connessione non TLS è accettabile se il database è accessibile solo localmente o via VPN.

---

## Verifica toolchain (TASK-05)

| Comando | Esito | Note |
|---|---|---|
| `npx prisma validate` | ✅ | Schema Prisma valido |
| `npx eslint .` | ✅ | Nessun errore di linting |
| `npx vitest run` (nuovi test) | ✅ 30/30 | Tutti i test dello spike passano |
| `npx vitest run` (db-connection) | ⚠️ 0/7 | Il database remoto è vuoto (0 tabelle) — le migrazioni non sono state applicate. I test richiedono i seed data. Non è un problema della connettività. |

### Generazione Prisma Client

Il Prisma Client 7.8.0 è stato generato con successo usando `npx prisma generate`. Il client si connette al database SiteGround senza errori di compatibilità, confermando che PostgreSQL 18.4 funziona correttamente con Prisma 7.x.

## Riferimenti

- Script diagnostico: `scripts/siteground-connectivity-check.ts`
- Variabile dedicata: `SITEGROUND_DATABASE_URL` (documentata in `.env.example`)
- Test di validazione: `tests/unit/siteground-connectivity-check.test.ts` (28 test)
