import type { RigaAttivitaClient } from "@/lib/attivita-contract";
import { ETICHETTA_OFFERTA_DA_DEFINIRE, sommaOre } from "@/domain/types";

/**
 * Filtri dell'Elenco attività. Stringa vuota = filtro non applicato.
 *
 * Vivono nell'URL (`?vista=elenco&cliente=…&offerta=…&nota=…`), così tornando
 * dalla giornata l'Elenco si riapre come era stato lasciato.
 */
export interface FiltriElenco {
  cliente: string;
  /** Id offerta, oppure `OFFERTA_DA_DEFINIRE` per le righe senza offerta. */
  offerta: string;
  nota: string;
}

export const FILTRI_VUOTI: FiltriElenco = { cliente: "", offerta: "", nota: "" };

/** Valore del filtro offerta che seleziona le righe con offerta da definire. */
export const OFFERTA_DA_DEFINIRE = "da-definire";

export interface OpzioneFiltro {
  valore: string;
  etichetta: string;
}

function valoreOfferta(riga: RigaAttivitaClient): string {
  return riga.offerta?.id ?? OFFERTA_DA_DEFINIRE;
}

function normalizza(testo: string): string {
  return testo.trim().toLocaleLowerCase("it-IT");
}

/** Clienti presenti nelle righe del mese, in ordine alfabetico. */
export function opzioniClienti(righe: readonly RigaAttivitaClient[]): OpzioneFiltro[] {
  const perId = new Map<string, string>();
  for (const riga of righe) perId.set(riga.cliente.id, riga.cliente.ragioneSociale);
  return [...perId]
    .map(([valore, etichetta]) => ({ valore, etichetta }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, "it-IT"));
}

/** Offerte presenti nelle righe del mese, ristrette al cliente se scelto. */
export function opzioniOfferte(
  righe: readonly RigaAttivitaClient[],
  cliente: string
): OpzioneFiltro[] {
  const perValore = new Map<string, string>();
  for (const riga of righe) {
    if (cliente && riga.cliente.id !== cliente) continue;
    perValore.set(
      valoreOfferta(riga),
      riga.offerta
        ? `${riga.offerta.codice} — ${riga.offerta.descrizione}`
        : ETICHETTA_OFFERTA_DA_DEFINIRE
    );
  }
  return [...perValore]
    .map(([valore, etichetta]) => ({ valore, etichetta }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, "it-IT"));
}

/**
 * Filtri davvero applicabili alle righe del mese: un cliente o un'offerta che
 * nel mese non compaiono (es. dopo il cambio mese) valgono «Tutti», invece di
 * svuotare l'elenco con una scelta che la tendina non può mostrare.
 */
export function filtriEffettivi(
  righe: readonly RigaAttivitaClient[],
  filtri: FiltriElenco
): FiltriElenco {
  const cliente = opzioniClienti(righe).some((o) => o.valore === filtri.cliente)
    ? filtri.cliente
    : "";
  const offerta = opzioniOfferte(righe, cliente).some((o) => o.valore === filtri.offerta)
    ? filtri.offerta
    : "";
  return { cliente, offerta, nota: filtri.nota };
}

/** Righe che soddisfano tutti i filtri; la ricerca nella nota ignora maiuscole. */
export function filtraRigheElenco(
  righe: readonly RigaAttivitaClient[],
  filtri: FiltriElenco
): RigaAttivitaClient[] {
  const ricerca = normalizza(filtri.nota);
  return righe.filter(
    (riga) =>
      (!filtri.cliente || riga.cliente.id === filtri.cliente) &&
      (!filtri.offerta || valoreOfferta(riga) === filtri.offerta) &&
      (!ricerca || normalizza(riga.nota ?? "").includes(ricerca))
  );
}

/** Totale ore e rimborsi (in euro, stringa a 2 decimali) delle righe date. */
export function totaliElenco(righe: readonly RigaAttivitaClient[]): {
  ore: number;
  rimborsi: string;
} {
  const centesimi = righe.reduce(
    (totale, riga) =>
      totale + Math.round(Number(riga.rimborsoTrasfertaImporto ?? 0) * 100),
    0
  );
  return {
    ore: sommaOre(...righe.map((riga) => riga.ore)),
    rimborsi: (centesimi / 100).toFixed(2),
  };
}

/**
 * Divide la nota nei tratti che corrispondono alla ricerca (da evidenziare) e
 * in quelli che non corrispondono, senza cambiarne maiuscole e minuscole.
 */
export function segmentiNota(
  nota: string,
  ricerca: string
): { testo: string; trovato: boolean }[] {
  const cercato = normalizza(ricerca);
  if (!cercato) return [{ testo: nota, trovato: false }];

  const minuscola = nota.toLocaleLowerCase("it-IT");
  const segmenti: { testo: string; trovato: boolean }[] = [];
  let da = 0;
  for (let i = minuscola.indexOf(cercato); i !== -1; i = minuscola.indexOf(cercato, da)) {
    if (i > da) segmenti.push({ testo: nota.slice(da, i), trovato: false });
    segmenti.push({ testo: nota.slice(i, i + cercato.length), trovato: true });
    da = i + cercato.length;
  }
  if (da < nota.length) segmenti.push({ testo: nota.slice(da), trovato: false });
  return segmenti;
}

/** Query string dei soli filtri valorizzati, senza `?`. */
export function queryFiltri(filtri: FiltriElenco): string {
  const parametri = new URLSearchParams();
  if (filtri.cliente) parametri.set("cliente", filtri.cliente);
  if (filtri.offerta) parametri.set("offerta", filtri.offerta);
  if (filtri.nota.trim()) parametri.set("nota", filtri.nota.trim());
  return parametri.toString();
}

/** Legge i filtri da una query string (`?` facoltativo); valori non stringa ⇒ vuoti. */
export function filtriDaQuery(query: string): FiltriElenco {
  const parametri = new URLSearchParams(query);
  return {
    cliente: parametri.get("cliente") ?? "",
    offerta: parametri.get("offerta") ?? "",
    nota: parametri.get("nota") ?? "",
  };
}

/**
 * URL dell'Elenco per un mese (o per il mese corrente, senza token) con i
 * filtri dati. Il collaboratore consultato si aggiunge con `urlDelFoglio`.
 */
export function urlElenco(token: string | null, filtri: FiltriElenco): string {
  const filtriQuery = queryFiltri(filtri);
  return `/attivita?${token ? `mese=${token}&` : ""}vista=elenco${filtriQuery ? `&${filtriQuery}` : ""}`;
}
