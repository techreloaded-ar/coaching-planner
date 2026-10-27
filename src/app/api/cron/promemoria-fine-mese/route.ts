import { NextResponse, type NextRequest } from "next/server";
import { inviaPromemoriaFineMese } from "@/lib/promemoria-fine-mese";

/**
 * GET /api/cron/promemoria-fine-mese
 *
 * Invocata da Vercel Cron (vedi `vercel.json`) ogni giorno dal 26 al 31 del
 * mese: il promemoria parte solo l'ultimo giorno lavorativo, al massimo una
 * volta per collaboratore e mese. Vercel invia `Authorization: Bearer
 * <CRON_SECRET>`; la route non usa la sessione.
 *
 * Esiti:
 * - `401` CRON_SECRET non configurato o header assente/errato
 * - `200` esito `{ inviati, giaInviati, falliti }`
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const segreto = process.env.CRON_SECRET;
  if (!segreto || request.headers.get("authorization") !== `Bearer ${segreto}`) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  return NextResponse.json(await inviaPromemoriaFineMese({ modalita: "AUTOMATICA" }));
}
