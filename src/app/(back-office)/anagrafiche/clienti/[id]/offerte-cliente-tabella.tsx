"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChipStato,
  ICONA_DISATTIVA,
  ICONA_RIATTIVA,
  IndicatoreGiorniErogati,
  PulsanteAttesa,
  useIdratata,
} from "@/components";
import type { VoceElencoOfferta } from "@/lib/offerte";
import DettaglioAvanzamentoOfferta from "@/app/(back-office)/offerte/dettaglio-avanzamento-offerta";
import { descriviGestioneTrasferta, formattaEuro } from "@/lib/formattazione";
import { cambiaStatoOffertaCliente } from "./offerte/actions";

const classeIntestazioneGruppo =
  "bg-zinc-50 px-4 py-2 text-left text-xs font-medium text-testo-metadati dark:bg-zinc-800/40";

const classePulsanteIcona =
  "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-zinc-200 bg-white no-underline transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";

/**
 * Tooltip dei pulsanti a icona: compare dopo 150ms al passaggio del mouse o al
 * focus da tastiera, al posto del `title` nativo che ha un ritardo lungo.
 * È solo visivo: il nome accessibile resta l'`aria-label` del pulsante.
 */
function ConTooltip({ testo, children }: { testo: string; children: ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-full z-10 mb-[6px] whitespace-nowrap rounded-[6px] bg-zinc-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-100 group-hover/tooltip:opacity-100 group-hover/tooltip:delay-150 group-focus-within/tooltip:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {testo}
      </span>
    </span>
  );
}

interface OfferteClienteTabellaProps {
  clienteId: string;
  offerte: VoceElencoOfferta[];
}

