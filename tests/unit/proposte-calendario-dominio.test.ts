import { describe, expect, it } from "vitest";
import {
  finestraRichiestaGiorno,
  oreDaDurata,
  proposteDaEventi,
  TITOLO_EVENTO_SENZA_TITOLO,
  type EventoGoogle,
} from "@/domain/calendario-google";

// Ottobre 2026: Europe/Rome è in ora legale (UTC+2) fino al 25 ottobre.
const GIORNO = "2026-10-21";

function evento(parziale: Partial<EventoGoogle> & { id: string }): EventoGoogle {
  return {
    status: "confirmed",
    summary: `Evento ${parziale.id}`,
    start: { dateTime: `${GIORNO}T09:00:00+02:00` },
    end: { dateTime: `${GIORNO}T10:00:00+02:00` },
    ...parziale,
  };
}

describe("oreDaDurata", () => {
  it("arrotonda la durata al quarto d'ora più vicino", () => {
    const inizio = new Date("2026-10-21T07:00:00Z");
    expect(oreDaDurata(inizio, new Date("2026-10-21T08:30:00Z"))).toBe(1.5);
    expect(oreDaDurata(inizio, new Date("2026-10-21T07:50:00Z"))).toBe(0.75);
    expect(oreDaDurata(inizio, new Date("2026-10-21T07:53:00Z"))).toBe(1);
    expect(oreDaDurata(inizio, new Date("2026-10-21T07:05:00Z"))).toBe(0);
  });

  it("limita a 24 ore e azzera durate nulle o negative", () => {
    const inizio = new Date("2026-10-21T07:00:00Z");
    expect(oreDaDurata(inizio, new Date("2026-10-23T07:00:00Z"))).toBe(24);
    expect(oreDaDurata(inizio, inizio)).toBe(0);
    expect(oreDaDurata(inizio, new Date("2026-10-21T06:00:00Z"))).toBe(0);
  });
});

describe("proposteDaEventi (US-002)", () => {
  it("propone gli eventi del giorno con titolo, orario e ore (AC-1, AC-2)", () => {
    const proposte = proposteDaEventi(
      [
        evento({
          id: "workshop",
          summary: "Workshop",
          start: { dateTime: `${GIORNO}T14:00:00+02:00` },
          end: { dateTime: `${GIORNO}T17:00:00+02:00` },
        }),
        evento({
          id: "riunione",
          summary: "Riunione",
          description: "  Agenda  ",
          start: { dateTime: `${GIORNO}T09:00:00+02:00` },
          end: { dateTime: `${GIORNO}T10:30:00+02:00` },
        }),
      ],
      GIORNO
    );

    expect(proposte).toEqual([
      { eventoId: "riunione", titolo: "Riunione", descrizione: "Agenda", inizio: "09:00", fine: "10:30", ore: 1.5, dominiPartecipanti: [] },
      { eventoId: "workshop", titolo: "Workshop", descrizione: "", inizio: "14:00", fine: "17:00", ore: 3, dominiPartecipanti: [] },
    ]);
  });

  it("esclude eventi di intera giornata, rifiutati, annullati e di durata nulla (AC-3)", () => {
    const proposte = proposteDaEventi(
      [
        evento({ id: "intera-giornata", start: { date: GIORNO }, end: { date: "2026-10-22" } }),
        evento({
          id: "rifiutato",
          attendees: [
            { self: false, responseStatus: "accepted" },
            { self: true, responseStatus: "declined" },
          ],
        }),
        evento({ id: "annullato", status: "cancelled" }),
        evento({
          id: "durata-nulla",
          end: { dateTime: `${GIORNO}T09:05:00+02:00` },
        }),
        evento({
          id: "accettato",
          attendees: [{ self: true, responseStatus: "accepted" }],
        }),
      ],
      GIORNO
    );

    expect(proposte.map((p) => p.eventoId)).toEqual(["accettato"]);
  });

  it("attribuisce l'evento al giorno civile di Europe/Rome (AC-4)", () => {
    const eventi = [
      // 23:00 a Roma del 21 = 21:00Z del 21
      evento({
        id: "serale",
        start: { dateTime: "2026-10-21T21:00:00Z" },
        end: { dateTime: "2026-10-21T22:30:00Z" },
      }),
      // 00:30 a Roma del 22 = 22:30Z del 21: appartiene al giorno dopo
      evento({
        id: "notte-successiva",
        start: { dateTime: "2026-10-21T22:30:00Z" },
        end: { dateTime: "2026-10-21T23:30:00Z" },
      }),
    ];

    expect(proposteDaEventi(eventi, "2026-10-21").map((p) => [p.eventoId, p.inizio])).toEqual([
      ["serale", "23:00"],
    ]);
    expect(proposteDaEventi(eventi, "2026-10-22").map((p) => [p.eventoId, p.inizio])).toEqual([
      ["notte-successiva", "00:30"],
    ]);
  });

  it("non ripropone gli eventi già confermati o rifiutati (US-004 AC-5)", () => {
    const proposte = proposteDaEventi(
      [evento({ id: "gestito" }), evento({ id: "nuovo" })],
      GIORNO,
      new Set(["gestito"])
    );

    expect(proposte.map((p) => p.eventoId)).toEqual(["nuovo"]);
  });

  it("non propone mai gli eventi «Fuori sede» (US-002 incremento)", () => {
    const proposte = proposteDaEventi(
      [
        evento({ id: "fuori-sede", eventType: "outOfOffice", summary: "Fuori sede" }),
        evento({ id: "riunione", eventType: "default" }),
      ],
      GIORNO
    );

    expect(proposte.map((p) => p.eventoId)).toEqual(["riunione"]);
  });

  it("raccoglie i domini dei partecipanti senza duplicati né il dominio del collaboratore (US-001 incremento)", () => {
    const [proposta] = proposteDaEventi(
      [
        evento({
          id: "sync",
          attendees: [
            { email: "io@agilereloaded.it", self: true, responseStatus: "accepted" },
            { email: "collega@agilereloaded.it", responseStatus: "accepted" },
            { email: "mario@Pippo.com", responseStatus: "accepted" },
            { email: "anna@pippo.com", responseStatus: "needsAction" },
            { email: "luca@beta.it" },
            { responseStatus: "accepted" },
          ],
        }),
      ],
      GIORNO
    );

    expect(proposta.dominiPartecipanti).toEqual(["pippo.com", "beta.it"]);
  });

  it("usa un titolo di ripiego per gli eventi senza titolo", () => {
    const [proposta] = proposteDaEventi([evento({ id: "anonimo", summary: "  " })], GIORNO);
    expect(proposta.titolo).toBe(TITOLO_EVENTO_SENZA_TITOLO);
  });
});

describe("finestraRichiestaGiorno", () => {
  it("copre l'intero giorno civile con margine sull'offset del fuso", () => {
    expect(finestraRichiestaGiorno("2026-10-21")).toEqual({
      timeMin: "2026-10-20T12:00:00.000Z",
      timeMax: "2026-10-22T12:00:00.000Z",
    });
  });
});
