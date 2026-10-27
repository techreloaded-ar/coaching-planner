import type { RisultatoReportFatturazione } from "@/lib/report";
import type { Cella, FoglioXlsx } from "@/lib/xlsx";

// Trasforma il report mensile di fatturazione nei fogli di un file Excel.
// Nessun ricalcolo: gli importi sono quelli (già arrotondati) del dominio.
// Le uniche somme sono le giornate di cliente e mese, come fa lo schermo.

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
      "Rimborsi trasferta",
      "Totale da fatturare",
    ].map(grassetto),
  ];

  let giornateMese = 0;

  for (const cliente of report.perCliente) {
    let giornateCliente = 0;

    for (const offerta of cliente.perOfferta) {
      giornateCliente += offerta.giornateFatturabili;
      righeRiepilogo.push([
        cliente.clienteRagioneSociale,
        offerta.offertaCodice,
        offerta.offertaDescrizione,
        importo(offerta.tariffaGiornaliera),
        giornate(offerta.giornateFatturabili),
        importo(offerta.imponibile),
        null,
        null,
      ]);
    }

    giornateMese += giornateCliente;
    righeRiepilogo.push([
      grassetto(`Totale ${cliente.clienteRagioneSociale}`),
      null,
      null,
      null,
      giornate(giornateCliente),
      importoGrassetto(cliente.imponibileManodopera),
      importoGrassetto(cliente.rimborsiTrasferta),
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
    importoGrassetto(report.totali.totaleRimborsi),
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
      larghezzeColonne: [34, 16, 40, 14, 12, 20, 18, 20],
    },
    {
      nome: "Dettaglio collaboratori",
      righe: righeDettaglio,
      larghezzeColonne: [34, 16, 30, 16, 12, 16],
    },
  ];
}
