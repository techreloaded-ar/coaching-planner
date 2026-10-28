import { randomUUID } from "node:crypto";

import {
  dataNelMesePassatoRiservato,
  mesePassatoRiservato,
} from "./date";
import type { CreateRigaAttivitaOptions, E2eDataFactory } from "./factory";

export const CODICE_SPEC_MARGINALITA = "US-017-REPORT-MARGINALITA";

function dataRiservata(giorno: number, mesiIndietro: number): Date {
  return new Date(
    `${dataNelMesePassatoRiservato(CODICE_SPEC_MARGINALITA, giorno, mesiIndietro)}T00:00:00.000Z`,
  );
}

/**
 * Cliente con due offerte (A 600 €/gg, B 300 €/gg) e un collaboratore a 400 €/gg.
 * Mese 1 (due mesi fa): A 8h. Mese 2: A 4h, B 8h, più A 6h di Investimento
 * (né ricavo né costo) e B 2h Non fatturabile (costo senza ricavo).
 */
export async function creaDatasetMarginalita(factory: E2eDataFactory) {
  const suffisso = randomUUID().slice(0, 8);
  const cliente = await factory.createCliente({
    ragioneSociale: `E2E Marginalità ${suffisso}`,
  });
  const offertaA = await factory.createOfferta({
    cliente,
    codice: `MRG-A-${suffisso}`,
    descrizione: `Offerta A ${suffisso}`,
    tariffaGiornaliera: "600.00",
  });
  const offertaB = await factory.createOfferta({
    cliente,
    codice: `MRG-B-${suffisso}`,
    descrizione: `Offerta B ${suffisso}`,
    tariffaGiornaliera: "300.00",
  });
  const collaboratore = await factory.createCollaboratore({
    nome: "E2E Marginalità",
    cognome: suffisso,
    tariffaGiornaliera: "400.00",
    utenteOptions: { email: `marginalita-${suffisso}@marginalita.e2e.invalid` },
  });

  const riga = (
    offerta: typeof offertaA,
    giorno: number,
    mesiIndietro: number,
    ore: string,
    categoria: CreateRigaAttivitaOptions["categoria"] = "FATTURABILE",
  ) =>
    factory.createRigaAttivita({
      collaboratore,
      cliente,
      offerta,
      data: dataRiservata(giorno, mesiIndietro),
      ore,
      categoria,
      nota: `Marginalità ${suffisso} ${offerta.codice} ${giorno}`,
    });

  await riga(offertaA, 5, 2, "8.00");
  await riga(offertaA, 6, 1, "4.00");
  await riga(offertaB, 7, 1, "8.00");
  await riga(offertaA, 8, 1, "6.00", "INVESTIMENTO");
  await riga(offertaB, 9, 1, "2.00", "NON_FATTURABILE");

  return {
    cliente,
    offertaA,
    offertaB,
    meseUno: mesePassatoRiservato(CODICE_SPEC_MARGINALITA, 2),
    meseDue: mesePassatoRiservato(CODICE_SPEC_MARGINALITA, 1),
  };
}
