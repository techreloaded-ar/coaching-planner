"use client";

import { useCallback, useEffect, useState } from "react";
import { creaRiga } from "@/lib/actions/righe-attivita";
import { rifiutaPropostaCalendario } from "@/lib/actions/calendario-google";
import { PulsanteAttesa } from "@/components";
import type {
  PropostaCalendarioClient,
  ProposteCalendarioGiornata,
} from "@/lib/attivita-contract";

type StatoProposte = ProposteCalendarioGiornata["stato"] | "CARICAMENTO";

/**
 * Proposte dal calendario della giornata, lette una volta al montaggio.
 *
 * Il dettaglio giornata è rimontato a ogni cambio giorno, quindi ogni apertura
 * di una giornata produce una sola lettura (e al più una chiamata a Gemini).
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

function formattaOre(ore: number): string {
  return ore.toString().replace(".", ",");
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
      fd.append("fatturabile", "on");
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

  return (
    <section
      aria-labelledby="titolo-proposte-calendario"
      aria-busy={stato === "CARICAMENTO"}
      className="mb-8"
    >
      <h2
        id="titolo-proposte-calendario"
        className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400 dark:text-zinc-500"
      >
        {conProposte ? (
          // Pattern accordion: il pulsante nel titolo apre e chiude l'elenco.
          <button
            type="button"
            aria-expanded={aperto}
            aria-controls="elenco-proposte-calendario"
            onClick={() => setAperto((corrente) => !corrente)}
            className="inline-flex items-center gap-1.5 uppercase tracking-[0.07em] hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <span aria-hidden="true" className={`transition-transform ${aperto ? "rotate-90" : ""}`}>
              ▸
            </span>
            Proposte dal calendario
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 normal-case tracking-normal text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              · {proposte.length} da proporre
            </span>
          </button>
        ) : (
          "Proposte dal calendario"
        )}
      </h2>

      {stato === "CARICAMENTO" && (
        <p className="rounded-[11px] border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-3 text-[12.5px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
          Lettura degli impegni dal calendario…
        </p>
      )}

      {stato === "ERRORE" && (
        <p
          role="alert"
          className="rounded-[11px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Impossibile leggere il calendario, prova a{" "}
          {/* Navigazione documentale verso il consenso Google, non una rotta client. */}
          <a href="/api/calendario-google/collega" className="font-semibold underline">
            ricollegarlo
          </a>
          . Puoi comunque inserire le ore a mano.
        </p>
      )}

      {stato === "COLLEGATO" && proposte.length === 0 && (
        <p className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-[12.5px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          Nessun impegno da proporre per questa giornata.
        </p>
      )}

      {conProposte && (
        <ul id="elenco-proposte-calendario" hidden={!aperto} className="space-y-2.5">
          {proposte.map((proposta) => {
            const associata = proposta.cliente !== null && proposta.offerta !== null;
            const inAttesa = inAttesaId === proposta.eventoId;
            return (
              <li
                key={proposta.eventoId}
                data-testid="proposta-calendario"
                aria-label={`Proposta ${proposta.titolo}`}
                className="rounded-[11px] border border-indigo-200 bg-indigo-50/40 p-[13px_15px] dark:border-indigo-800 dark:bg-indigo-950/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">
                      {proposta.titolo}
                    </div>
                    <div className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                      {proposta.inizio}–{proposta.fine}
                    </div>
                    <div className="mt-1.5 text-[12.5px] text-zinc-600 dark:text-zinc-300">
                      {associata ? (
                        <>
                          <span className="font-semibold">{proposta.cliente!.ragioneSociale}</span>
                          {" · "}
                          {proposta.offerta!.codice} — {proposta.offerta!.descrizione}
                          {/* Cliente e offerta arrivano solo da Gemini a confidenza alta. */}
                          <span className="ml-2 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10.5px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            Suggerito dall&apos;AI
                          </span>
                        </>
                      ) : (
                        <span className="italic text-amber-700 dark:text-amber-400">
                          Cliente e offerta da scegliere
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-indigo-800 dark:text-indigo-300">
                    {formattaOre(proposta.ore)} h
                  </span>
                </div>

                {errori[proposta.eventoId] && (
                  <p role="alert" className="mt-2 text-[12px] text-red-600 dark:text-red-400">
                    {errori[proposta.eventoId]}
                  </p>
                )}

                <div className="mt-[10px] flex items-center gap-2 border-t border-indigo-100 pt-[10px] dark:border-indigo-900">
                  {associata && (
                    <PulsanteAttesa
                      type="button"
                      attesaEsterna={inAttesa}
                      onClick={() => conferma(proposta)}
                      className="inline-flex items-center rounded-[8px] bg-indigo-600 px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Conferma
                    </PulsanteAttesa>
                  )}
                  <PulsanteAttesa
                    type="button"
                    attesaEsterna={inAttesa}
                    onClick={() => onModifica(proposta)}
                    className="inline-flex items-center rounded-[8px] border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Modifica
                  </PulsanteAttesa>
                  <PulsanteAttesa
                    type="button"
                    attesaEsterna={inAttesa}
                    onClick={() => rifiuta(proposta)}
                    className="inline-flex items-center rounded-[8px] border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400"
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
