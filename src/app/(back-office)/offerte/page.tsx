import { richiediRuolo } from "@/lib/dal";
import { elencaOfferteConAvanzamento } from "@/lib/offerte";
import OfferteTabella from "./offerte-tabella";

export default async function OffertePage() {
  await richiediRuolo("AMMINISTRATORE");
  const offerte = await elencaOfferteConAvanzamento();

  return (
    <div>
      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
            Anagrafiche
          </div>
          <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Offerte
          </h1>
          <p className="mt-[6px] max-w-[620px] text-[13px] text-zinc-400 dark:text-zinc-500">
            Tutte le offerte di tutti i clienti in un unico posto: stato attiva/non
            attiva e avanzamento delle giornate (erogate e residuo, coerenti con la
            vista di avanzamento). Le offerte non attive sono attenuate; residuo
            esaurito o negativo è evidenziato in rosso.
          </p>
        </div>
      </div>

      {/* Tabella offerte */}
      <OfferteTabella offerte={offerte} />
    </div>
  );
}
