// Passo RIMBORSI: garantisce le voci di rimborso trasferta della configurazione.
// Va prima delle giornate, che agganciano l'etichetta per importo.

import type { Prisma } from "@/generated/prisma/client";
import { normalizzaTesto } from "@/domain/righe-sospese/abbinamento";
import type { Configurazione } from "./configurazione";

export interface EsitoRimborsi {
  inserite: number;
  giaPresenti: number;
}

export async function importaRimborsi(tx: Prisma.TransactionClient, cfg: Configurazione): Promise<EsitoRimborsi> {
  const esistenti = new Set((await tx.voceRimborsoTrasferta.findMany({ select: { etichetta: true } })).map((v) => normalizzaTesto(v.etichetta)));
  const nuove = cfg.vociRimborsoTrasferta.filter((v) => !esistenti.has(normalizzaTesto(v.etichetta)));
  await tx.voceRimborsoTrasferta.createMany({ data: nuove.map((v) => ({ etichetta: v.etichetta, importo: v.importo.toFixed(2) })) });
  return { inserite: nuove.length, giaPresenti: cfg.vociRimborsoTrasferta.length - nuove.length };
}
