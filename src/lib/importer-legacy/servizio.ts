import { ErroreImporter } from "./errori";
import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { analizza, impronta, revisioneArchivio } from "./analisi";
import { leggiArchivio } from "./archivio";
import { richiediImporter } from "./config";
import { leggiGoogle } from "./google";
import { assisteConAI } from "./ai";
import { operazioni } from "./decisioni";
import type { Decisione, Giornata, Piano, RigaAnteprima } from "./types";
import { appendiNote } from "./senza-codice";

function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)); }

export async function creaAnteprima(autoreId: string, modalita: Piano["modalita"]) {
  const cfg = richiediImporter();
  const schede = await leggiGoogle(cfg);
  const archivio = await db.$transaction((tx) => leggiArchivio(tx, cfg.id), { isolationLevel: "RepeatableRead", timeout: 30_000 });
  const piano = analizza(schede, archivio, cfg, modalita);
  await assisteConAI(piano);
  // Le credenziali non vengono mai salvate nel piano.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(165104, 1)`;
    // Una sola anteprima temporanea per documento, sostituita ad ogni lettura.
    await tx.importazioneLegacy.deleteMany({ where: { origine: cfg.id } });
    return tx.importazioneLegacy.create({ data: { origine: cfg.id, autoreId, piano: json(piano) }, select: { id: true } });
  });
}

export function leggiPiano(value: unknown): Piano {
  const piano = value as Piano;
  if (piano?.versione !== 6 || !Array.isArray(piano.righe) || !piano.schede) throw new ErroreImporter("Anteprima non compatibile. Ripeti l’analisi.");
  return piano;
}


async function azzera(tx: Prisma.TransactionClient) {
  await tx.importazioneLegacyRiga.deleteMany();
  await tx.rigaAttivitaSospesa.deleteMany();
  await tx.rigaAttivita.deleteMany();
  await tx.voceRimborsoTrasferta.deleteMany();
  await tx.abilitazioneOfferta.deleteMany();
  await tx.eventoCalendarioGestito.deleteMany();
  await tx.promemoriaFineMeseInviato.deleteMany();
  await tx.collegamentoCalendarioGoogle.deleteMany();
  await tx.tariffaCollaboratore.deleteMany();
  await tx.collaboratore.deleteMany();
  await tx.offerta.deleteMany();
  await tx.cliente.deleteMany();
  await tx.session.deleteMany({ where: { user: { ruolo: { not: "AMMINISTRATORE" } } } });
  await tx.account.deleteMany({ where: { user: { ruolo: { not: "AMMINISTRATORE" } } } });
  await tx.utente.deleteMany({ where: { ruolo: { not: "AMMINISTRATORE" } } });
}

function datiGiornata(g: Giornata) { return { ...g, inAffiancamento: g.inAffiancamento ?? false, data: new Date(`${g.data}T12:00:00.000Z`) }; }

