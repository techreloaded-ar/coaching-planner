import {
  UNITA_TARIFFA,
  etichettaPercentualeTrattenuta,
  type ModalitaTariffa,
} from "@/domain/tariffe";

/**
 * Formattatore numerico italiano dell'applicazione: il separatore delle
 * migliaia c'è sempre. Di default `Intl` in italiano lo omette sotto le
 * 10.000 unità («7010» invece di «7.010»): `useGrouping: "always"` lo forza.
 */
export function formattatoreNumeri(opzioni: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return new Intl.NumberFormat("it-IT", { ...opzioni, useGrouping: "always" });
}

/** Numero con separatore delle migliaia, al massimo due decimali di default, es. "7.010", "1.234,5". */
export function formattaNumero(valore: number, opzioni: Intl.NumberFormatOptions = {}): string {
  return formattatoreNumeri({ maximumFractionDigits: 2, ...opzioni }).format(valore);
}

const formattatoreEuro = formattatoreNumeri({ style: "currency", currency: "EUR" });

const formattatoreEuroArrotondato = formattatoreNumeri({
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Ore e giornate: virgola decimale, al massimo due decimali, senza zeri finali. */
const formattatoreQuantita = formattatoreNumeri({
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

/** Formatta un importo in euro con il formato valuta italiano, es. "7.010,00 €"; «—» se assente. */
export function formattaEuro(valore: number | string | null): string {
  return valore === null ? "—" : formattatoreEuro.format(Number(valore));
}

/** Importo in euro all'unità, senza decimali, es. "7.010 €". */
export function formattaEuroArrotondato(valore: number | string): string {
  return formattatoreEuroArrotondato.format(Number(valore));
}

/** Importo in euro col simbolo davanti, es. "€ 7.010,00" (tabelle dell'area attività). */
export function formattaEuroConSimboloDavanti(valore: number | string): string {
  return `€ ${formattaNumero(Number(valore), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
