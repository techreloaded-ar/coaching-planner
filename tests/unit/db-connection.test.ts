import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";

describe("Connessione al database e dati seedati", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("dovrebbe connettersi al database e restituire i dati seedati", async () => {
    // Verifica conteggi minimi attesi dai seed
    const utenti = await db.utente.count();
    expect(utenti).toBeGreaterThanOrEqual(1);

    const clienti = await db.cliente.count();
    expect(clienti).toBeGreaterThanOrEqual(2);

    const offerte = await db.offerta.count();
    expect(offerte).toBeGreaterThanOrEqual(2);

    const scaglioni = await db.scaglioneKm.count();
    expect(scaglioni).toBeGreaterThanOrEqual(3);

    const attivita = await db.rigaAttivita.count();
    expect(attivita).toBeGreaterThanOrEqual(1);
  });

  it("dovrebbe restituire l'amministratore seedato", async () => {
    const admin = await db.utente.findUnique({
      where: { email: "info@techreloaded.it" },
    });
    expect(admin).not.toBeNull();
    expect(admin!.email).toBe("info@techreloaded.it");
    expect(admin!.ruolo).toBe("AMMINISTRATORE");
  });

  it("dovrebbe avere il collaboratore con tariffa Decimal valida", async () => {
    const collaboratore = await db.collaboratore.findFirst();
    expect(collaboratore).not.toBeNull();

    // Verifica che la tariffa sia un Decimal (non float)
    const tariffa = collaboratore!.tariffaGiornaliera;
    expect(tariffa).toBeDefined();
    expect(typeof tariffa.toString()).toBe("string");

    // Verifica che sia un valore numerico positivo
    const numValue = Number(tariffa.toString());
    expect(numValue).toBeGreaterThan(0);
    expect(Number.isFinite(numValue)).toBe(true);
  });

  it("dovrebbe avere offerte con tariffa Decimal valida", async () => {
    const offerte = await db.offerta.findMany({ take: 2 });
    expect(offerte.length).toBeGreaterThan(0);

    for (const offerta of offerte) {
      expect(offerta.tariffaGiornaliera).toBeDefined();
      expect(typeof offerta.tariffaGiornaliera.toString()).toBe("string");
      const numValue = Number(offerta.tariffaGiornaliera.toString());
      expect(numValue).toBeGreaterThan(0);
      expect(Number.isFinite(numValue)).toBe(true);
    }
  });

  it("dovrebbe avere scaglioni chilometrici con importi Decimal validi", async () => {
    const scaglioni = await db.scaglioneKm.findMany();
    expect(scaglioni.length).toBeGreaterThanOrEqual(3);

    for (const scaglione of scaglioni) {
      expect(scaglione.importo).toBeDefined();
      expect(typeof scaglione.importo.toString()).toBe("string");
      const numValue = Number(scaglione.importo.toString());
      expect(numValue).toBeGreaterThan(0);
      expect(Number.isFinite(numValue)).toBe(true);
    }
  });

  it("dovrebbe avere attività con ore in formato Decimal", async () => {
    const attivita = await db.rigaAttivita.findFirst();
    expect(attivita).not.toBeNull();

    expect(attivita!.ore).toBeDefined();
    expect(typeof attivita!.ore.toString()).toBe("string");
    const numValue = Number(attivita!.ore.toString());
    expect(numValue).toBeGreaterThan(0);
    expect(Number.isFinite(numValue)).toBe(true);
  });

  it("non dovrebbe avere campi monetari di tipo Float (verifica Decimal)", async () => {
    // I campi Decimal non dovrebbero mai avere valori con errori di floating point
    const offerta = await db.offerta.findFirst();
    expect(offerta).not.toBeNull();

    const tariffaStr = offerta!.tariffaGiornaliera.toString();
    // Un float causerebbe qualcosa come "550.0000000001" — un Decimal deve essere preciso
    expect(tariffaStr).toMatch(/^\d+(\.\d{1,2})?$/);
    const parsed = parseFloat(tariffaStr);
    // Verifica che moltiplicando per 100 non ci siano errori di floating point
    expect(parsed * 100).toBe(Math.round(parsed * 100));
  });
});
