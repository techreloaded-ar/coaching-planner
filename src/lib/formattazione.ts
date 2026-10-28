const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

/** Formatta un importo in euro con il formato valuta italiano. */
export function formattaEuro(valore: number | string): string {
  return formattatoreEuro.format(Number(valore));
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
