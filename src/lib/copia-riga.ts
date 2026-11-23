import type { RigaAttivitaClient } from "@/lib/attivita-contract";

/**
 * Regole pure del copia e incolla di una riga attività sul calendario.
 *
 * Nessuna dipendenza da React o dal browser: le stesse regole valgono per il
 * dettaglio giornata, il menu della cella del calendario, la vista Elenco e la
 * modalità incolla, e restano verificabili con test unitari.
 */

/**
 * Motivo per cui una riga non è copiabile, o `null` se lo è.
 *
 * La copia replica l'offerta della riga: un'offerta da definire, non più
 * attiva o non più abilitata per il collaboratore del foglio rende la riga non
 * copiabile. Il server applica le stesse condizioni alla conferma.
 */
export function motivoNonCopiabile(riga: RigaAttivitaClient): string | null {
  if (!riga.offerta) return "Offerta da definire: assegnala prima di copiare";
  if (!riga.offerta.attiva) return "Offerta non più attiva";
  if (riga.offertaNonAbilitata) return "Offerta non più abilitata";
  return null;
}

/** Esito dell'alternanza di un giorno fra le destinazioni. */
export type EsitoAlternanzaGiorno =
  | { tipo: "aggiunto" | "tolto"; giorni: string[] }
  | { tipo: "origine"; giorni: string[] };

/**
 * Un clic aggiunge il giorno alle destinazioni, un secondo clic lo toglie.
 * Il giorno di origine non è una destinazione: la selezione resta invariata.
 * Le destinazioni restano ordinate in modo crescente.
 */
export function alternaGiorno(
  giorniScelti: readonly string[],
  giorno: string,
  giornoOrigine: string
): EsitoAlternanzaGiorno {
  if (giorno === giornoOrigine) {
    return { tipo: "origine", giorni: [...giorniScelti] };
  }
  if (giorniScelti.includes(giorno)) {
    return { tipo: "tolto", giorni: giorniScelti.filter((g) => g !== giorno) };
  }
  return { tipo: "aggiunto", giorni: [...giorniScelti, giorno].sort() };
}

export interface GruppoMeseDestinazioni {
  /** Token YYYY-MM del mese */
  token: string;
  /** Giorni scelti nel mese, in ordine crescente */
  giorni: string[];
}

/** Raggruppa le destinazioni per mese, in ordine crescente di mese e giorno. */
export function raggruppaPerMese(giorni: readonly string[]): GruppoMeseDestinazioni[] {
  const gruppi: GruppoMeseDestinazioni[] = [];
  for (const giorno of [...giorni].sort()) {
    const token = giorno.slice(0, 7);
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.token === token) {
      ultimo.giorni.push(giorno);
    } else {
      gruppi.push({ token, giorni: [giorno] });
    }
  }
  return gruppi;
}

/** Mesi (token YYYY-MM) toccati da un insieme di giorni, senza ripetizioni. */
export function mesiDeiGiorni(giorni: readonly string[]): string[] {
  return [...new Set(giorni.map((giorno) => giorno.slice(0, 7)))].sort();
}

/** "1 giorno" / "N giorni" */
export function etichettaGiorni(quanti: number): string {
  return quanti === 1 ? "1 giorno" : `${quanti} giorni`;
}

function dataLocale(giorno: string): Date {
  const [anno, mese, numero] = giorno.split("-").map(Number);
  return new Date(anno, mese - 1, numero);
}

/** "11 novembre 2026" */
export function dataEstesa(giorno: string): string {
  return dataLocale(giorno).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "mer 11 nov" */
export function dataBreve(giorno: string): string {
  return dataLocale(giorno).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "nov" */
export function meseBreve(token: string): string {
  return dataLocale(`${token}-01`).toLocaleDateString("it-IT", { month: "short" });
}

/**
 * Elenco leggibile dei giorni incollati, raggruppati per mese:
 * "4, 12 e 19 novembre · 3 dicembre".
 */
export function descriviGiorni(giorni: readonly string[]): string {
  return raggruppaPerMese(giorni)
    .map(({ token, giorni: giorniMese }) => {
      const numeri = giorniMese.map((g) => String(Number(g.slice(8, 10))));
      const elenco =
        numeri.length === 1
          ? numeri[0]
          : `${numeri.slice(0, -1).join(", ")} e ${numeri[numeri.length - 1]}`;
      const mese = dataLocale(`${token}-01`).toLocaleDateString("it-IT", {
        month: "long",
      });
      const anno = token.slice(0, 4);
      return `${elenco} ${mese} ${anno}`;
    })
    .join(" · ");
}
