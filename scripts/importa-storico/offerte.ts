// Passo OFFERTE: una per (cliente, codice); createdAt = 1° gennaio dell'anno in "Data".

import type { Prisma } from "@/generated/prisma/client";
import { LUNGHEZZA_MASSIMA_CODICE } from "@/domain/anagrafiche/valida-offerta";
import { CODICE_OFFERTA_MANCANTE, leggiNumero, normalizzaTesto } from "@/domain/righe-sospese/abbinamento";
import type { Configurazione } from "./configurazione";
import { cella, leggiScheda, richiediColonne } from "./foglio";

export interface EsitoOfferte {
  inserite: number;
  attive: number;
  forfettarie: number;
  senzaCodice: number;
  /** Clienti presenti solo nella scheda offerte, creati con la sola ragione sociale */
  clientiCreati: string[];
  duplicate: string[];
  escluse: number;
  scartate: string[];
}

export async function importaOfferte(tx: Prisma.TransactionClient, cfg: Configurazione): Promise<EsitoOfferte> {
  const scheda = await leggiScheda(cfg, cfg.schede.offerte);
  richiediColonne(scheda, cfg.schede.offerte, ["Data", "Cliente", "Offerta"]);

  const clienti = await tx.cliente.findMany({ select: { id: true, ragioneSociale: true } });
  const idCliente = new Map(clienti.map((c) => [normalizzaTesto(c.ragioneSociale), c.id]));
  const esito: EsitoOfferte = { inserite: 0, attive: 0, forfettarie: 0, senzaCodice: 0, clientiCreati: [], duplicate: [], escluse: 0, scartate: [] };
  const viste = new Set<string>();
  const daInserire: Prisma.OffertaCreateManyInput[] = [];

  for (const [indice, riga] of scheda.righe.entries()) {
    const numeroRiga = indice + 2;
    const nomeCliente = cella(riga, "Cliente").replace(/\s+/g, " ");
    if (!nomeCliente) continue;
    if (cfg.clientiEsclusi.has(normalizzaTesto(nomeCliente))) { esito.escluse++; continue; }

    const anno = Number(/\b(19|20)\d{2}\b/.exec(cella(riga, "Data"))?.[0]);
    if (!anno) { esito.scartate.push(`riga ${numeroRiga} (${nomeCliente}): anno non leggibile "${cella(riga, "Data")}"`); continue; }

    let clienteId = idCliente.get(normalizzaTesto(nomeCliente));
    if (!clienteId) {
      clienteId = (await tx.cliente.create({ data: { ragioneSociale: nomeCliente }, select: { id: true } })).id;
      idCliente.set(normalizzaTesto(nomeCliente), clienteId);
      esito.clientiCreati.push(nomeCliente);
    }

    let codice = cella(riga, "Offerta").replace(/\s+/g, " ").replace(/\.0$/, "");
    if (!codice) { codice = CODICE_OFFERTA_MANCANTE; esito.senzaCodice++; }
    if (codice.length > LUNGHEZZA_MASSIMA_CODICE) { esito.scartate.push(`riga ${numeroRiga} (${nomeCliente}): codice più lungo di ${LUNGHEZZA_MASSIMA_CODICE} caratteri`); continue; }
    const chiave = `${clienteId}|${normalizzaTesto(codice)}`;
    if (viste.has(chiave)) { esito.duplicate.push(`${nomeCliente} / ${codice} (${anno})`); continue; }
    viste.add(chiave);

    const forfettaria = /^forfait/i.test(cella(riga, "Tipologia Spese"));
    const speseForfait = leggiNumero(cella(riga, "Spese Forfait"));
    const tariffa = leggiNumero(cella(riga, "Tariffa Giornaliera", "Tariffa giornaliera venduta al cliente"));
    const giorni = leggiNumero(cella(riga, "Numero Giornate Previste"));
    const stato = normalizzaTesto(cella(riga, "STATO", "Attiva"));
    const attiva = stato === "APERTA" || /^S[IÌ]$/.test(stato);

    daInserire.push({
      codice,
      descrizione: cella(riga, "Descrizione"),
      clienteId,
      // Tariffa assente nel foglio: resta 0, nessun valore predefinito
      tariffaGiornaliera: (tariffa && tariffa > 0 ? tariffa : 0).toFixed(2),
      giorniPrevisti: giorni && giorni > 0 ? Math.round(giorni) : 0,
      gestioneTrasferta: forfettaria ? "FORFETTARIA" : "INCLUSA",
      importoTrasfertaForfettaria: forfettaria ? (speseForfait && speseForfait > 0 ? speseForfait : cfg.importoTrasfertaForfettariaPredefinito).toFixed(2) : null,
      attiva,
      numeroOrdine: cella(riga, "Numero Ordine / BEF") || null,
      accountAgileReloaded: cella(riga, "Account") || null,
      createdAt: new Date(Date.UTC(anno, 0, 1, 12)),
      updatedAt: new Date(Date.UTC(anno, 0, 1, 12)),
    });
    esito.inserite++;
    esito.attive += attiva ? 1 : 0;
    esito.forfettarie += forfettaria ? 1 : 0;
  }
  await tx.offerta.createMany({ data: daInserire });
  return esito;
}
