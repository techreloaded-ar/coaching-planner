import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { clientePerId } from "@/lib/clienti";
import { reportMarginalitaPeriodo } from "@/lib/report";
import {
  tokenMeseCorrente,
  normalizzaPeriodoMesi,
  etichettaMese,
} from "@/domain/calendario";
import { ETICHETTA_MODALITA_TARIFFA } from "@/domain/tariffe";
import { OFFERTA_DA_DEFINIRE } from "@/app/(front-office)/attivita/filtri-elenco";
import type {
  VoceCollaboratoreMeseMarginalita,
  VoceOffertaMarginalita,
} from "@/domain/consuntivi";
import { descriviImportoTariffa, formattaEuro, formattaNumeroGiornate, formattaNumeroOre, inizialiCliente } from "@/lib/formattazione";
import {
  Cifra,
  ImportoMargine,
  classeCodiceOfferta,
  classeIntestazioneColonna,
  percentuale,
} from "../report-marginalita";

// Due decimali: le formule devono tornare anche con frazioni di giornata (0,25 gg)

const classeCella =
  "border-b border-zinc-100 px-5 py-[12px] align-middle tabular-nums whitespace-nowrap dark:border-zinc-700/50";

const classeFormula = "block text-xs text-testo-metadati";

const classeBadgeModalita: Record<string, string> = {
  GIORNALIERA: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  PERCENTUALE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  FISSO_MENSILE: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  MANCANTE: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
};

function giornate(valore: number): string {
  return `${formattaNumeroGiornate(valore)} gg`;
}

function formulaRicavo(offerta: VoceOffertaMarginalita, voce: VoceCollaboratoreMeseMarginalita): string {
  if (offerta.offertaId === null) return "senza offerta: nessun ricavo";
  return `${giornate(voce.giornateFatturabili)} × ${formattaEuro(offerta.tariffaOffertaGiornaliera)}`;
}

function formulaCosto(offerta: VoceOffertaMarginalita, voce: VoceCollaboratoreMeseMarginalita): string {
  switch (voce.modalitaTariffaCollaboratore) {
    case "GIORNALIERA": {
      const tariffa = formattaEuro(voce.importoTariffaCollaboratore);
      return voce.giornateNonFatturabili > 0
        ? `(${formattaNumeroGiornate(voce.giornateFatturabili)} + ${giornate(voce.giornateNonFatturabili)}) × ${tariffa}`
        : `${giornate(voce.giornateFatturabili)} × ${tariffa}`;
    }
    case "PERCENTUALE":
      return `${giornate(voce.giornateFatturabili)} × (${formattaEuro(offerta.tariffaOffertaGiornaliera)} − ${formattaNumeroOre(Number(voce.importoTariffaCollaboratore))}%)`;
    case "FISSO_MENSILE":
      return voce.oreQuotaFisso === null || voce.oreMeseFisso === null
        ? ""
        : `quota ${formattaNumeroOre(voce.oreQuotaFisso)} h su ${formattaNumeroOre(voce.oreMeseFisso)} h del mese × ${formattaEuro(voce.importoTariffaCollaboratore)}`;
    default:
      return "nessuna tariffa valida nel mese";
  }
}

