import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

// Limita parametri SQL e memoria per query, senza spezzare la transazione.
export function* blocchi<T>(righe: T[], dimensione = 500) {
  for (let i = 0; i < righe.length; i += dimensione) yield righe.slice(i, i + dimensione);
}

type VoceRegistro = Pick<Prisma.ImportazioneLegacyRigaCreateManyInput,
  "origine" | "chiave" | "dati" | "rigaAttivitaId" | "impronta" | "ignorata">;

export async function salvaRegistro(tx: Prisma.TransactionClient, righe: VoceRegistro[]) {
  const ora = new Date();
  for (const blocco of blocchi(righe)) {
    // Upsert parametrizzato: conserva gli ID delle registrazioni esistenti.
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ImportazioneLegacyRiga"
        ("id", "origine", "chiave", "dati", "rigaAttivitaId", "impronta", "ignorata", "updatedAt")
      VALUES ${Prisma.join(blocco.map((r) => Prisma.sql`(
        ${randomUUID()}, ${r.origine}, ${r.chiave}, ${JSON.stringify(r.dati)}::jsonb,
        ${r.rigaAttivitaId ?? null}, ${r.impronta ?? null}, ${r.ignorata ?? false}, ${ora}
      )`))}
      ON CONFLICT ("origine", "chiave") DO UPDATE SET
        "dati" = EXCLUDED."dati", "rigaAttivitaId" = EXCLUDED."rigaAttivitaId",
        "impronta" = EXCLUDED."impronta", "ignorata" = EXCLUDED."ignorata",
        "updatedAt" = EXCLUDED."updatedAt"
    `);
  }
}

type Aggiornamento = { id: string } & import("./types").Giornata;

export async function aggiornaGiornate(tx: Prisma.TransactionClient, righe: Aggiornamento[]) {
  const ora = new Date();
  for (const blocco of blocchi(righe)) {
    const count = await tx.$executeRaw(Prisma.sql`
      UPDATE "RigaAttivita" AS g SET
        "collaboratoreId" = v.coach, "clienteId" = v.cliente, "offertaId" = v.offerta,
        "data" = v.data, "ore" = v.ore, "categoria" = v.categoria,
        "inAffiancamento" = v.pair, "nota" = v.nota,
        "rimborsoTrasfertaEtichetta" = v.etichetta, "rimborsoTrasfertaImporto" = v.importo,
        "updatedAt" = ${ora}
      FROM (VALUES ${Prisma.join(blocco.map((g) => Prisma.sql`(
        ${g.id}::text, ${g.collaboratoreId}::text, ${g.clienteId}::text, ${g.offertaId}::text,
        ${g.data}::date, ${g.ore}::numeric, ${g.categoria}::"CategoriaAttivita",
        ${g.inAffiancamento ?? false}::boolean, ${g.nota}::text,
        ${g.rimborsoTrasfertaEtichetta}::text, ${g.rimborsoTrasfertaImporto}::numeric
      )`))}) AS v(id, coach, cliente, offerta, data, ore, categoria, pair, nota, etichetta, importo)
      WHERE g."id" = v.id
    `);
    if (count !== blocco.length) throw new Error("Numero inatteso di giornate aggiornate durante l’importazione.");
  }
}
