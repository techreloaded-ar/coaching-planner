/**
 * Import dello storico (CLIENTI, OFFERTE, COACH, GIORNATE) nel Coaching Planner.
 *
 * Uso:
 *   npm run db:importa-storico -- [tutto|clienti|offerte|coach|rimborsi|giornate] [--dry-run] [--reset] [--config <file>]
 *
 * Il comando è lo stesso da bash/zsh (Mac, Linux) e da PowerShell: da PowerShell il `--`
 * viene consumato dalla shell e npm trattiene i flag come npm_config_*, che argomenti.ts
 * recupera (vedi lì per i dettagli).
 *
 * - Legge la configurazione da scripts/importa-storico/.env.importa-storico (vedi .example).
 * - Prima di toccare i dati rigenera il client Prisma (nello script npm) e controlla che il
 *   database della configurazione abbia tutte le migrazioni.
 * - Scrive in un'unica transazione; con --dry-run la annulla alla fine (report compreso).
 * - Senza --reset le anagrafiche sono additive: clienti per ragione sociale, offerte per
 *   cliente e codice, coach per email (l'ID del foglio), voci di rimborso per etichetta.
 *   Ciò che esiste non si tocca. Le giornate invece non hanno una chiave: quelle con data
 *   precedente a GIORNATE_REIMPORTA_DAL restano congelate nel database, quelle da quella data
 *   in poi vengono cancellate e reimportate dal foglio.
 * - Con --reset svuota prima tutte le tabelle applicative (utenti e voci di rimborso
 *   compresi): le voci di rimborso vengono ricreate subito dopo dalla configurazione.
 * - Le righe dei clienti in CLIENTI_ESCLUSI (predefinito: ND) vengono saltate in ogni passo
 *   e contate nel riepilogo come righeDiClientiEsclusi / offerteDiClientiEsclusi.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import { caricaConfigurazione, PERCORSO_CONFIGURAZIONE_PREDEFINITO, type Configurazione } from "./configurazione";
import { preparaClienti, scriviClienti, type ClientiPreparati } from "./clienti";
import { importaOfferte } from "./offerte";
import { importaCoach } from "./coach";
import { importaRimborsi } from "./rimborsi";
import { importaGiornate } from "./giornate";
import { normalizzaTesto } from "../../src/domain/righe-sospese/abbinamento";
import { verificaClientPrisma, verificaMigrazioni } from "./ambiente";
import { leggiArgomenti } from "./argomenti";

class ProvaASecco extends Error {}

async function azzeraTabelle(tx: Prisma.TransactionClient): Promise<void> {
  await tx.rigaAttivitaSospesa.deleteMany();
  await tx.voceRimborsoTrasferta.deleteMany();
  await tx.rigaAttivita.deleteMany();
  await tx.abilitazioneOfferta.deleteMany();
  await tx.eventoCalendarioGestito.deleteMany();
  await tx.promemoriaFineMeseInviato.deleteMany();
  await tx.collegamentoCalendarioGoogle.deleteMany();
  await tx.tariffaCollaboratore.deleteMany();
  await tx.collaboratore.deleteMany();
  await tx.offerta.deleteMany();
  await tx.cliente.deleteMany();
  await tx.session.deleteMany();
  await tx.account.deleteMany();
  await tx.utente.deleteMany();
}

async function main(): Promise<void> {
  const opzioni = leggiArgomenti(process.argv.slice(2), PERCORSO_CONFIGURAZIONE_PREDEFINITO, process.env);
  const cfg: Configurazione = caricaConfigurazione(opzioni.config);
  console.log(`Origine: ${cfg.origineFoglio}\nPassi: ${opzioni.passi.join(", ")}${opzioni.dryRun ? " (prova a secco)" : ""}${opzioni.reset ? " con azzeramento" : ""}\n`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cfg.databaseUrl }) });
  const riepilogo: Record<string, unknown> = {};
  try {
    verificaClientPrisma(prisma);
    await verificaMigrazioni(prisma);

    // L'inferenza con Claude è lenta e non scrive: fuori dalla transazione, solo per i clienti nuovi.
    let clientiPreparati: ClientiPreparati | undefined;
    if (opzioni.passi.includes("clienti")) {
      console.log("Clienti: lettura scheda e inferenza dei dati di fatturazione");
      const esistenti = opzioni.reset ? [] : await prisma.cliente.findMany({ select: { ragioneSociale: true } });
      clientiPreparati = await preparaClienti(cfg, new Set(esistenti.map((c) => normalizzaTesto(c.ragioneSociale))));
    }

    await prisma.$transaction(
      async (tx) => {
        if (opzioni.reset) {
          await azzeraTabelle(tx);
          console.log("Tabelle applicative azzerate");
        }
        for (const passo of opzioni.passi) {
          console.log(`\n▶ ${passo}`);
          riepilogo[passo] =
            passo === "clienti" ? await scriviClienti(tx, clientiPreparati!)
            : passo === "offerte" ? await importaOfferte(tx, cfg)
            : passo === "coach" ? await importaCoach(tx, cfg)
            : passo === "rimborsi" ? await importaRimborsi(tx, cfg)
            : await importaGiornate(tx, cfg, { reset: opzioni.reset });
          console.log(JSON.stringify(riepilogo[passo], null, 2));
        }
        if (opzioni.dryRun) throw new ProvaASecco();
      },
      { maxWait: 30_000, timeout: 60 * 60_000 },
    );
    console.log("\n✅ Import completato e salvato.");
  } catch (errore) {
    if (errore instanceof ProvaASecco) console.log("\nℹ️  Prova a secco: nessuna scrittura salvata (il report delle righe sospese è stato comunque scritto).");
    else throw errore;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((errore: Error) => {
  console.error(`\n❌ ${errore.message}`);
  process.exit(1);
});