export default async function DettaglioMarginalitaClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<{ da?: string; a?: string }>;
}) {
  await richiediRuolo("AMMINISTRATORE");

  const { clienteId } = await params;
  const cliente = await clientePerId(clienteId);
  if (!cliente) {
    notFound();
  }

  const parametri = await searchParams;
  const { da, a } = normalizzaPeriodoMesi(parametri.da, parametri.a, tokenMeseCorrente());
  const etichettaPeriodo =
    da === a ? etichettaMese(da) : `${etichettaMese(da)} – ${etichettaMese(a)}`;

  // Il report intero serve comunque: i fissi mensili si ripartiscono sulle ore
  // di tutti i clienti del collaboratore nel mese.
  const report = await reportMarginalitaPeriodo(da, a);
  const voceCliente = report.perCliente.find((voce) => voce.clienteId === cliente.id);

  return (
    <div>
      <Link
        href={`/report/marginalita?da=${da}&a=${a}`}
        className="mb-[14px] inline-flex items-center gap-[6px] text-sm font-medium text-testo-secondario no-underline transition hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Marginalità per cliente e offerta
      </Link>

      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[13px]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-indigo-50 text-[15px] font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            {inizialiCliente(cliente.ragioneSociale)}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-testo-metadati">
              Dettaglio marginalità
            </div>
            <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale">
              {cliente.ragioneSociale}
            </h1>
          </div>
        </div>
        <p className="text-sm text-testo-metadati">
          Periodo: <b className="text-testo-principale">{etichettaPeriodo}</b>
        </p>
      </div>

      {!voceCliente ? (
        <div className="rounded-[11px] border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
          Nessuna attività fatturabile o non fatturabile per questo cliente nel periodo selezionato.
        </div>
      ) : (
        <div className="flex flex-col gap-[18px]">
          <div
            data-testid="dettaglio-marginalita-totali"
            className="flex flex-wrap items-center justify-between gap-4 rounded-[11px] border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <p className="max-w-[480px] text-sm text-testo-metadati">
              Ricavi: giornate Fatturabile × tariffa dell&apos;offerta. Costi: tariffa del
              collaboratore valida nel mese, applicata come indicato in ogni riga.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Cifra etichetta="Ricavi">{formattaEuro(voceCliente.ricavi)}</Cifra>
              <Cifra etichetta="Costi">{formattaEuro(voceCliente.costi)}</Cifra>
              <Cifra etichetta="Margine">
                <ImportoMargine importi={voceCliente} />
              </Cifra>
              <Cifra etichetta="Margine %">{percentuale(voceCliente)}</Cifra>
            </div>
          </div>

          {voceCliente.perOfferta.map((offerta) => (
            <section
              key={offerta.offertaId ?? "senza-offerta"}
              data-testid={`dettaglio-marginalita-offerta-${offerta.offertaId ?? "senza-offerta"}`}
              aria-label={offerta.offertaCodice}
              className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-[14px] dark:border-zinc-700 dark:bg-zinc-800/60">
                <div className="flex flex-wrap items-center gap-[10px]">
                  <span className={classeCodiceOfferta(offerta.offertaId)}>{offerta.offertaCodice}</span>
                  <h2 className="text-[14.5px] font-semibold text-testo-principale">
                    {offerta.offertaDescrizione}
                  </h2>
                  {offerta.offertaId !== null && (
                    <span className="text-sm text-testo-metadati">
                      tariffa offerta {formattaEuro(offerta.tariffaOffertaGiornaliera)} / giorno
                    </span>
                  )}
                </div>
                <Cifra etichetta="Margine">
                  <ImportoMargine importi={offerta} />
                </Cifra>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={`${classeIntestazioneColonna} text-left`}>Collaboratore</th>
                      <th className={`${classeIntestazioneColonna} text-left`}>Mese</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Gg fatturabili</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Gg non fatt.</th>
                      <th className={`${classeIntestazioneColonna} text-left`}>Ricavo</th>
                      <th className={`${classeIntestazioneColonna} text-left`}>Tariffa collaboratore</th>
                      <th className={`${classeIntestazioneColonna} text-left`}>Costo</th>
                      <th className={`${classeIntestazioneColonna} text-right`}>Margine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerta.perCollaboratoreMese.map((voce) => {
                      const modalita = voce.modalitaTariffaCollaboratore;
                      return (
                        <tr
                          key={`${voce.collaboratoreId}|${voce.mese}`}
                          data-testid={`dettaglio-marginalita-voce-${voce.collaboratoreId}-${voce.mese}`}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className={`${classeCella} text-testo-principale`}>
                            <Link
                              href={`/attivita?${new URLSearchParams({
                                vista: "elenco",
                                collaboratore: voce.collaboratoreId,
                                mese: voce.mese,
                                cliente: cliente.id,
                                offerta: offerta.offertaId ?? OFFERTA_DA_DEFINIRE,
                              })}`}
                              className="text-testo-principale no-underline transition hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                            >
                              {voce.collaboratoreNominativo}
                            </Link>
                          </td>
                          <td className={`${classeCella} text-testo-metadati`}>
                            {etichettaMese(voce.mese)}
                          </td>
                          <td className={`${classeCella} text-right text-testo-principale`}>
                            {formattaNumeroGiornate(voce.giornateFatturabili)}
                          </td>
                          <td className={`${classeCella} text-right text-testo-principale`}>
                            {formattaNumeroGiornate(voce.giornateNonFatturabili)}
                          </td>
                          <td className={`${classeCella} text-testo-principale`}>
                            {formattaEuro(voce.ricavi)}
                            <span className={classeFormula}>{formulaRicavo(offerta, voce)}</span>
                          </td>
                          <td className={`${classeCella} text-testo-principale`}>
                            <span
                              className={`mr-2 rounded-full px-2 py-[2px] text-xs font-medium ${classeBadgeModalita[modalita ?? "MANCANTE"]}`}
                            >
                              {modalita ? ETICHETTA_MODALITA_TARIFFA[modalita] : "Tariffa mancante"}
                            </span>
                            {modalita && descriviImportoTariffa(modalita, voce.importoTariffaCollaboratore)}
                          </td>
                          <td className={`${classeCella} text-testo-principale`}>
                            {formattaEuro(voce.costi)}
                            <span className={classeFormula}>{formulaCosto(offerta, voce)}</span>
                          </td>
                          <td className={`${classeCella} text-right`}>
                            <ImportoMargine importi={voce} />
                          </td>
                        </tr>
                      );
                    })}
                    <tr
                      data-testid={`dettaglio-marginalita-totale-${offerta.offertaId ?? "senza-offerta"}`}
                      className="bg-zinc-50 font-semibold dark:bg-zinc-800/60"
                    >
                      <td colSpan={2} className={`${classeCella} text-testo-principale`}>
                        Totale offerta
                      </td>
                      <td className={`${classeCella} text-right text-testo-principale`}>
                        {formattaNumeroGiornate(offerta.giornateFatturabili)}
                      </td>
                      <td className={`${classeCella} text-right text-testo-principale`}>
                        {formattaNumeroGiornate(
                          offerta.perCollaboratoreMese.reduce(
                            (somma, voce) => somma + voce.giornateNonFatturabili,
                            0,
                          ),
                        )}
                      </td>
                      <td className={`${classeCella} text-testo-principale`}>
                        {formattaEuro(offerta.ricavi)}
                      </td>
                      <td className={classeCella} />
                      <td className={`${classeCella} text-testo-principale`}>
                        {formattaEuro(offerta.costi)}
                      </td>
                      <td className={`${classeCella} text-right`}>
                        <ImportoMargine importi={offerta} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
