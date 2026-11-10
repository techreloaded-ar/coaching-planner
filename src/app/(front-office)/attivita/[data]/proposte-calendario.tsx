"use client";

import { useCallback, useEffect, useState } from "react";
import { creaRiga } from "@/lib/actions/righe-attivita";
import { rifiutaPropostaCalendario } from "@/lib/actions/calendario-google";
import { PulsanteAttesa } from "@/components";
import { CATEGORIA_ATTIVITA_PREDEFINITA } from "@/domain/types";
import type {
  PropostaCalendarioClient,
  ProposteCalendarioGiornata,
} from "@/lib/attivita-contract";
import { formattaOre } from "@/lib/formattazione";

type StatoProposte = ProposteCalendarioGiornata["stato"] | "CARICAMENTO";

/**
 * Proposte dal calendario della giornata, lette una volta al montaggio.
 *
 * Il dettaglio giornata è rimontato a ogni cambio giorno, quindi ogni apertura
 * di una giornata produce una sola lettura (e al più una richiesta a Jev per impegno).
 * Senza calendario collegato non parte alcuna richiesta.
 */
export function useProposteCalendario(data: string, calendarioCollegato: boolean) {
  const [stato, setStato] = useState<StatoProposte>(
    calendarioCollegato ? "CARICAMENTO" : "NON_COLLEGATO"
  );
  const [proposte, setProposte] = useState<PropostaCalendarioClient[]>([]);

  useEffect(() => {
    if (!calendarioCollegato) return;
    const controller = new AbortController();

    fetch(`/api/attivita/proposte-calendario?data=${encodeURIComponent(data)}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (risposta) => {
        if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
        const dati = (await risposta.json()) as ProposteCalendarioGiornata;
        setProposte(dati.proposte);
        setStato(dati.stato);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStato("ERRORE");
      });

    return () => controller.abort();
  }, [data, calendarioCollegato]);

  const rimuovi = useCallback((eventoId: string) => {
    setProposte((correnti) => correnti.filter((p) => p.eventoId !== eventoId));
  }, []);

  return { stato, proposte, rimuovi };
}

interface SezioneProposteCalendarioProps {
  data: string;
  stato: StatoProposte;
  proposte: PropostaCalendarioClient[];
  /** Rimuove una proposta gestita dall'elenco mostrato */
  onPropostaGestita: (eventoId: string) => void;
  /** Una proposta confermata è diventata riga: la giornata va riletta */
  onRigaCreata: () => void;
  /** Apre il form riga precompilato con i dati della proposta */
  onModifica: (proposta: PropostaCalendarioClient) => void;
}

/**
 * Sezione «Proposte dal calendario»: ogni impegno del giorno si può
 * confermare (se associato a cliente e offerta), modificare nel form riga o
 * rifiutare. L'inserimento manuale resta disponibile accanto.
 *
 * Le proposte stanno in un pannello chiuso che ne mostra solo il numero;
 * lettura in corso, errore e assenza di proposte restano sempre visibili.
 */
export function SezioneProposteCalendario({
  data,
  stato,
  proposte,
  onPropostaGestita,
  onRigaCreata,
  onModifica,
}: SezioneProposteCalendarioProps) {
  const [inAttesaId, setInAttesaId] = useState<string | null>(null);
  const [aperto, setAperto] = useState(false);
  const [errori, setErrori] = useState<Record<string, string>>({});

  const impostaErrore = useCallback((eventoId: string, errore: string | null) => {
    setErrori((correnti) => {
      const prossimi = { ...correnti };
      if (errore) prossimi[eventoId] = errore;
      else delete prossimi[eventoId];
      return prossimi;
    });
  }, []);

  const conferma = useCallback(
    async (proposta: PropostaCalendarioClient) => {
      if (!proposta.cliente || !proposta.offerta) return;
      const fd = new FormData();
      fd.append("clienteId", proposta.cliente.id);
      fd.append("offertaId", proposta.offerta.id);
      fd.append("ore", proposta.ore.toString());
      fd.append("data", data);
      fd.append("nota", proposta.titolo);
      fd.append("categoria", CATEGORIA_ATTIVITA_PREDEFINITA);
      fd.append("voceRimborsoTrasfertaId", "");
      fd.append("eventoCalendarioId", proposta.eventoId);

      setInAttesaId(proposta.eventoId);
      try {
        const esito = await creaRiga(fd);
        if (!esito.success) {
          impostaErrore(proposta.eventoId, esito.error ?? "Conferma non riuscita");
          return;
        }
        impostaErrore(proposta.eventoId, null);
        onPropostaGestita(proposta.eventoId);
        onRigaCreata();
      } catch {
        impostaErrore(proposta.eventoId, "Conferma non riuscita, riprova");
      } finally {
        setInAttesaId(null);
      }
    },
    [data, impostaErrore, onPropostaGestita, onRigaCreata]
  );

  const rifiuta = useCallback(
    async (proposta: PropostaCalendarioClient) => {
      setInAttesaId(proposta.eventoId);
      try {
        const esito = await rifiutaPropostaCalendario(proposta.eventoId);
        if (!esito.success) {
          impostaErrore(proposta.eventoId, esito.error ?? "Rifiuto non riuscito");
          return;
        }
        impostaErrore(proposta.eventoId, null);
        onPropostaGestita(proposta.eventoId);
      } catch {
        impostaErrore(proposta.eventoId, "Rifiuto non riuscito, riprova");
      } finally {
        setInAttesaId(null);
      }
    },
    [impostaErrore, onPropostaGestita]
  );

  if (stato === "NON_COLLEGATO") return null;

  const conProposte = stato === "COLLEGATO" && proposte.length > 0;

  // Striscia in cima all'area di inserimento: superficie neutra, separata dal
  // form da un filetto. Le azioni hanno un'area touch di 40px su smartphone.
  const classePulsante =
    "inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-testo-secondario transition-colors hover:bg-zinc-50 hover:text-testo-principale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:h-8 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

  return (
    <section
      aria-labelledby="titolo-proposte-calendario"
      aria-busy={stato === "CARICAMENTO"}
      className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <h2
        id="titolo-proposte-calendario"
        className="text-[13px] font-medium text-testo-secondario"
      >
        {conProposte ? (
          // Pattern accordion: il pulsante nel titolo apre e chiude l'elenco.
          <button
            type="button"
            aria-expanded={aperto}
            aria-controls="elenco-proposte-calendario"
            onClick={() => setAperto((corrente) => !corrente)}
            className="-mx-1 inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 hover:text-testo-principale focus-visible:outline-2 focus-visible:outline-rose-600 sm:min-h-8"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 text-testo-metadati transition-transform ${aperto ? "rotate-90" : ""}`}
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            Proposte dal calendario
            <span className="font-normal text-testo-metadati">
              · {proposte.length} da proporre
            </span>
          </button>
        ) : (
          "Proposte dal calendario"
        )}
      </h2>

      {stato === "CARICAMENTO" && (
        <p className="mt-1 text-sm text-testo-metadati">
          Lettura degli impegni dal calendario…
        </p>
      )}

      {stato === "ERRORE" && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          Impossibile leggere il calendario, prova a{" "}
          {/* Navigazione documentale verso il consenso Google, non una rotta client. */}
          <a href="/api/calendario-google/collega" className="font-medium underline">
            ricollegarlo
          </a>
          . Puoi comunque inserire le ore a mano.
        </p>
      )}

      {stato === "COLLEGATO" && proposte.length === 0 && (
        <p className="mt-1 text-sm text-testo-metadati">
          Nessun impegno da proporre per questa giornata.
        </p>
      )}

      {conProposte && (
        <ul
          id="elenco-proposte-calendario"
          hidden={!aperto}
          className="mt-2 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {proposte.map((proposta) => {
            const associata = proposta.cliente !== null && proposta.offerta !== null;
            const inAttesa = inAttesaId === proposta.eventoId;
            return (
              <li
                key={proposta.eventoId}
                data-testid="proposta-calendario"
                aria-label={`Proposta ${proposta.titolo}`}
                className="py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs tabular-nums text-testo-metadati">
                      {proposta.inizio}–{proposta.fine}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-testo-principale">
                      {proposta.titolo}
                    </div>
                    <div className="mt-0.5 text-[13px] text-testo-secondario [overflow-wrap:anywhere]">
                      {associata ? (
                        <>
                          {proposta.cliente!.ragioneSociale}
                          {" · "}
                          {[proposta.offerta!.codice, proposta.offerta!.descrizione].filter(Boolean).join(" — ")}
                          {/* Cliente e offerta arrivano solo da Jev sopra la soglia di confidenza. */}
                          <span className="text-testo-metadati"> · Suggerito dall&apos;AI</span>
                        </>
                      ) : (
                        <span className="text-amber-800 dark:text-amber-300">
                          Cliente e offerta da scegliere
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[15px] font-medium tabular-nums text-testo-principale">
                    {formattaOre(proposta.ore)}
                  </span>
                </div>

                {errori[proposta.eventoId] && (
                  <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {errori[proposta.eventoId]}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {associata && (
                    <PulsanteAttesa
                      type="button"
                      attesaEsterna={inAttesa}
                      onClick={() => conferma(proposta)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:h-8 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      Conferma
                    </PulsanteAttesa>
                  )}
                  <PulsanteAttesa
                    type="button"
                    attesaEsterna={inAttesa}
                    onClick={() => onModifica(proposta)}
                    className={classePulsante}
                  >
                    Modifica
                  </PulsanteAttesa>
                  <PulsanteAttesa
                    type="button"
                    attesaEsterna={inAttesa}
                    onClick={() => rifiuta(proposta)}
                    className={classePulsante}
                  >
                    Rifiuta
                  </PulsanteAttesa>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
