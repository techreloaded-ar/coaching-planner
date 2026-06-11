import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("🌱 Avvio seed del database...\n");

  // Pulisci i dati esistenti in ordine di dipendenza (figli prima dei genitori)
  await prisma.rigaAttivita.deleteMany();
  await prisma.offerta.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.collaboratore.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.utente.deleteMany();
  await prisma.scaglioneKm.deleteMany();
  console.log("🧹 Dati esistenti rimossi.\n");

  // ── Scaglioni Chilometrici ──────────────────────────────────
  const scaglioni = await Promise.all([
    prisma.scaglioneKm.create({
      data: { finoAKm: 50, importo: "35.00" },
    }),
    prisma.scaglioneKm.create({
      data: { finoAKm: 100, importo: "60.00" },
    }),
    prisma.scaglioneKm.create({
      data: { finoAKm: 250, importo: "110.00" },
    }),
  ]);
  console.log(`✓ Creati ${scaglioni.length} scaglioni chilometrici`);

  // ── Utente Amministratore ────────────────────────────────────
  const admin = await prisma.utente.create({
    data: {
      nome: "Marco Bianchi",
      email: "admin@coachingplanner.local",
      ruolo: "AMMINISTRATORE",
    },
  });
  console.log(`✓ Creato amministratore: ${admin.nome} (${admin.email})`);

  // ── Collaboratore ────────────────────────────────────────────
  const collaboratore = await prisma.collaboratore.create({
    data: {
      userId: admin.id,
      nome: "Marco",
      cognome: "Bianchi",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
    },
  });
  console.log(
    `✓ Creato collaboratore: ${collaboratore.nome} ${collaboratore.cognome} (tariffa €${collaboratore.tariffaGiornaliera}/giorno)`
  );

  // ── Cliente 1 ────────────────────────────────────────────────
  const cliente1 = await prisma.cliente.create({
    data: {
      ragioneSociale: "TechSolutions Srl",
      partitaIva: "IT98765432109",
      indirizzo: "Via Roma 42",
      citta: "Milano",
      cap: "20121",
      provincia: "MI",
    },
  });
  console.log(`✓ Creato cliente: ${cliente1.ragioneSociale}`);

  // ── Offerta 1 (cliente 1) ────────────────────────────────────
  const offerta1 = await prisma.offerta.create({
    data: {
      codice: "TS-2025-01",
      descrizione: "Consulenza architetturale cloud migration",
      clienteId: cliente1.id,
      tariffaGiornaliera: "550.00",
      giorniPrevisti: 40,
    },
  });
  console.log(
    `✓ Creata offerta: ${offerta1.codice} — ${offerta1.descrizione} (€${offerta1.tariffaGiornaliera}/g × ${offerta1.giorniPrevisti} gg)`
  );

  // ── Cliente 2 ────────────────────────────────────────────────
  const cliente2 = await prisma.cliente.create({
    data: {
      ragioneSociale: "DataFlow SpA",
      partitaIva: "IT11223344556",
      indirizzo: "Corso Italia 15",
      citta: "Torino",
      cap: "10122",
      provincia: "TO",
    },
  });
  console.log(`✓ Creato cliente: ${cliente2.ragioneSociale}`);

  // ── Offerta 2 (cliente 2) ────────────────────────────────────
  const offerta2 = await prisma.offerta.create({
    data: {
      codice: "DF-2025-02",
      descrizione: "Sviluppo dashboard analytics",
      clienteId: cliente2.id,
      tariffaGiornaliera: "480.00",
      giorniPrevisti: 25,
    },
  });
  console.log(
    `✓ Creata offerta: ${offerta2.codice} — ${offerta2.descrizione} (€${offerta2.tariffaGiornaliera}/g × ${offerta2.giorniPrevisti} gg)`
  );

  // ── Cliente 3 (inattivo) ─────────────────────────────────────
  const cliente3 = await prisma.cliente.create({
    data: {
      ragioneSociale: "GreenEnergy Srl",
      partitaIva: "IT55667788900",
      indirizzo: "Via Verdi 8",
      citta: "Bologna",
      cap: "40121",
      provincia: "BO",
      attivo: false,
    },
  });
  console.log(`✓ Creato cliente (inattivo): ${cliente3.ragioneSociale}`);

  // ── Offerta 3 (cliente 3, non attiva) ────────────────────────
  await prisma.offerta.create({
    data: {
      codice: "GE-2024-03",
      descrizione: "Audit energetico — concluso",
      clienteId: cliente3.id,
      tariffaGiornaliera: "420.00",
      giorniPrevisti: 10,
      attiva: false,
    },
  });
  console.log(`✓ Creata offerta: GE-2024-03 (non attiva)`);

  // ── Attività dimostrative ────────────────────────────────────
  const attivita = await Promise.all([
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: new Date("2025-06-02"),
        ore: "8.00",
        nota: "Analisi requisiti architetturali",
        fatturabile: true,
      },
    }),
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: new Date("2025-06-03"),
        ore: "6.50",
        nota: "Stesura documento di architettura",
        fatturabile: true,
        trasfertaKm: 45,
      },
    }),
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente2.id,
        offertaId: offerta2.id,
        data: new Date("2025-06-04"),
        ore: "7.00",
        nota: "Setup ambiente di sviluppo",
        fatturabile: true,
      },
    }),
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: new Date("2025-06-05"),
        ore: "4.00",
        nota: "Attività non fatturabile — formazione interna",
        fatturabile: false,
      },
    }),
  ]);
  console.log(`✓ Create ${attivita.length} attività dimostrative`);

  console.log("\n✅ Seed completato con successo!");
}

main()
  .catch((e) => {
    console.error("❌ Errore durante il seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
