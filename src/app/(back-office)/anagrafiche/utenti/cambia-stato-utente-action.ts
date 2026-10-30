"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { violaProtezioneUltimoAmministratore } from "@/domain/anagrafiche/protezione-amministratore";
import { db } from "@/lib/db";
import { eseguiConRetrySerializzazione } from "@/lib/retry-serializzazione";
import { richiediRuoloApi } from "@/lib/dal";
import { leggiIdSelezionati } from "@/lib/selezione-elenco";

/**
 * Disattiva o riattiva uno o più utenti (un campo `id` per utente) insieme ai
 * profili collaboratore collegati. La disattivazione è rifiutata per intero se
 * non resterebbe alcun amministratore attivo.
 */
export async function cambiaStatoUtenteAction(formData: FormData) {
  await richiediRuoloApi("AMMINISTRATORE");

  const idUtenti = leggiIdSelezionati(formData);
  const attivo = formData.get("attivo") === "true";

  if (idUtenti.length === 0) {
    redirect("/anagrafiche/utenti");
  }

  const esito = await eseguiConRetrySerializzazione(() =>
    db.$transaction(
      async (tx) => {
        const utentiSelezionati = await tx.utente.findMany({
          where: { id: { in: idUtenti } },
          select: {
            id: true,
            ruolo: true,
            attivo: true,
            collaboratore: { select: { id: true } },
          },
        });

        if (utentiSelezionati.length === 0) {
          return "NON_TROVATO" as const;
        }

        if (attivo === false) {
          const altriAmministratoriAttivi = await tx.utente.count({
            where: {
              ruolo: "AMMINISTRATORE",
              attivo: true,
              id: { notIn: idUtenti },
            },
          });

          if (
            utentiSelezionati.some((utente) =>
              violaProtezioneUltimoAmministratore(
                { ruolo: utente.ruolo, attivo: utente.attivo },
                { tipo: "INVALIDAZIONE" },
                altriAmministratoriAttivi,
              ),
            )
          ) {
            return "ULTIMO_AMMINISTRATORE" as const;
          }
        }

        await tx.utente.updateMany({
          where: { id: { in: utentiSelezionati.map((utente) => utente.id) } },
          data: { attivo },
        });

        const idProfiliCollaboratore = utentiSelezionati.flatMap((utente) =>
          utente.collaboratore ? [utente.collaboratore.id] : [],
        );
        if (idProfiliCollaboratore.length > 0) {
          await tx.collaboratore.updateMany({
            where: { id: { in: idProfiliCollaboratore } },
            data: { attivo },
          });
        }

        return attivo ? ("RIATTIVATO" as const) : ("DISATTIVATO" as const);
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
      esito === "DISATTIVATO"
        ? "/anagrafiche/utenti?esito=disattivato"
        : "/anagrafiche/utenti?esito=riattivato",
    );
  }
}
