import { describe, expect, it } from "vitest";
import {
  MESSAGGIO_ULTIMO_AMMINISTRATORE,
  violaProtezioneUltimoAmministratore,
  type OperazioneSuUtente,
} from "@/domain/anagrafiche/protezione-amministratore";
import type { Ruolo } from "@/domain/types";

interface CasoProtezione {
  descrizione: string;
  utente: { ruolo: Ruolo; attivo: boolean };
  operazione: OperazioneSuUtente;
  altriAmministratoriAttivi: number;
  atteso: boolean;
}

describe("violaProtezioneUltimoAmministratore", () => {
  it.each<CasoProtezione>([
    {
      descrizione: "blocca l'invalidazione dell'ultimo amministratore attivo",
      utente: { ruolo: "AMMINISTRATORE", attivo: true },
      operazione: { tipo: "INVALIDAZIONE" },
      altriAmministratoriAttivi: 0,
      atteso: true,
    },
    {
      descrizione: "blocca la retrocessione dell'ultimo amministratore attivo",
      utente: { ruolo: "AMMINISTRATORE", attivo: true },
      operazione: { tipo: "CAMBIO_RUOLO", nuovoRuolo: "COLLABORATORE" },
      altriAmministratoriAttivi: 0,
      atteso: true,
    },
    {
      descrizione: "consente di mantenere il ruolo dell'ultimo amministratore attivo",
      utente: { ruolo: "AMMINISTRATORE", attivo: true },
      operazione: { tipo: "CAMBIO_RUOLO", nuovoRuolo: "AMMINISTRATORE" },
      altriAmministratoriAttivi: 0,
      atteso: false,
    },
    {
      descrizione: "consente l'invalidazione con un altro amministratore attivo",
      utente: { ruolo: "AMMINISTRATORE", attivo: true },
      operazione: { tipo: "INVALIDAZIONE" },
      altriAmministratoriAttivi: 1,
      atteso: false,
    },
    {
      descrizione: "consente la retrocessione con un altro amministratore attivo",
      utente: { ruolo: "AMMINISTRATORE", attivo: true },
      operazione: { tipo: "CAMBIO_RUOLO", nuovoRuolo: "COLLABORATORE" },
      altriAmministratoriAttivi: 1,
      atteso: false,
    },
    {
      descrizione: "non protegge l'invalidazione di un collaboratore",
      utente: { ruolo: "COLLABORATORE", attivo: true },
      operazione: { tipo: "INVALIDAZIONE" },
      altriAmministratoriAttivi: 0,
      atteso: false,
    },
    {
      descrizione: "non protegge la promozione di un collaboratore",
      utente: { ruolo: "COLLABORATORE", attivo: true },
      operazione: { tipo: "CAMBIO_RUOLO", nuovoRuolo: "AMMINISTRATORE" },
      altriAmministratoriAttivi: 0,
      atteso: false,
    },
    {
      descrizione: "non protegge l'invalidazione di un amministratore gia inattivo",
      utente: { ruolo: "AMMINISTRATORE", attivo: false },
      operazione: { tipo: "INVALIDAZIONE" },
      altriAmministratoriAttivi: 0,
      atteso: false,
    },
  ])("$descrizione", ({ utente, operazione, altriAmministratoriAttivi, atteso }) => {
    expect(
      violaProtezioneUltimoAmministratore(
        utente,
        operazione,
        altriAmministratoriAttivi
      )
    ).toBe(atteso);
  });

  it("espone un messaggio di errore non vuoto", () => {
    expect(MESSAGGIO_ULTIMO_AMMINISTRATORE.trim()).not.toBe("");
  });
});
