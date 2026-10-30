import type { RisultatoReportFatturazione } from "@/lib/report";
import type { Cella, FoglioXlsx } from "@/lib/xlsx";

// Trasforma il report mensile di fatturazione nei fogli di un file Excel.
// Nessun ricalcolo: gli importi sono quelli (già arrotondati) del dominio.
// Le uniche somme sono le giornate (lavorate e di trasferta) di cliente e mese.

function importo(valore: string): Cella {
  return { valore: Number(valore), stile: "importo" };
}

function importoGrassetto(valore: string): Cella {
  return { valore: Number(valore), stile: "importoGrassetto" };
}

function giornate(valore: number): Cella {
  return { valore, stile: "giornate" };
}

function grassetto(valore: string): Cella {
  return { valore, stile: "grassetto" };
}

/** Nome del file scaricato per il mese indicato (token YYYY-MM). */
export function nomeFileFatturazioneClienti(token: string): string {
  return `fatturazione-clienti-${token}.xlsx`;
}

/**
 * Costruisce i due fogli dell'esportazione: il riepilogo per cliente/offerta
 * con i totali e il dettaglio dei collaboratori per offerta.
 */
export function costruisciFogliFatturazioneClienti(
  report: RisultatoReportFatturazione,
  etichettaMese: string,
): FoglioXlsx[] {
  const righeRiepilogo: Cella[][] = [
    [grassetto(`Fatturazione clienti — ${etichettaMese}`)],
    [],
    [
      "Cliente",
      "Codice offerta",
      "Descrizione offerta",
      "Tariffa/gg",
      "Giornate",
      "Imponibile manodopera",
      "Giorni trasferta",
      "Trasferte forfettarie",
      "Totale da fatturare",
    ].map(grassetto),
  ];

  let giornateMese = 0;
  let giorniTrasfertaMese = 0;

  for (const cliente of report.perCliente) {
    let giornateCliente = 0;
    let giorniTrasfertaCliente = 0;

    for (const offerta of cliente.perOfferta) {
      giornateCliente += offerta.giornateFatturabili;
      giorniTrasfertaCliente += offerta.giorniTrasferta;
      righeRiepilogo.push([
        cliente.clienteRagioneSociale,
        offerta.offertaCodice,
        offerta.offertaDescrizione,
        offerta.tariffaGiornaliera === null ? null : importo(offerta.tariffaGiornaliera),
        giornate(offerta.giornateFatturabili),
        importo(offerta.imponibile),
        giornate(offerta.giorniTrasferta),
        importo(offerta.importoTrasferte),
        null,
      ]);
    }

    giornateMese += giornateCliente;
    giorniTrasfertaMese += giorniTrasfertaCliente;
    righeRiepilogo.push([
      grassetto(`Totale ${cliente.clienteRagioneSociale}`),
      null,
      null,
      null,
      giornate(giornateCliente),
      importoGrassetto(cliente.imponibileManodopera),
      giornate(giorniTrasfertaCliente),
      importoGrassetto(cliente.trasferteForfettarie),
      importoGrassetto(cliente.importoTotale),
    ]);
  }

  righeRiepilogo.push([
    grassetto("Totale mese"),
    null,
    null,
    null,
    giornate(giornateMese),
    importoGrassetto(report.totali.imponibileManodopera),
    giornate(giorniTrasfertaMese),
    importoGrassetto(report.totali.totaleTrasferteForfettarie),
    importoGrassetto(report.totali.importoTotale),
  ]);

  const righeDettaglio: Cella[][] = [
    [grassetto(`Dettaglio collaboratori — ${etichettaMese}`)],
    [],
    [
      "Cliente",
      "Codice offerta",
      "Collaboratore",
      "Ore fatturabili",
      "Giornate",
      "Imponibile",
    ].map(grassetto),
  ];

  for (const cliente of report.perCliente) {
    for (const offerta of cliente.perOfferta) {
      for (const voce of offerta.perCollaboratore) {
        righeDettaglio.push([
          cliente.clienteRagioneSociale,
          offerta.offertaCodice,
          voce.collaboratoreNome,
          giornate(voce.oreFatturabili),
          giornate(voce.giornateFatturabili),
          importo(voce.imponibile),
        ]);
      }
    }
  }

  return [
    {
      nome: "Fatturazione clienti",
      righe: righeRiepilogo,
      larghezzeColonne: [34, 16, 40, 14, 12, 20, 16, 20, 20],
    },
    {
      nome: "Dettaglio collaboratori",
      righe: righeDettaglio,
      larghezzeColonne: [34, 16, 30, 16, 12, 16],
    },
  ];
}
