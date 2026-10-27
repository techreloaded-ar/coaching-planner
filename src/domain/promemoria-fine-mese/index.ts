// Dominio Promemoria di fine mese — funzioni pure
// Ultimo giorno lavorativo del mese e contenuto dell'email al collaboratore.
// Nessuna dipendenza dal framework.

import {
  etichettaMese,
  giornoSpostatoDi,
  meseSuccessivo,
  parseDataGiorno,
} from "../calendario";

function cadeNelWeekend(giorno: string): boolean {
  const giornoSettimana = new Date(`${giorno}T00:00:00Z`).getUTCDay();
  return giornoSettimana === 0 || giornoSettimana === 6;
}

/**
 * Ultimo giorno lunedì–venerdì del mese `YYYY-MM`, come `YYYY-MM-DD`.
 * Le festività non sono considerate.
 */
export function ultimoGiornoLavorativoDelMese(mese: string): string {
  let giorno = giornoSpostatoDi(`${meseSuccessivo(mese)}-01`, -1);
  while (cadeNelWeekend(giorno)) giorno = giornoSpostatoDi(giorno, -1);
  return giorno;
}

/** true se `giorno` (`YYYY-MM-DD`) è l'ultimo giorno lavorativo del suo mese. */
export function eUltimoGiornoLavorativoDelMese(giorno: string): boolean {
  if (!parseDataGiorno(giorno)) return false;
  return giorno === ultimoGiornoLavorativoDelMese(giorno.slice(0, 7));
}

export interface ContenutoEmail {
  oggetto: string;
  testo: string;
}

/** Oggetto e testo dell'email che ricorda di chiudere il mese e fatturare. */
export function contenutoEmailPromemoriaFineMese({
  nome,
  mese,
  urlApplicazione,
}: {
  nome: string;
  /** Token `YYYY-MM` */
  mese: string;
  urlApplicazione: string;
}): ContenutoEmail {
  const etichetta = etichettaMese(mese).toLowerCase();
  const link = `${urlApplicazione.replace(/\/+$/, "")}/attivita`;
  return {
    oggetto: `Promemoria di fine mese: coaching planner e fattura di ${etichetta}`,
    testo: [
      `Ciao ${nome},`,
      "",
      `il mese sta per chiudersi: ricordati di completare la compilazione del coaching planner di ${etichetta} e di emettere la fattura del mese.`,
      "",
      `Puoi completare le attività qui: ${link}`,
      "",
      "Coaching Planner",
    ].join("\n"),
  };
}
