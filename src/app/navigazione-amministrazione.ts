// Voci di amministrazione della sidebar, ciascuna con il permesso della pagina
// di destinazione. Modulo puro: nessuna dipendenza da React o Next.

import type { Permesso } from "@/domain/permessi";

const ICONA_CLIENTI = "M3 21V8.5L9 4l6 4.5V21M15 21h6V11l-6-3M7.5 21v-4.5h3V21M7 9.5h.01M11 9.5h.01M7 13h.01M11 13h.01";
const ICONA_OFFERTE = "M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM14 3v6h6M8 13h8M8 17h5";
const ICONA_PERSONE = "M9 4.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM2.8 19.4a6.2 6.2 0 0 1 12.4 0M17.2 6.8a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM15.4 14.6a5 5 0 0 1 5.8 4.8";
const ICONA_VOCI_RIMBORSO = "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11ZM12 7.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z";
const ICONA_IMPORTAZIONE = "M12 3v12M7 10l5 5 5-5M4 21h16";
const ICONA_FATTURAZIONE_CLIENTI = "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM8 12h5M16 9.5a4 4 0 1 0 0 5.2";
const ICONA_FATTURAZIONE_COLLABORATORI = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M16 21a4 4 0 0 0-8 0M12 11a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z";
const ICONA_MARGINALITA = "M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6";

export interface VoceAmministrazione {
  href: string;
  etichetta: string;
  icona: string;
  permesso: Permesso;
}

export interface GruppoAmministrazione {
  titolo: string;
  voci: readonly VoceAmministrazione[];
}

/** Voci di amministrazione: pagine server con dati sempre freschi, navigazione documentale. */
export const GRUPPI_AMMINISTRAZIONE: readonly GruppoAmministrazione[] = [
  {
    titolo: "Anagrafica",
    voci: [
      { href: "/anagrafiche/clienti", etichetta: "Clienti", icona: ICONA_CLIENTI, permesso: "GESTIRE_CLIENTI" },
      { href: "/offerte", etichetta: "Offerte", icona: ICONA_OFFERTE, permesso: "GESTIRE_OFFERTE" },
      { href: "/anagrafiche/persone", etichetta: "Persone", icona: ICONA_PERSONE, permesso: "GESTIRE_UTENTI" },
      { href: "/anagrafiche/voci-rimborso", etichetta: "Voci di rimborso", icona: ICONA_VOCI_RIMBORSO, permesso: "GESTIRE_VOCI_RIMBORSO" },
      { href: "/importazione", etichetta: "Importazione", icona: ICONA_IMPORTAZIONE, permesso: "GESTIRE_IMPORTAZIONE" },
    ],
  },
  {
    titolo: "Reportistica",
    voci: [
      { href: "/report/fatturazione-clienti", etichetta: "Fatturazione clienti", icona: ICONA_FATTURAZIONE_CLIENTI, permesso: "CONSULTARE_REPORT_FATTURAZIONE_CLIENTI" },
      { href: "/report/fatturazione-collaboratori", etichetta: "Fatturazione collaboratori", icona: ICONA_FATTURAZIONE_COLLABORATORI, permesso: "CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI" },
      { href: "/report/marginalita", etichetta: "Marginalità", icona: ICONA_MARGINALITA, permesso: "CONSULTARE_REPORT_MARGINALITA" },
    ],
  },
];

/** Gruppi con le sole voci consentite dai permessi; i gruppi vuoti spariscono, titolo compreso. */
export function gruppiAmministrazioneVisibili(permessi: readonly Permesso[]): GruppoAmministrazione[] {
  return GRUPPI_AMMINISTRAZIONE
    .map((gruppo) => ({ ...gruppo, voci: gruppo.voci.filter((voce) => permessi.includes(voce.permesso)) }))
    .filter((gruppo) => gruppo.voci.length > 0);
}
