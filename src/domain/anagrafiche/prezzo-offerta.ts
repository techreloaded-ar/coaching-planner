// Calcolo del prezzo di un'offerta (funzioni pure, senza dipendenze da framework).
//
// Un'offerta si prezza in due modi esclusivi:
// - a giornata: si inseriscono tariffa e giorni, l'importo totale è tariffa × giorni;
// - a corpo: si inseriscono importo e giorni, la tariffa è importo ÷ giorni,
//   arrotondata al centesimo (metà per eccesso).
// Gli importi viaggiano in centesimi (bigint) per evitare errori di virgola mobile.

const RE_IMPORTO = /^\d+(?:[.,]\d{1,2})?$/;
const RE_GIORNI = /^\d+$/;

/**
 * Importo in centesimi da un testo digitato ("10.000" non è ammesso: un solo
 * separatore, decimale, con virgola o punto). `null` se vuoto o non valido.
 */
export function centesimiDaTesto(valore: string): bigint | null {
  const pulito = valore.trim().replace(/\s+/g, "");
  if (!RE_IMPORTO.test(pulito)) return null;
  const [intera, decimale = ""] = pulito.replace(",", ".").split(".");
  return BigInt(intera) * BigInt(100) + BigInt(decimale.padEnd(2, "0"));
}

/** Giorni previsti da un testo digitato: intero positivo, altrimenti `null`. */
export function giorniDaTesto(valore: string): number | null {
  const pulito = valore.trim();
  if (!RE_GIORNI.test(pulito)) return null;
  const giorni = parseInt(pulito, 10);
  return giorni > 0 ? giorni : null;
}

/** Importo totale di un'offerta a giornata: tariffa × giorni. */
export function importoTotaleCentesimi(tariffaCentesimi: bigint, giorni: number): bigint {
  return tariffaCentesimi * BigInt(giorni);
}

/**
 * Tariffa giornaliera di un'offerta a corpo: importo ÷ giorni arrotondato al
 * centesimo, con la metà per eccesso (es. 10.000,00 € ÷ 15 = 666,67 €).
 */
export function tariffaACorpoCentesimi(importoCentesimi: bigint, giorni: number): bigint {
  const divisore = BigInt(giorni);
  return (importoCentesimi * BigInt(2) + divisore) / (divisore * BigInt(2));
}

/** Centesimi nel formato decimale per il database, es. 66667n → "666.67". */
export function centesimiInDecimale(centesimi: bigint): string {
  const intera = centesimi / BigInt(100);
  const decimale = (centesimi % BigInt(100)).toString().padStart(2, "0");
  return `${intera}.${decimale}`;
}

/** Centesimi nel formato di un campo del form, es. 66667n → "666,67". */
export function centesimiInCampo(centesimi: bigint): string {
  return centesimiInDecimale(centesimi).replace(".", ",");
}

/**
 * Importo totale di un'offerta salvata, in formato decimale ("10000.00"):
 * l'importo a corpo se l'offerta è a corpo, altrimenti tariffa × giorni
 * previsti. `null` se non calcolabile (valori mancanti).
 */
export function importoTotaleOfferta(offerta: {
  modalitaPrezzo: string;
  tariffaGiornaliera: string | null;
  giorniPrevisti: number | null;
  importoACorpo: string | null;
}): string | null {
  if (offerta.modalitaPrezzo === "A_CORPO") {
    const importo = offerta.importoACorpo === null ? null : centesimiDaTesto(offerta.importoACorpo);
    return importo === null ? null : centesimiInDecimale(importo);
  }
  const tariffa =
    offerta.tariffaGiornaliera === null ? null : centesimiDaTesto(offerta.tariffaGiornaliera);
  if (tariffa === null || !offerta.giorniPrevisti || offerta.giorniPrevisti <= 0) return null;
  return centesimiInDecimale(importoTotaleCentesimi(tariffa, offerta.giorniPrevisti));
}
