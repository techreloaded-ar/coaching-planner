import {
  UNITA_TARIFFA,
  etichettaPercentualeTrattenuta,
  type ModalitaTariffa,
} from "@/domain/tariffe";

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

/** Ore e giornate: virgola decimale, al massimo due decimali, senza zeri finali. */
const formattatoreQuantita = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Numero di ore senza unità, es. "6,5", "8", "7,25". */
export function formattaNumeroOre(ore: number): string {
  return formattatoreQuantita.format(ore);
}

/** Ore con unità, es. "6,5 h", "8 h", "7,25 h". */
export function formattaOre(ore: number): string {
  return `${formattaNumeroOre(ore)} h`;
}

/** Numero di giornate senza unità, es. "3,63", "2". */
export function formattaNumeroGiornate(giornate: number): string {
  return formattatoreQuantita.format(giornate);
}

/** Giornate con unità, es. "3,63 gg", "2 gg". */
export function formattaGiornate(giornate: number): string {
  return `${formattaNumeroGiornate(giornate)} gg`;
}

/** Formatta un importo in euro con il formato valuta italiano; «—» se assente. */
export function formattaEuro(valore: number | string | null): string {
  return valore === null ? "—" : formattatoreEuro.format(Number(valore));
}

/** Importo di una tariffa con la sua unità, es. "450,00 € / giorno" o "20% trattenuta". */
export function descriviImportoTariffa(modalita: ModalitaTariffa, importo: string): string {
  return modalita === "PERCENTUALE"
    ? etichettaPercentualeTrattenuta(importo)
    : `${formattaEuro(importo)} ${UNITA_TARIFFA[modalita]}`;
}

/** Iniziali della ragione sociale di un cliente per avatar quadrati. */
export function inizialiCliente(ragioneSociale: string): string {
  return ragioneSociale
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

/** Etichetta della gestione trasferte di un'offerta, es. "Trasferta forfettaria · 80,00 €/gg". */
export function descriviGestioneTrasferta(
  gestioneTrasferta: "INCLUSA" | "FORFETTARIA",
  importoTrasfertaForfettaria: string | null,
): string {
  if (gestioneTrasferta === "FORFETTARIA" && importoTrasfertaForfettaria !== null) {
    return `Trasferta forfettaria · ${formattaEuro(importoTrasfertaForfettaria)}/gg`;
  }
  return "Trasferta inclusa";
}
