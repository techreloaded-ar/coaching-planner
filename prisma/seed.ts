import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { eseguiBackfillAbilitazioniIniziali } from "../scripts/backfill-abilitazioni-iniziali";

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
  await prisma.voceRimborsoTrasferta.deleteMany();
  console.log("🧹 Dati esistenti rimossi.\n");

  // ── Voci di Rimborso Trasferta ──────────────────────────────
  const vociRimborsoTrasferta = await Promise.all([
    prisma.voceRimborsoTrasferta.create({
      data: { etichetta: "Rimborso trasferta breve", importo: "35.00" },
    }),
    prisma.voceRimborsoTrasferta.create({
      data: { etichetta: "Rimborso trasferta media distanza", importo: "60.00" },
    }),
    prisma.voceRimborsoTrasferta.create({
      data: { etichetta: "Rimborso trasferta lunga distanza", importo: "110.00" },
    }),
  ]);
  console.log(
    `✓ Create ${vociRimborsoTrasferta.length} voci di rimborso trasferta`,
  );

  // ── Utente Amministratore ────────────────────────────────────
  // Account Google reale per la demo.
  const admin = await prisma.utente.create({
    data: {
      nome: "Tech",
      cognome: "Reloaded",
      email: "info@techreloaded.it",
      ruolo: "AMMINISTRATORE",
    },
  });
  console.log(
    `✓ Creato amministratore: ${admin.nome} ${admin.cognome} (${admin.email})`,
  );

  // ── Utente Amministratore (Stefano Marello) ──────────────────
  const admin2 = await prisma.utente.create({
    data: {
      nome: "Stefano",
      cognome: "Marello",
      email: "stefano.marello@agilereloaded.it",
      ruolo: "AMMINISTRATORE",
    },
  });
  console.log(
    `✓ Creato amministratore: ${admin2.nome} ${admin2.cognome} (${admin2.email})`,
  );

  // ── Utente Collaboratore ─────────────────────────────────────
  // Utente distinto dall'amministratore, senza password.
  const collabUser = await prisma.utente.create({
    data: {
      nome: "Giulia",
      cognome: "Conti",
      email: "giulia.conti@agilereloaded.it",
      ruolo: "COLLABORATORE",
    },
  });
  console.log(
    `✓ Creato collaboratore: ${collabUser.nome} ${collabUser.cognome} (${collabUser.email})`,
  );

  // ── Profilo Collaboratore ────────────────────────────────────
  const collaboratore = await prisma.collaboratore.create({
    data: {
      userId: collabUser.id,
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "12345678901",
      tariffaGiornaliera: "350.00",
    },
  });
  console.log(
    `✓ Creato profilo collaboratore: ${collaboratore.nome} ${collaboratore.cognome} (tariffa €${collaboratore.tariffaGiornaliera}/giorno)`
  );

  // ── Secondo Utente Collaboratore (Marco Bianchi) ─────────────
  // Serve a dimostrare l'aggregazione per offerta nel report: più
  // collaboratori che lavorano sulla stessa offerta di un cliente.
  const secondoCollabUser = await prisma.utente.create({
    data: {
      nome: "Marco",
      cognome: "Bianchi",
      email: "marco.bianchi@agilereloaded.it",
      ruolo: "COLLABORATORE",
    },
  });
  console.log(
    `✓ Creato collaboratore: ${secondoCollabUser.nome} ${secondoCollabUser.cognome} (${secondoCollabUser.email})`
  );

  // ── Profilo Secondo Collaboratore ───────────────────────────
  const secondoCollaboratore = await prisma.collaboratore.create({
    data: {
      userId: secondoCollabUser.id,
      nome: "Marco",
      cognome: "Bianchi",
      partitaIva: "23456789012",
      tariffaGiornaliera: "300.00",
    },
  });
  console.log(
    `✓ Creato profilo collaboratore: ${secondoCollaboratore.nome} ${secondoCollaboratore.cognome} (tariffa €${secondoCollaboratore.tariffaGiornaliera}/giorno)`
  );

  // ── Cliente 1 ────────────────────────────────────────────────
  const cliente1 = await prisma.cliente.create({
    data: {
      ragioneSociale: "TechSolutions Srl",
      partitaIva: "98765432109",
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
      partitaIva: "11223344556",
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
      partitaIva: "55667788900",
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
  // Relative al mese corrente così che la vista di default mostri giorni consuntivati
  // e la demo resti valida nel tempo. Include giorni con attività multiple e varietà
  // di clienti/offerte.
  const oggi = new Date();
  const anno = oggi.getFullYear();
  const mese = oggi.getMonth(); // 0-based

  // Giorni del mese corrente per le attività demo: usiamo i primi giorni feriali disponibili
  function giornoDelMese(g: number): Date {
    return new Date(anno, mese, g);
  }

  const attivita = await Promise.all([
    // Giorno 2: 3 righe su 2 clienti diversi
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: giornoDelMese(2),
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
        data: giornoDelMese(2),
        ore: "2.50",
        nota: "Revisione documentazione tecnica",
        fatturabile: true,
      },
    }),
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente2.id,
        offertaId: offerta2.id,
        data: giornoDelMese(2),
        ore: "1.00",
        nota: "Call di allineamento",
        fatturabile: false,
      },
    }),
    // Giorno 3: 1 riga
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: giornoDelMese(3),
        ore: "6.50",
        nota: "Stesura documento di architettura",
        fatturabile: true,
        rimborsoTrasfertaEtichetta: "Rimborso trasferta breve",
        rimborsoTrasfertaImporto: "35.00",
      },
    }),
    // Giorno 4: 2 righe su offerte diverse (una include trasferta demo)
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente2.id,
        offertaId: offerta2.id,
        data: giornoDelMese(4),
        ore: "7.00",
        nota: "Setup ambiente di sviluppo",
        fatturabile: true,
        rimborsoTrasfertaEtichetta: "Rimborso trasferta lunga distanza",
        rimborsoTrasfertaImporto: "110.00",
      },
    }),
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: collaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: giornoDelMese(4),
        ore: "4.00",
        nota: "Attività non fatturabile — formazione interna",
        fatturabile: false,
      },
    }),
  ]);
  console.log(`✓ Create ${attivita.length} attività dimostrative`);

  // ── Attività del secondo collaboratore (Marco Bianchi) ───────
  // Righe fatturabili sulla STESSA offerta di Giulia (offerta1 / cliente1)
  // così che il report possa aggregare per offerta le giornate erogate da
  // più collaboratori. I giorni 5 e 9 sono scelti per non interferire con
  // gli scenari e2e (che usano i giorni 2, 3, 4, 6, 7).
  const attivitaSecondoCollaboratore = await Promise.all([
    // Giorno 5: giornata piena fatturabile con rimborso trasferta media distanza (60,00 €)
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: secondoCollaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: giornoDelMese(5),
        ore: "8.00",
        nota: "Implementazione moduli infrastruttura cloud",
        fatturabile: true,
        rimborsoTrasfertaEtichetta: "Rimborso trasferta media distanza",
        rimborsoTrasfertaImporto: "60.00",
      },
    }),
    // Giorno 9: giornata piena fatturabile sulla stessa offerta
    prisma.rigaAttivita.create({
      data: {
        collaboratoreId: secondoCollaboratore.id,
        clienteId: cliente1.id,
        offertaId: offerta1.id,
        data: giornoDelMese(9),
        ore: "8.00",
        nota: "Test di integrazione e collaudo",
        fatturabile: true,
      },
    }),
  ]);
  console.log(
    `✓ Create ${attivitaSecondoCollaboratore.length} attività del secondo collaboratore`
  );

  // ── Backfill abilitazioni iniziali (US-042) ──────────────────
  // Il seed svuota le tabelle all'avvio, quindi il guard "tabella vuota"
  // del backfill una tantum è sempre soddisfatto: ogni collaboratore viene
  // abilitato sulle offerte attive su cui ha almeno una riga di attività.
  const esitoBackfill = await eseguiBackfillAbilitazioniIniziali(prisma);
  console.log(
    `✓ Backfill abilitazioni iniziali: ${esitoBackfill.inserite} abilitazioni inserite (esito: ${esitoBackfill.esito})`
  );

  console.log("\n🔐 Accesso tramite Google OAuth:");
  console.log("   Amministratore → info@techreloaded.it (Back Office)");
  console.log("   Amministratore → stefano.marello@agilereloaded.it (Back Office)");
  console.log("   Collaboratore  → giulia.conti@agilereloaded.it (Front Office)");
  console.log("   Collaboratore  → marco.bianchi@agilereloaded.it (Front Office)");
  console.log("   Qualsiasi altra email Google → accesso negato (messaggio generico)");

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
