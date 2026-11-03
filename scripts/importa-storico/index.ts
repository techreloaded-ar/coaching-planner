/**
 * Import dello storico (CLIENTI, OFFERTE, COACH, GIORNATE) nel Coaching Planner.
 *
 * Uso:
 *   npm run db:importa-storico -- [tutto|clienti|offerte|coach|giornate] [--dry-run] [--reset] [--config <file>]
 *
 * - Legge la configurazione da scripts/importa-storico/.env.importa-storico (vedi .example).
 * - Scrive in un'unica transazione; con --dry-run la annulla alla fine (report compreso).
 * - Senza --reset aggiunge solo ciò che manca: clienti per ragione sociale, offerte per
 *   cliente e codice, coach per email (l'ID del foglio), voci di rimborso per etichetta,
 *   righe attività per collaboratore, data, cliente e offerta. Ciò che esiste non si tocca.
 * - Con --reset svuota prima tutte le tabelle applicative (utenti compresi, voci di
 *   rimborso escluse).
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

const PASSI = ["clienti", "offerte", "coach", "rimborsi", "giornate"] as const;
type Passo = (typeof PASSI)[number];

class ProvaASecco extends Error {}

function leggiArgomenti(argv: string[]) {
  const opzioni = { passi: [...PASSI] as Passo[], dryRun: false, reset: false, config: PERCORSO_CONFIGURAZIONE_PREDEFINITO };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opzioni.dryRun = true;
    else if (a === "--reset") opzioni.reset = true;
    else if (a === "--config") opzioni.config = argv[++i] ?? "";
    else if (a === "tutto") opzioni.passi = [...PASSI];
    else if ((PASSI as readonly string[]).includes(a)) opzioni.passi = [a as Passo];
    else throw new Error(`Argomento non riconosciuto: ${a}\nUso: [tutto|${PASSI.join("|")}] [--dry-run] [--reset] [--config <file>]`);
  }
  return opzioni;
}

async function azzeraTabelle(tx: Prisma.TransactionClient): Promise<void> {
  await tx.rigaAttivitaSospesa.deleteMany();
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
  const opzioni = leggiArgomenti(process.argv.slice(2));
  const cfg: Configurazione = caricaConfigurazione(opzioni.config);
  console.log(`Origine: ${cfg.origineFoglio}\nPassi: ${opzioni.passi.join(", ")}${opzioni.dryRun ? " (prova a secco)" : ""}${opzioni.reset ? " con azzeramento" : ""}\n`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cfg.databaseUrl }) });
  const riepilogo: Record<string, unknown> = {};
  try {
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
            : await importaGiornate(tx, cfg);
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
