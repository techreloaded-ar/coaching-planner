"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useIdratata } from "@/components";
import type { VoceElencoOfferta } from "@/lib/offerte";
import DettaglioAvanzamentoOfferta from "@/app/(back-office)/offerte/dettaglio-avanzamento-offerta";

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface OfferteClienteTabellaProps {
  clienteId: string;
  offerte: VoceElencoOfferta[];
}

export default function OfferteClienteTabella({
  clienteId,
  offerte,
}: OfferteClienteTabellaProps) {
  const [offertaEspansaId, setOffertaEspansaId] = useState<string | null>(null);
  const idratata = useIdratata();

  function toggleEspansione(offertaId: string) {
    setOffertaEspansaId((id) => (id === offertaId ? null : offertaId));
  }

  return (
    <table
      className="w-full border-collapse text-[13.5px]"
      aria-label="Offerte del cliente"
      data-idratata={idratata ? "true" : "false"}
    >
      <thead>
        <tr>
          <th className="px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
            Codice
          </th>
          <th className="px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
            Descrizione
          </th>
          <th className="px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
            Tariffa giornaliera
          </th>
          <th className="px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
            Giorni previsti
          </th>
          <th className="w-[110px] px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
            <span className="sr-only">Azioni</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {offerte.map((offerta) => {
          const espansa = offertaEspansaId === offerta.offertaId;

          return (
            <Fragment key={offerta.offertaId}>
              <tr
                onClick={() => toggleEspansione(offerta.offertaId)}
                className="cursor-pointer border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <td className="px-4 py-[13px] align-middle">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-expanded={espansa}
                      aria-label={`Dettaglio avanzamento ${offerta.codice}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEspansione(offerta.offertaId);
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
                    <span className="rounded-[7px] border border-zinc-200 bg-zinc-100 px-2 py-1 font-mono text-[12px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {offerta.codice}
                    </span>
                  </div>
                </td>
                <td
                  className="max-w-[420px] truncate px-4 py-[13px] align-middle text-zinc-800 dark:text-zinc-100"
                  title={offerta.descrizione}
                >
                  {offerta.descrizione}
                </td>
                <td className="px-4 py-[13px] text-right align-middle font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                  {formattatoreEuro.format(Number(offerta.tariffaGiornaliera))}
                </td>
                <td className="px-4 py-[13px] text-right align-middle tabular-nums text-zinc-800 dark:text-zinc-100">
                  {offerta.giorniPrevisti}
                </td>
                <td
                  className="px-4 py-[13px] text-right align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/anagrafiche/clienti/${clienteId}/offerte/${offerta.offertaId}`}
                    className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                      <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                    </svg>
                    Modifica
                  </Link>
                </td>
              </tr>
              {espansa && (
                <tr>
                  <td colSpan={5} className="bg-zinc-100 p-0 dark:bg-zinc-800/50">
                    <DettaglioAvanzamentoOfferta offerta={offerta} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