export default function OfferteClienteTabella({
  clienteId,
  offerte,
}: OfferteClienteTabellaProps) {
  const [offertaEspansaId, setOffertaEspansaId] = useState<string | null>(null);
  const [offertaDaDisattivare, setOffertaDaDisattivare] =
    useState<VoceElencoOfferta | null>(null);
  const idratata = useIdratata();
  // Le offerte arrivano già ordinate: prima le attive, poi le disattivate.
  const gruppi = [
    { titolo: "Attive", offerte: offerte.filter((offerta) => offerta.attiva) },
    { titolo: "Disattivate", offerte: offerte.filter((offerta) => !offerta.attiva) },
  ].filter((gruppo) => gruppo.offerte.length > 0);

  function toggleEspansione(offertaId: string) {
    setOffertaEspansaId((id) => (id === offertaId ? null : offertaId));
  }

  return (
    <>
    <table
      className="w-full border-collapse text-sm"
      aria-label="Offerte del cliente"
      data-idratata={idratata ? "true" : "false"}
    >
      <thead>
        <tr>
          <th className="px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
            Codice
          </th>
          <th className="px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
            Descrizione
          </th>
          <th className="px-4 py-[11px] text-right text-xs font-medium text-testo-metadati">
            Tariffa giornaliera
          </th>
          <th className="px-4 py-[11px] text-right text-xs font-medium text-testo-metadati">
            Giorni erogati
          </th>
          <th className="w-[130px] px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
            Stato
          </th>
          <th className="w-[110px] px-4 py-[11px] text-right text-xs font-medium text-testo-metadati">
            <span className="sr-only">Azioni</span>
          </th>
        </tr>
      </thead>
      {gruppi.map((gruppo) => (
      <tbody key={gruppo.titolo}>
        <tr className="border-t border-zinc-100 dark:border-zinc-800">
          <th colSpan={6} scope="colgroup" className={classeIntestazioneGruppo}>
            {gruppo.titolo}
            <span className="ml-[6px] font-semibold text-testo-metadati">
              {gruppo.offerte.length}
            </span>
          </th>
        </tr>
        {gruppo.offerte.map((offerta) => {
          const espansa = offertaEspansaId === offerta.offertaId;

          return (
            <Fragment key={offerta.offertaId}>
              <tr
                onClick={() => toggleEspansione(offerta.offertaId)}
                // Disattivata: dati a pieno contrasto, lo stato lo dice il chip e
                // una superficie neutra appena distinta.
                className={`cursor-pointer border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
                  offerta.attiva ? "" : "bg-zinc-50/70 dark:bg-zinc-800/30"
                }`}
              >
                <td className={`px-4 py-[13px] align-middle`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-expanded={espansa}
                      aria-label={`Dettaglio avanzamento ${offerta.codice}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEspansione(offerta.offertaId);
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-testo-metadati transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className={`h-4 w-4 transition-transform ${espansa ? "rotate-90" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                    <span className="rounded-[7px] border border-zinc-200 bg-zinc-100 px-2 py-1 font-mono text-xs font-medium text-testo-secondario dark:border-zinc-700 dark:bg-zinc-800">
                      {offerta.codice}
                    </span>
                  </div>
                </td>
                <td
                  className={`max-w-[420px] truncate px-4 py-[13px] align-middle text-testo-principale`}
                  title={offerta.descrizione}
                >
                  {offerta.descrizione || "—"}
                </td>
                <td className={`px-4 py-[13px] text-right align-middle font-semibold tabular-nums text-testo-principale`}>
                  {formattaEuro(offerta.tariffaGiornaliera)}
                  <div className="mt-[3px] text-xs font-medium text-testo-metadati">
                    {descriviGestioneTrasferta(
                      offerta.gestioneTrasferta,
                      offerta.importoTrasfertaForfettaria,
                    )}
                  </div>
                </td>
                {/* Giorni erogati: la stessa cella dell'anagrafica offerte */}
                <td className={`px-4 py-[13px] text-right align-middle whitespace-nowrap`}>
                  <IndicatoreGiorniErogati
                    avanzamento={{
                      giornateErogate: offerta.giornateErogate,
                      giorniPrevisti: offerta.giorniPrevisti,
                      stato: offerta.stato,
                    }}
                  />
                </td>
                <td className="px-4 py-[13px] align-middle">
                  <ChipStato attivo={offerta.attiva} femminile />
                </td>
                <td
                  className="px-4 py-[13px] text-right align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-[6px]">
                    <ConTooltip testo="Modifica offerta">
                    <Link
                      href={`/anagrafiche/clienti/${clienteId}/offerte/${offerta.offertaId}`}
                      aria-label={`Modifica ${offerta.codice}`}
                      className={`${classePulsanteIcona} text-testo-metadati hover:bg-zinc-50 hover:text-indigo-600 dark:hover:bg-zinc-700 dark:hover:text-indigo-400`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
                        <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                      </svg>
                    </Link>
                    </ConTooltip>
                    {offerta.attiva ? (
                      <ConTooltip testo="Disattiva offerta">
                      <button
                        type="button"
                        aria-label={`Disattiva offerta ${offerta.codice}`}
                        onClick={() => setOffertaDaDisattivare(offerta)}
                        className={`${classePulsanteIcona} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10`}
                      >
                        {ICONA_DISATTIVA}
                      </button>
                      </ConTooltip>
                    ) : (
                      // La riattivazione non toglie nulla: parte senza conferma.
                      <ConTooltip testo="Riattiva offerta">
                      <form action={cambiaStatoOffertaCliente}>
                        <input type="hidden" name="id" value={offerta.offertaId} />
                        <input type="hidden" name="clienteId" value={clienteId} />
                        <input type="hidden" name="attivo" value="true" />
                        <PulsanteAttesa
                          mostraRotellina={false}
                          aria-label={`Riattiva offerta ${offerta.codice}`}
                          className={`${classePulsanteIcona} text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10`}
                        >
                          {ICONA_RIATTIVA}
                        </PulsanteAttesa>
                      </form>
                      </ConTooltip>
                    )}
                  </div>
                </td>
              </tr>
              {espansa && (
                <tr>
                  <td colSpan={6} className="bg-zinc-100 p-0 dark:bg-zinc-800/50">
                    <DettaglioAvanzamentoOfferta offerta={offerta} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
      ))}
    </table>
    {offertaDaDisattivare && (
      <DialogDisattivazioneOfferta
        clienteId={clienteId}
        offerta={offertaDaDisattivare}
        onChiudi={() => setOffertaDaDisattivare(null)}
      />
    )}
    </>
  );
}

/**
 * Conferma della disattivazione di una singola offerta, con lo stesso testo e
 * lo stesso aspetto del dialog della pagina /offerte. L'esito positivo è un
 * `redirect` che ricarica il dettaglio cliente e smonta il dialog.
 */
function DialogDisattivazioneOfferta({
  clienteId,
  offerta,
  onChiudi,
}: {
  clienteId: string;
  offerta: VoceElencoOfferta;
  onChiudi: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-disattivazione-offerta-titolo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onChiudi();
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") onChiudi();
      }}
    >
      <div className="w-full max-w-[440px] rounded-[14px] border border-zinc-200 bg-white p-[22px] shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-[13px] flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {ICONA_DISATTIVA}
        </div>
        <h3 id="dialog-disattivazione-offerta-titolo" className="mb-[7px] text-[16.5px] font-semibold text-testo-principale">
          {`Disattivare «${offerta.codice}»?`}
        </h3>
        <p className="mb-[18px] text-sm leading-[1.55] text-testo-secondario">
          Le offerte disattivate non concorrono più al lavoro in corso ma restano nello storico. Potrai riattivarle in qualsiasi momento.
        </p>
        <div className="flex justify-end gap-[9px]">
          <button
            type="button"
            autoFocus
            onClick={onChiudi}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-sm font-medium text-testo-secondario shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
          >
            Annulla
          </button>
          <form action={cambiaStatoOffertaCliente}>
            <input type="hidden" name="id" value={offerta.offertaId} />
            <input type="hidden" name="clienteId" value={clienteId} />
            <input type="hidden" name="attivo" value="false" />
            <PulsanteAttesa
              etichettaAttesa="Disattivazione…"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-sm font-medium text-white shadow-sm transition hover:brightness-[.92]"
            >
              Disattiva
            </PulsanteAttesa>
          </form>
        </div>
      </div>
    </div>
  );
}
