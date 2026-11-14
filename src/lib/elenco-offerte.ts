import {
  leggiPosizioneElenco,
  leggiPosizioneElencoDaForm,
  type PosizioneElenco,
} from "@/lib/paginazione";

/** Stato dell'elenco offerte, condiviso da URL, form e lettura dei dati. */
export interface FiltriElencoOfferte extends PosizioneElenco {
  soloDaPresidiare: boolean;
}

export interface ParametriElencoOfferte {
  q?: string | string[];
  pagina?: string | string[];
  daPresidiare?: string | string[];
}

export function leggiFiltriElencoOfferte(
  parametri: ParametriElencoOfferte,
): FiltriElencoOfferte {
  const valore = Array.isArray(parametri.daPresidiare)
    ? parametri.daPresidiare[0]
    : parametri.daPresidiare;
  return {
    ...leggiPosizioneElenco(parametri),
    soloDaPresidiare: valore === "1",
  };
}

export function leggiFiltriElencoOfferteDaForm(formData: FormData): FiltriElencoOfferte {
  return {
    ...leggiPosizioneElencoDaForm(formData),
    soloDaPresidiare: formData.get("daPresidiare") === "1",
  };
}

export function parametriFiltroOfferte(soloDaPresidiare: boolean): Record<string, string> {
  return soloDaPresidiare ? { daPresidiare: "1" } : {};
}
