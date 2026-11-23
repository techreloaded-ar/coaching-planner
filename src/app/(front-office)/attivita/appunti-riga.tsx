"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";

/**
 * Appunti del copia e incolla di una riga attività.
 *
 * Vivono nel layout dell'area attività, accanto alle cache della scheda, per
 * due ragioni: la copia parte anche dal dettaglio giornata e dalla vista
 * Elenco e prosegue sul calendario, e la risposta della Server Action di
 * incolla può far rimontare la pagina del calendario — selezione ed esito non
 * devono andare persi in quel passaggio. Un ricaricamento della pagina o il
 * cambio di foglio consultato li azzerano.
 */

export interface AppuntiRiga {
  /** Riga copiata: la fotografia che verrà incollata così com'è. */
  riga: RigaAttivitaClient;
  /** Giorno YYYY-MM-DD della riga copiata: non è una destinazione. */
  giornoOrigine: string;
  /** Destinazioni scelte, YYYY-MM-DD in ordine crescente. */
  giorniScelti: string[];
}

export interface EsitoIncolla {
  riga: RigaAttivitaClient;
  /** Giorni su cui la riga è stata incollata, in ordine crescente. */
  giorni: string[];
}

export interface ApiAppuntiRiga {
  appunti: AppuntiRiga | null;
  esito: EsitoIncolla | null;
  /** Mette la riga negli appunti e apre la modalità incolla. */
  copia(riga: RigaAttivitaClient): void;
  /** Sostituisce le destinazioni scelte. */
  impostaGiorni(giorni: string[]): void;
  /** Esce dalla modalità incolla senza scrivere nulla. */
  annulla(): void;
  /** Chiude la modalità incolla dopo una conferma riuscita e ne registra l'esito. */
  incollata(giorni: string[]): void;
  /** Chiude il messaggio d'esito. */
  chiudiEsito(): void;
}

const ContestoAppuntiRiga = createContext<ApiAppuntiRiga | null>(null);

export function AppuntiRigaProvider({ children }: { children: ReactNode }) {
  const [appunti, setAppunti] = useState<AppuntiRiga | null>(null);
  const [esito, setEsito] = useState<EsitoIncolla | null>(null);

  const api = useMemo<ApiAppuntiRiga>(
    () => ({
      appunti,
      esito,
      copia: (riga) => {
        setEsito(null);
        setAppunti({ riga, giornoOrigine: riga.data, giorniScelti: [] });
      },
      impostaGiorni: (giorni) =>
        setAppunti((correnti) => (correnti ? { ...correnti, giorniScelti: giorni } : correnti)),
      annulla: () => setAppunti(null),
      incollata: (giorni) => {
        if (appunti) setEsito({ riga: appunti.riga, giorni });
        setAppunti(null);
      },
      chiudiEsito: () => setEsito(null),
    }),
    [appunti, esito]
  );

  return <ContestoAppuntiRiga.Provider value={api}>{children}</ContestoAppuntiRiga.Provider>;
}

/** Appunti della scheda; `null` fuori dall'area attività. */
export function useAppuntiRiga(): ApiAppuntiRiga | null {
  return useContext(ContestoAppuntiRiga);
}
