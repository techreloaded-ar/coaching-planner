"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { violaProtezioneUltimoAmministratore } from "@/domain/anagrafiche/protezione-amministratore";
import { db } from "@/lib/db";
import { eseguiConRetrySerializzazione } from "@/lib/retry-serializzazione";
import { richiediRuoloApi } from "@/lib/dal";

export async function cambiaStatoUtenteAction(formData: FormData) {
  await richiediRuoloApi("AMMINISTRATORE");

  const id = formData.get("id") as string;
  const attivo = formData.get("attivo") === "true";

  if (!id) {
    redirect("/anagrafiche/utenti");
  }

  const esito = await eseguiConRetrySerializzazione(() =>
    db.$transaction(
      async (tx) => {
        const utente = await tx.utente.findUnique({
          where: { id },
          select: {
            ruolo: true,
            attivo: true,
            collaboratore: { select: { id: true } },
          },
        });

        if (!utente) {
          return "NON_TROVATO" as const;
        }

        if (attivo === false) {
          const altriAmministratoriAttivi = await tx.utente.count({
            where: {
              ruolo: "AMMINISTRATORE",
              attivo: true,
              id: { not: id },
            },
          });

          if (
            violaProtezioneUltimoAmministratore(
              { ruolo: utente.ruolo, attivo: utente.attivo },
              { tipo: "INVALIDAZIONE" },
              altriAmministratoriAttivi,
            )
          ) {
            return "ULTIMO_AMMINISTRATORE" as const;
          }
        }

        await tx.utente.update({
          where: { id },
          data: { attivo },
        });

        if (utente.collaboratore) {
          await tx.collaboratore.update({
            where: { id: utente.collaboratore.id },
            data: { attivo },
          });
        }

        return attivo ? ("RIATTIVATO" as const) : ("INVALIDATO" as const);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  if (esito === "ULTIMO_AMMINISTRATORE") {
    redirect("/anagrafiche/utenti?errore=ultimo-amministratore");
  } else if (esito === "NON_TROVATO") {
    redirect("/anagrafiche/utenti");
  } else {
    revalidatePath("/anagrafiche/utenti");
    revalidatePath("/anagrafiche/collaboratori");
    redirect(
      esito === "INVALIDATO"
        ? "/anagrafiche/utenti?esito=invalidato"
        : "/anagrafiche/utenti?esito=riattivato",
    );
  }
}