export async function applicaAnteprima(id: string, revisione: string, decisioni: Decisione[], clientiAI: string[], confermaReset: string, confermaSenzaCodice = false) {
  const cfg = richiediImporter();
  return db.$transaction(async (tx) => {
    // Lock transazionale globale fra gli importer (anche ambienti/documenti diversi sullo stesso DB).
    // Nessun lock durante Google/AI: applicazione breve e atomica.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(165104, 1)`;
    const job = await tx.importazioneLegacy.findUnique({ where: { id } });
    if (!job || job.origine !== cfg.id) throw new ErroreImporter("Anteprima assente o appartenente a un altro documento.");
    if (job.stato !== "ANTEPRIMA") throw new ErroreImporter("Questa anteprima è già completata o superata. Ripeti l’analisi per leggere nuovi dati.");
    if (job.updatedAt.toISOString() !== revisione) throw new ErroreImporter("L’anteprima è cambiata in un’altra finestra. Ricarica la pagina.");
    const piano = leggiPiano(job.piano);
    const archivio = await leggiArchivio(tx, cfg.id);
    if (revisioneArchivio(archivio) !== piano.revisioneArchivio) throw new ErroreImporter("I dati dell’app sono cambiati dopo l’analisi. Ripeti l’analisi prima di importare; nessun dato è stato modificato.");
    const ops = operazioni(piano, decisioni);
    if (ops.some((op) => op.riga.senzaCodice && (op.azione === "NUOVA" || op.azione === "AGGIORNA")) && !confermaSenzaCodice) {
      throw new ErroreImporter("Conferma le associazioni a SENZA CODICE prima di importare.");
    }
    if (piano.modalita === "RESET") {
      if (confermaReset !== "AZZERA TUTTO") throw new ErroreImporter("Per il reset completo scrivi AZZERA TUTTO.");
      if (piano.righe.some((r) => ["VERIFICARE", "NON_IMPORTABILE", "SCOMPARSA"].includes(r.stato) && !ops.some((o) => o.riga.chiave === r.chiave))) throw new ErroreImporter("Prima del reset decidi anche tutte le righe da verificare o non importabili.");
      if (!ops.some((o) => o.azione === "NUOVA")) throw new ErroreImporter("Reset annullato: nessuna giornata da importare.");
      if (!archivio.utenti.some((u) => u.ruolo === "AMMINISTRATORE") && !piano.anagrafiche.coach.some((c) => c.ruolo === "AMMINISTRATORE")) throw new ErroreImporter("Reset annullato: configura IMPORTER_EMAIL_AMMINISTRATORI con almeno un coach del foglio, per mantenere l’accesso amministrativo.");
      await azzera(tx);
      // Le altre anteprime non sono più applicabili.
      await tx.importazioneLegacy.updateMany({ where: { id: { not: id }, stato: { not: "COMPLETATA" } }, data: { stato: "SUPERATA" } });
    }
    for (const c of piano.anagrafiche.clienti) {
      const dati = c.verifica && !clientiAI.includes(c.id) ? { note: c.dati.note || "" } : c.dati;
      await tx.cliente.create({ data: { id: c.id, ragioneSociale: c.ragioneSociale, ...dati } });
    }
    for (const c of piano.anagrafiche.coach) {
      const tariffe = c.tariffe ?? [{ validaDalMese: c.dalMese, validaAlMese: null, modalita: c.modalita, importo: c.importo }];
      const profilo = { id: c.id, nome: c.nome, cognome: c.cognome, partitaIva: c.partitaIva || null, attivo: c.attivo ?? true,
        tariffe: { create: tariffe } };
      if (c.profiloEsistente) {
        // La fotografia approvata contiene tutti i periodi del coach, non solo
        // la tariffa attuale. La sostituzione resta atomica e ripetibile.
        await tx.tariffaCollaboratore.deleteMany({ where: { collaboratoreId: c.id } });
        await tx.collaboratore.update({ where: { id: c.id }, data: { attivo: c.attivo ?? true, tariffe: { create: tariffe } } });
      } else if (c.utenteEsistente) {
        await tx.collaboratore.create({ data: { ...profilo, userId: c.userId } });
      } else {
        await tx.utente.create({ data: { id: c.userId, nome: c.nome, cognome: c.cognome, email: c.email, ruolo: c.ruolo,
          attivo: c.ruolo === "AMMINISTRATORE" ? true : c.attivo ?? true,
          collaboratore: { create: profilo } } });
      }
      if (c.utenteEsistente && c.attivo !== undefined) {
        await tx.utente.updateMany({ where: { id: c.userId, ruolo: { not: "AMMINISTRATORE" } }, data: { attivo: c.attivo } });
      }
    }
    for (const o of piano.anagrafiche.offerte) {
      if (o.ripiego && !ops.some((op) => (op.azione === "NUOVA" || op.azione === "AGGIORNA") && op.riga.proposta?.offertaId === o.id)) continue;
      const { anno, ripiego, ...dati } = o;
      void ripiego;
      await tx.offerta.create({ data: { ...dati, createdAt: new Date(Date.UTC(anno, 0, 1, 12)) } });
    }
    const esito = { aggiunte: 0, aggiornate: 0, riconosciute: 0, ignorate: 0, eliminate: 0 };
    for (const op of ops) {
      const { riga, azione } = op;
      if (azione === "ELIMINA") {
        // Anche una decisione costruita a mano deve avere un collegamento reale
        // nel registro dell'origine corrente. Nessuna cancellazione per ID libero.
        if (!archivio.registro.some((voce) => voce.chiave === riga.chiave && voce.rigaAttivitaId === op.destinazione)) {
          throw new ErroreImporter("La giornata da eliminare non appartiene al registro di questo documento.");
        }
        if (await tx.importazioneLegacyRiga.count({ where: { rigaAttivitaId: op.destinazione!, origine: { not: cfg.id } } })) {
          throw new ErroreImporter("La giornata è collegata anche a un altro documento: non può essere eliminata da questa importazione.");
        }
        await tx.rigaAttivita.delete({ where: { id: op.destinazione! } });
        await tx.importazioneLegacyRiga.deleteMany({ where: { origine: cfg.id, rigaAttivitaId: op.destinazione! } });
        esito.eliminate++;
        continue;
      }
      let rigaAttivitaId: string | null = null;
      let fingerprint: string | null = null;
      if (azione === "NUOVA" || azione === "AGGIORNA") {
        const g = { ...riga.proposta! };
        if (riga.senzaCodice && azione === "AGGIORNA") {
          g.nota = appendiNote(archivio.giornate.find((giornata) => giornata.id === op.destinazione)?.nota, g.nota);
        }
        const saved = azione === "NUOVA"
          ? await tx.rigaAttivita.create({ data: datiGiornata(g) })
          : await tx.rigaAttivita.update({ where: { id: op.destinazione! }, data: datiGiornata(g) });
        rigaAttivitaId = saved.id;
        fingerprint = impronta(g);
        if (azione === "NUOVA") esito.aggiunte++; else esito.aggiornate++;
        if (g.offertaId) await tx.abilitazioneOfferta.upsert({ where: { collaboratoreId_offertaId: { collaboratoreId: g.collaboratoreId, offertaId: g.offertaId } },
          create: { collaboratoreId: g.collaboratoreId, offertaId: g.offertaId }, update: {} });
        // Una correzione sostituisce il vecchio collegamento, non crea righe fantasma scomparse.
        await tx.importazioneLegacyRiga.deleteMany({ where: { origine: cfg.id, rigaAttivitaId: saved.id, chiave: { not: riga.chiave } } });
      } else if (azione === "COLLEGA") {
        rigaAttivitaId = op.destinazione!;
        fingerprint = impronta(riga.proposta!);
        esito.riconosciute++;
        await tx.importazioneLegacyRiga.deleteMany({ where: { origine: cfg.id, rigaAttivitaId, chiave: { not: riga.chiave } } });
      } else {
        esito.ignorate++;
        // Presa visione di una sparizione: conserva il collegamento per
        // riconoscere correttamente la riga se ricompare nel foglio.
        if (riga.stato === "SCOMPARSA" && riga.candidati[0]) {
          rigaAttivitaId = riga.candidati[0].id;
          fingerprint = impronta(riga.candidati[0]);
        }
      }
      await tx.importazioneLegacyRiga.upsert({ where: { origine_chiave: { origine: cfg.id, chiave: riga.chiave } },
        create: { origine: cfg.id, chiave: riga.chiave, dati: json(riga.grezzi), rigaAttivitaId, impronta: fingerprint, ignorata: azione === "IGNORA" },
        update: { dati: json(riga.grezzi), rigaAttivitaId, impronta: fingerprint, ignorata: azione === "IGNORA" } });
    }
    // L'anteprima serve soltanto per questa conferma. Il registro delle righe
    // resta disponibile per riconoscere gli import alla prossima analisi.
    // La cancellazione è atomica con le scritture: in caso di errore resta tutto.
    await tx.importazioneLegacy.delete({ where: { id } });
    return esito;
  }, { isolationLevel: "Serializable", timeout: 60_000, maxWait: 10_000 });
}


export function contaRighe(righe: RigaAnteprima[]) {
  return Object.fromEntries(["PRONTA", "AGGIORNARE", "VERIFICARE", "NON_IMPORTABILE", "PRESENTE", "IGNORATA", "SCOMPARSA"].map((stato) => [stato, righe.filter((r) => r.stato === stato).length]));
}
