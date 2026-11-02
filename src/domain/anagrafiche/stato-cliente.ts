// Lo stato di un cliente non è memorizzato: è una conseguenza delle sue offerte.

export type TipoStatoCliente = "ATTIVO" | "NUOVO" | "NON_ATTIVO";

export interface StatoCliente {
  tipo: TipoStatoCliente;
  /** Offerte attive se ATTIVO, offerte chiuse se NON_ATTIVO, 0 se NUOVO. */
  numeroOfferte: number;
}

/** Tutti gli stati, nell'ordine con cui compaiono nel quick filter. */
export const TIPI_STATO_CLIENTE: readonly TipoStatoCliente[] = ["ATTIVO", "NUOVO", "NON_ATTIVO"];

/** Stati mostrati all'apertura dell'elenco clienti. */
export const TIPI_STATO_CLIENTE_PREDEFINITI: readonly TipoStatoCliente[] = ["ATTIVO", "NUOVO"];

/**
 * Attivo con almeno un'offerta attiva, nuovo senza offerte, non attivo con
 * offerte tutte chiuse.
 */
export function statoCliente(offerte: readonly { attiva: boolean }[]): StatoCliente {
  const offerteAttive = offerte.filter((offerta) => offerta.attiva).length;
  if (offerteAttive > 0) return { tipo: "ATTIVO", numeroOfferte: offerteAttive };
  if (offerte.length === 0) return { tipo: "NUOVO", numeroOfferte: 0 };
  return { tipo: "NON_ATTIVO", numeroOfferte: offerte.length };
}

/** Testo breve del chip: «3 attive», «Nuovo», «5 chiuse». */
export function etichettaStatoCliente({ tipo, numeroOfferte }: StatoCliente): string {
  if (tipo === "NUOVO") return "Nuovo";
  if (tipo === "ATTIVO") return `${numeroOfferte} ${numeroOfferte === 1 ? "attiva" : "attive"}`;
  return `${numeroOfferte} ${numeroOfferte === 1 ? "chiusa" : "chiuse"}`;
}

const VALORI_PARAMETRO: Record<TipoStatoCliente, string> = {
  ATTIVO: "attivi",
  NUOVO: "nuovi",
  NON_ATTIVO: "non-attivi",
};

/**
 * Legge il parametro URL `stato` («attivi,nuovi,non-attivi»). Valori
 * sconosciuti sono ignorati; nessuno stato valido equivale ai predefiniti.
 */
export function leggiFiltroStatoCliente(valore?: string | string[] | null): TipoStatoCliente[] {
  const testo = (Array.isArray(valore) ? valore[0] : valore) ?? "";
  const richiesti = new Set(testo.split(","));
  const stati = TIPI_STATO_CLIENTE.filter((tipo) => richiesti.has(VALORI_PARAMETRO[tipo]));
  return stati.length > 0 ? stati : [...TIPI_STATO_CLIENTE_PREDEFINITI];
}

/**
 * Parametri URL del filtro: vuoti per la selezione predefinita, così gli URL
 * restano puliti.
 */
export function parametriFiltroStatoCliente(stati: readonly TipoStatoCliente[]): Record<string, string> {
  const ordinati = TIPI_STATO_CLIENTE.filter((tipo) => stati.includes(tipo));
  const predefinito =
    ordinati.length === 0 ||
    (ordinati.length === TIPI_STATO_CLIENTE_PREDEFINITI.length &&
      ordinati.every((tipo) => TIPI_STATO_CLIENTE_PREDEFINITI.includes(tipo)));
  return predefinito ? {} : { stato: ordinati.map((tipo) => VALORI_PARAMETRO[tipo]).join(",") };
}
