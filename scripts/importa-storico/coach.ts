// Passo COACH: un Utente per riga, profilo Collaboratore con la tariffa iniziale.
// La colonna ID è la chiave usata dalla scheda GIORNATE nella colonna Coach.

import type { Prisma } from "@/generated/prisma/client";
import { validaCensimentoUtente } from "@/domain/anagrafiche/valida-utente";
import { leggiNumero, normalizzaTesto } from "@/domain/righe-sospese/abbinamento";
import type { Configurazione } from "./configurazione";
import { cella, leggiScheda, richiediColonne, type SchedaLetta } from "./foglio";

export interface EsitoCoach {
  utenti: number;
  giaPresenti: number;
  amministratori: number;
}

/** "BEATRICE" → "Beatrice", "DE CANDIA" → "De Candia" */
function inMaiuscoloIniziale(valore: string): string {
  const pulito = valore.trim().replace(/\s+/g, " ");
  return pulito === pulito.toUpperCase() || pulito === pulito.toLowerCase()
    ? pulito.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (c) => c.toUpperCase())
    : pulito;
}

function modalitaTariffa(tipologia: string): "GIORNALIERA" | "FISSO_MENSILE" | null {
  if (/giorn/i.test(tipologia)) return "GIORNALIERA";
  if (/fiss|mens/i.test(tipologia)) return "FISSO_MENSILE";
  return null;
}

export async function leggiSchedaCoach(cfg: Configurazione): Promise<SchedaLetta> {
  const scheda = await leggiScheda(cfg, cfg.schede.coach);
  richiediColonne(scheda, cfg.schede.coach, ["ID", "Nome", "Cognome", "Email"]);
  return scheda;
}

/** ID della scheda coach (normalizzato) → email minuscola. */
export function mappaIdCoachEmail(scheda: SchedaLetta): Map<string, string> {
  return new Map(scheda.righe.filter((r) => cella(r, "ID")).map((r) => [normalizzaTesto(cella(r, "ID")), cella(r, "Email").toLowerCase()]));
}

export async function importaCoach(tx: Prisma.TransactionClient, cfg: Configurazione): Promise<EsitoCoach> {
  const scheda = await leggiSchedaCoach(cfg);
  const esito: EsitoCoach = { utenti: 0, giaPresenti: 0, amministratori: 0 };
  // L'ID del foglio non è nel database: l'utente esiste se esiste la sua email
  const emailEsistenti = new Set((await tx.utente.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()));
  const emailViste = new Set<string>();
  const idVisti = new Set<string>();

  for (const [indice, riga] of scheda.righe.entries()) {
    const id = normalizzaTesto(cella(riga, "ID"));
    if (!id) continue;
    const numeroRiga = indice + 2;
    const email = cella(riga, "Email").toLowerCase();
    const nome = inMaiuscoloIniziale(cella(riga, "Nome"));
    const cognome = inMaiuscoloIniziale(cella(riga, "Cognome"));
    const modalita = modalitaTariffa(cella(riga, "Tipologia", "Tipo Tariffa"));
    const importo = leggiNumero(cella(riga, "Importo", "Tariffa"));
    const partitaIva = cella(riga, "Partita Iva");
    const amministratore = cfg.emailAmministratori.has(email);

    if (idVisti.has(id)) throw new Error(`Scheda coach, riga ${numeroRiga}: ID "${id}" ripetuto`);
    if (emailViste.has(email)) throw new Error(`Scheda coach, riga ${numeroRiga}: email "${email}" ripetuta`);
    idVisti.add(id);
    emailViste.add(email);
    if (emailEsistenti.has(email)) { esito.giaPresenti++; continue; }
    if (!modalita || !importo) throw new Error(`Scheda coach, riga ${numeroRiga} (${id}): tipologia o importo tariffa non leggibili`);
    const errori = validaCensimentoUtente({
      nome, cognome, email, partitaIva,
      ruoloAmministratore: amministratore, ruoloCollaboratore: true,
      modalitaTariffa: modalita, importoTariffa: importo.toFixed(2), tariffaValidaDalMese: cfg.primoMeseTariffa,
    });
    if (Object.keys(errori).length) throw new Error(`Scheda coach, riga ${numeroRiga} (${id}): ${Object.values(errori).join("; ")}`);

    await tx.utente.create({
      data: {
        nome, cognome, email,
        ruolo: amministratore ? "AMMINISTRATORE" : "COLLABORATORE",
        collaboratore: {
          create: {
            nome, cognome,
            partitaIva: partitaIva || null,
            tariffe: { create: { validaDalMese: cfg.primoMeseTariffa, modalita, importo: importo.toFixed(2) } },
          },
        },
      },
    });
    esito.utenti++;
    esito.amministratori += amministratore ? 1 : 0;
  }
  return esito;
}
