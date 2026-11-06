import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Archivio, Celle } from "./types";

export async function leggiArchivio(tx: Prisma.TransactionClient, origine: string): Promise<Archivio> {
  const [clienti, utenti, offerte, giornate, rimborsi, registro] = await Promise.all([
    tx.cliente.findMany({ select: { id: true, ragioneSociale: true }, orderBy: { id: "asc" } }),
    tx.utente.findMany({ select: { id: true, email: true, collaboratore: { select: { id: true } } }, orderBy: { id: "asc" } }),
    tx.offerta.findMany({ select: { id: true, codice: true, clienteId: true }, orderBy: { id: "asc" } }),
    tx.rigaAttivita.findMany({ orderBy: { id: "asc" } }),
    tx.voceRimborsoTrasferta.findMany({ orderBy: { id: "asc" } }),
    tx.importazioneLegacyRiga.findMany({ where: { origine }, orderBy: { chiave: "asc" } }),
  ]);
  return { clienti, utenti, offerte,
    giornate: giornate.map((g) => ({ id: g.id, versione: g.updatedAt.toISOString(), data: g.data.toISOString().slice(0, 10),
      collaboratoreId: g.collaboratoreId, clienteId: g.clienteId, offertaId: g.offertaId, ore: g.ore.toFixed(2), categoria: g.categoria,
      rimborsoTrasfertaImporto: g.rimborsoTrasfertaImporto?.toFixed(2) ?? null, rimborsoTrasfertaEtichetta: g.rimborsoTrasfertaEtichetta, nota: g.nota })),
    rimborsi: rimborsi.map((r) => ({ etichetta: r.etichetta, importo: r.importo.toFixed(2) })),
    registro: registro.map((r) => ({ chiave: r.chiave, dati: r.dati as Celle, rigaAttivitaId: r.rigaAttivitaId, impronta: r.impronta, ignorata: r.ignorata })) };
}
