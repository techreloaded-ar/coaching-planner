"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RisultatoReportFatturazione } from "@/lib/report";
import type { VoceClienteReport } from "@/domain/consuntivi";
import {
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
  parseTokenMese,
  tokenMeseCorrente,
} from "@/domain/calendario";
import { SelettoreMese, useIdratata } from "@/components";
import { formattaEuro, formattaNumeroGiornate } from "@/lib/formattazione";

// ── Formattatori ────────────────────────────────────────────────

/** Somma le giornate fatturabili di tutte le offerte di un cliente. */
function giornateCliente(cliente: VoceClienteReport): number {
  return cliente.perOfferta.reduce(
    (totale, offerta) => totale + offerta.giornateFatturabili,
    0,
  );
}

// ── Cache client dei mesi ───────────────────────────────────────

/** Stessa finestra di freschezza della cache dell'area attività. */
const DURATA_FRESCHEZZA_MS = 300_000;

const PERCORSO_REPORT = "/report/fatturazione-clienti";

/** URL condivisibile del mese: il contratto `?mese=YYYY-MM` non cambia. */
function urlDelMese(token: string): string {
  return `${PERCORSO_REPORT}?mese=${token}`;
}

/** La sessione non è più valida: decide il server dove mandare l'utente. */
class ErroreSessioneReport extends Error {}

/**
 * Legge i dati di un mese dalla rotta dedicata. Una risposta rediretta dal
 * proxy (sessione scaduta) o un 401/403 non sono errori recuperabili.
 */
async function leggiReportMese(
  token: string,
): Promise<RisultatoReportFatturazione> {
  const risposta = await fetch(`${PERCORSO_REPORT}/dati?mese=${token}`, {
    cache: "no-store",
  });
  if (risposta.redirected || risposta.status === 401 || risposta.status === 403) {
    throw new ErroreSessioneReport();
  }
  if (!risposta.ok) throw new Error(`Report ${token}: HTTP ${risposta.status}`);
  return risposta.json();
}

interface VoceCacheReport {
  report: RisultatoReportFatturazione;
  scadenza: number;
}

// ── Props ───────────────────────────────────────────────────────

interface ReportFatturazioneClientiProps {
  /** Report del mese prodotto dal rendering server: semina la cache client. */
  report: RisultatoReportFatturazione;
}

// ── Componente ──────────────────────────────────────────────────

export default function ReportFatturazioneClienti({
  report: reportServer,
}: ReportFatturazioneClientiProps) {
  // Il mese in etichetta cambia subito; il report arriva dalla cache o dalla
  // rete. `null` significa «in caricamento»: il report non mostra mai dati di
  // un mese diverso da quello dell'etichetta.
  const [token, setToken] = useState(reportServer.token);
  const [report, setReport] = useState<RisultatoReportFatturazione | null>(
    reportServer,
  );
  const [errore, setErrore] = useState<string | null>(null);
  /** Ultimo payload ricevuto dal server, per riconoscerne uno nuovo. */
  const [payloadServer, setPayloadServer] = useState(reportServer);

  // ponytail: cache per istanza del componente, persa uscendo dalla pagina;
  // riaprire il report rilegge sempre dal server, che è il comportamento voluto.
  const cache = useRef(new Map<string, VoceCacheReport>());
  const letturaInVolo = useRef(
    new Map<string, Promise<RisultatoReportFatturazione>>(),
  );
  /** Ultima destinazione richiesta: scarta le risposte tardive. */
  const tokenRichiesto = useRef(reportServer.token);

  const clienti = report?.perCliente ?? [];
  const vuoto = report !== null && clienti.length === 0;
  const etichetta = etichettaMese(token);

  const [clienteEspansoId, setClienteEspansoId] = useState<string | null>(null);
  const idratata = useIdratata();

  const giornateTotali = clienti.reduce(
    (totale, cliente) => totale + giornateCliente(cliente),
    0,
  );

  const leggiDallaCache = useCallback((mese: string) => {
    const voce = cache.current.get(mese);
    return voce && voce.scadenza > Date.now() ? voce.report : null;
  }, []);

  /** Restituisce il mese dalla cache se fresco, altrimenti dalla rete (deduplicata). */
  const carica = useCallback(
    (mese: string): Promise<RisultatoReportFatturazione> => {
      const inCache = leggiDallaCache(mese);
      if (inCache) return Promise.resolve(inCache);

      let lettura = letturaInVolo.current.get(mese);
      if (!lettura) {
        lettura = leggiReportMese(mese)
          .then((dati) => {
            cache.current.set(mese, {
              report: dati,
              scadenza: Date.now() + DURATA_FRESCHEZZA_MS,
            });
            return dati;
          })
          .finally(() => letturaInVolo.current.delete(mese));
        letturaInVolo.current.set(mese, lettura);
      }
      return lettura;
    },
    [leggiDallaCache],
  );

  const vaiA = useCallback(
    (mese: string, registraHistory: boolean, url = urlDelMese(mese)) => {
      tokenRichiesto.current = mese;
      setToken(mese);
      setErrore(null);
      if (registraHistory) window.history.pushState(null, "", url);

      const inCache = leggiDallaCache(mese);
      if (inCache) {
        // Hit: nessuna richiesta e nessun indicatore.
        setReport(inCache);
        return;
      }

      setReport(null);
      carica(mese)
        .then((dati) => {
          // Risposta tardiva per un mese abbandonato: non tocca la vista.
          if (tokenRichiesto.current === mese) setReport(dati);
        })
        .catch((causa: unknown) => {
          if (causa instanceof ErroreSessioneReport) {
            window.location.reload();
            return;
          }
          if (tokenRichiesto.current !== mese) return;
          setErrore(`Non è stato possibile caricare ${etichettaMese(mese)}.`);
        });
    },
    [carica, leggiDallaCache],
  );

  // ── Sincronizzazione con il rendering server ─────────────────
  // Il payload del server è autorevole (URL diretto, reload, menu laterale):
  // lo stato si riallinea durante il render, come nel calendario attività.
  if (payloadServer !== reportServer) {
    setPayloadServer(reportServer);
    setToken(reportServer.token);
    setReport(reportServer);
    setErrore(null);
  }

  // La cache va seminata come effetto: è un sistema esterno a React.
  useEffect(() => {
    cache.current.set(reportServer.token, {
      report: reportServer,
      scadenza: Date.now() + DURATA_FRESCHEZZA_MS,
    });
    tokenRichiesto.current = reportServer.token;
  }, [reportServer]);

  // ── Prefetch dei mesi adiacenti al mese mostrato ─────────────
  useEffect(() => {
    if (report === null) return;
    // Errori silenziosi: il prefetch non deve mai disturbare la vista.
    void carica(mesePrecedente(report.token)).catch(() => undefined);
    void carica(meseSuccessivo(report.token)).catch(() => undefined);
  }, [carica, report]);

  // ── Back / Forward ───────────────────────────────────────────
  useEffect(() => {
    function gestisciPopstate() {
      const richiesto = new URLSearchParams(window.location.search).get("mese");
      vaiA(
        richiesto && parseTokenMese(richiesto) ? richiesto : tokenMeseCorrente(),
        false,
      );
    }

    window.addEventListener("popstate", gestisciPopstate);
    return () => window.removeEventListener("popstate", gestisciPopstate);
  }, [vaiA]);

  return (
    <div>
      {/* ── Mese ed esportazione ── */}
      {/* Su smartphone: frecce e mese, poi «Mese corrente» ed esportazione,
          ciascuno alla larghezza disponibile. */}
      <div className="mb-6 flex flex-wrap items-center gap-3 max-sm:gap-2">
        <div className="flex items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-[2.75rem_1fr_1fr_2.75rem]">
          <button
            type="button"
            // La catena dei click rapidi riparte dall'ultima intenzione.
            onClick={() => vaiA(mesePrecedente(tokenRichiesto.current), true)}
            className={CLASSE_PULSANTE_NEUTRO + " h-9 w-9 max-sm:h-11 max-sm:w-11"}
            aria-label="Mese precedente"
            title="Mese precedente"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[18px] w-[18px]"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>

          {/* L'etichetta del mese è anche l'ingresso al salto diretto, con lo
              stesso selettore del calendario attività. */}
          <div className="max-sm:col-span-2">
            <SelettoreMese
              tokenVisualizzato={token}
              onScegliMese={(mese) => vaiA(mese, true)}
            />
          </div>

          <button
            type="button"
            onClick={() => vaiA(meseSuccessivo(tokenRichiesto.current), true)}
            className={CLASSE_PULSANTE_NEUTRO + " h-9 w-9 max-sm:h-11 max-sm:w-11"}
            aria-label="Mese successivo"
            title="Mese successivo"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[18px] w-[18px]"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => vaiA(tokenMeseCorrente(), true, PERCORSO_REPORT)}
            className={
              CLASSE_PULSANTE_NEUTRO +
              " h-9 gap-2 px-3 text-sm font-medium max-sm:col-span-2 max-sm:h-11"
            }
          >
            Mese corrente
          </button>

          {report && !vuoto && (
            <a
              href={`/report/fatturazione-clienti/esporta?mese=${token}`}
              download
              data-testid="esporta-excel"
              className="ml-2 inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 max-sm:col-span-2 max-sm:ml-0 max-sm:h-11"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
              >
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Esporta Excel
            </a>
          )}
        </div>
      </div>

      {/* ── Errore di caricamento del mese ── */}
      {errore && (
        <div
          role="alert"
          data-testid="errore-caricamento-mese"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <span>{errore}</span>
          <button
            type="button"
            onClick={() => vaiA(tokenRichiesto.current, false)}
            className="inline-flex items-center rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-sm font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-100 dark:border-amber-600 dark:bg-zinc-800 dark:text-amber-200 dark:hover:bg-zinc-750"
          >
            Riprova
          </button>
        </div>
      )}

      <section
        aria-label={`Report di ${etichetta}`}
        aria-busy={report === null && !errore}
        data-idratata={idratata ? "true" : "false"}
      >
        {report === null ? (
          /* ── Indicatore di caricamento del mese (a comparsa ritardata) ── */
          !errore && (
            <div
              data-testid="indicatore-caricamento-mese"
              role="status"
              className="flex animate-[comparsa-caricamento_200ms_ease-out_120ms_forwards] items-center justify-center rounded-xl border border-zinc-200 bg-white py-14 opacity-0 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400" />
              <span className="sr-only">Caricamento del mese in corso…</span>
            </div>
          )
        ) : vuoto ? (
          /* ── Stato vuoto ── */
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-2 text-base font-semibold text-testo-principale">
              Nessuna attività da fatturare per questo mese
            </h2>
            <p className="mx-auto max-w-[420px] text-sm leading-relaxed text-testo-metadati">
              Non risultano giornate fatturabili né trasferte forfettarie
              nel mese selezionato. Cambia mese o attendi la registrazione delle
              attività dei collaboratori.
            </p>
          </div>
        ) : (
          <>
            {/* ── Una scheda per fattura: un cliente nel mese ── */}
            <div className="flex flex-col gap-4">
              {clienti.map((cliente) => {
                const giornate = giornateCliente(cliente);
                const espanso = clienteEspansoId === cliente.clienteId;
                return (
                  <article
                    key={cliente.clienteId}
                    data-testid={`report-client-${cliente.clienteId}`}
                    aria-labelledby={`cliente-${cliente.clienteId}`}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {/* Intestazione della fattura: cliente e riga di somma */}
                    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-zinc-200 px-5 py-5 max-sm:px-4 max-sm:py-4 dark:border-zinc-700">
                      <div className="min-w-0">
                        <h2
                          id={`cliente-${cliente.clienteId}`}
                          className="text-lg font-semibold text-testo-principale"
                        >
                          {cliente.clienteRagioneSociale}
                        </h2>
                        <p className="mt-0.5 text-xs tabular-nums text-testo-metadati">
                          <span>{etichetta}</span> ·{" "}
                          <span>{formattaNumeroGiornate(giornate)} giornate fatturabili</span>
                        </p>
                      </div>
                      <RigaSomma
                        evidenza
                        manodopera={cliente.imponibileManodopera}
                        trasferte={cliente.trasferteForfettarie}
                        totale={cliente.importoTotale}
                        etichettaTotale="Da fatturare"
                        idTrasferte={`report-client-${cliente.clienteId}-trasferte`}
                        idTotale={`report-client-${cliente.clienteId}-totale`}
                      />
                    </header>

                    {/* Tabella dettaglio per offerta */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            <th className={CLASSE_INTESTAZIONE + " text-left"}>Offerta</th>
                            <th className={CLASSE_INTESTAZIONE + " text-right"}>Tariffa/gg</th>
                            <th className={CLASSE_INTESTAZIONE + " text-right"}>Giornate</th>
                            <th className={CLASSE_INTESTAZIONE + " text-right"}>Imponibile</th>
                            <th className={CLASSE_INTESTAZIONE + " text-right"}>Trasferte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cliente.perOfferta.map((offerta) => (
                            <tr
                              key={offerta.offertaId ?? "senza-offerta"}
                              className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                              <td className={CLASSE_CELLA + " max-sm:min-w-48"}>
                                <div className="flex min-w-0 flex-col gap-1">
                                  <span className={classeCodiceOfferta(offerta.offertaId)}>
                                    {offerta.offertaCodice}
                                  </span>
                                  <span className="text-sm leading-snug text-testo-metadati">
                                    {offerta.offertaDescrizione}
                                  </span>
                                </div>
                              </td>
                              <td className={CLASSE_CELLA + " text-right whitespace-nowrap text-testo-metadati"}>
                                {formattaEuro(offerta.tariffaGiornaliera)}
                                {offerta.tariffaGiornaliera === null && (
                                  <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-400">
                                    tariffa da definire
                                  </span>
                                )}
                              </td>
                              <td className={CLASSE_CELLA + " text-right whitespace-nowrap text-testo-principale"}>
                                {formattaNumeroGiornate(
                                  offerta.giornateFatturabili,
                                )}
                              </td>
                              <td className={CLASSE_CELLA + " text-right whitespace-nowrap text-testo-principale"}>
                                {formattaEuro(offerta.imponibile)}
                              </td>
                              <td
                                data-testid={`report-offerta-${offerta.offertaId ?? "senza-offerta"}-trasferte`}
                                className={CLASSE_CELLA + " text-right whitespace-nowrap"}
                              >
                                {offerta.importoTrasfertaForfettaria === null ? (
                                  <span className="text-sm text-testo-metadati">
                                    Inclusa nella tariffa
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-sm text-testo-principale">
                                      {formattaEuro(offerta.importoTrasferte)}
                                    </span>
                                    <span className="text-xs text-testo-metadati">
                                      {offerta.giorniTrasferta} gg ×{" "}
                                      {formattaEuro(offerta.importoTrasfertaForfettaria)}
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Ore per collaboratore (espandibile). Il nodo resta sempre
                        nel DOM, nascosto con `hidden` quando collassato, così
                        aria-controls del bottone punta sempre a un id esistente. */}
                    <button
                      type="button"
                      onClick={() =>
                        setClienteEspansoId(espanso ? null : cliente.clienteId)
                      }
                      aria-expanded={espanso}
                      aria-controls={`dettaglio-collaboratori-${cliente.clienteId}`}
                      className="flex w-full cursor-pointer items-center gap-2 px-5 py-3 text-left text-sm font-medium text-testo-secondario transition-colors hover:bg-zinc-50 hover:text-testo-principale focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 max-sm:min-h-11 max-sm:px-4 dark:hover:bg-zinc-800/50"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className={`h-4 w-4 shrink-0 text-testo-metadati transition-transform ${
                          espanso ? "rotate-180" : ""
                        }`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                      Ore per collaboratore
                      <span className="sr-only"> di {cliente.clienteRagioneSociale}</span>
                    </button>
                    <section
                      role="region"
                      id={`dettaglio-collaboratori-${cliente.clienteId}`}
                      aria-label={`Dettaglio collaboratori ${cliente.clienteRagioneSociale}`}
                      hidden={!espanso}
                      className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 max-sm:px-4 dark:border-zinc-700 dark:bg-zinc-800/60"
                    >
                      {cliente.perOfferta.every(
                        (offerta) => offerta.perCollaboratore.length === 0,
                      ) ? (
                        <p className="text-sm text-testo-metadati">
                          Nessuna ora fatturabile nel mese: il cliente compare
                          solo per trasferte forfettarie
                        </p>
                      ) : (
                        <div className="flex flex-col gap-5">
                          {cliente.perOfferta
                            .filter((offerta) => offerta.perCollaboratore.length > 0)
                            .map((offerta) => (
                            <div
                              key={offerta.offertaId ?? "senza-offerta"}
                              data-testid={`dettaglio-offerta-${offerta.offertaCodice}`}
                            >
                              <div className="mb-2 flex min-w-0 flex-col gap-1">
                                <span className={classeCodiceOfferta(offerta.offertaId)}>
                                  {offerta.offertaCodice}
                                </span>
                                <span className="text-sm leading-snug text-testo-metadati">
                                  {offerta.offertaDescrizione}
                                </span>
                              </div>
                              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                                <table className="w-full border-collapse text-sm">
                                  <thead>
                                    <tr>
                                      <th className={CLASSE_INTESTAZIONE_COMPATTA + " text-left"}>Collaboratore</th>
                                      <th className={CLASSE_INTESTAZIONE_COMPATTA + " text-right"}>Ore fatturabili</th>
                                      <th className={CLASSE_INTESTAZIONE_COMPATTA + " text-right"}>Giornate</th>
                                      <th className={CLASSE_INTESTAZIONE_COMPATTA + " text-right"}>Imponibile</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {offerta.perCollaboratore.map((voce) => (
                                      <tr key={voce.collaboratoreId}>
                                        <td className={CLASSE_CELLA_COMPATTA + " font-medium text-testo-principale"}>
                                          {voce.collaboratoreNome}
                                        </td>
                                        <td className={CLASSE_CELLA_COMPATTA + " text-right whitespace-nowrap text-testo-metadati"}>
                                          {formattaNumeroGiornate(
                                            voce.oreFatturabili,
                                          )}{" "}
                                          h
                                        </td>
                                        <td className={CLASSE_CELLA_COMPATTA + " text-right whitespace-nowrap text-testo-principale"}>
                                          {formattaNumeroGiornate(
                                            voce.giornateFatturabili,
                                          )}{" "}
                                          gg
                                        </td>
                                        <td className={CLASSE_CELLA_COMPATTA + " text-right whitespace-nowrap text-testo-principale"}>
                                          {formattaEuro(voce.imponibile)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </article>
                );
              })}
            </div>

            {/* ── Totale del mese, in fondo: le fatture si emettono per cliente ── */}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 rounded-xl border border-zinc-200 bg-zinc-100/60 px-5 py-4 max-sm:px-4 dark:border-zinc-700 dark:bg-zinc-800/60">
              <div>
                <h2 className="text-sm font-medium text-testo-principale">
                  Totale del mese
                </h2>
                <p className="mt-0.5 text-xs tabular-nums text-testo-metadati">
                  {clienti.length} {clienti.length === 1 ? "cliente" : "clienti"} ·{" "}
                  {formattaNumeroGiornate(giornateTotali)} giornate fatturabili
                </p>
              </div>
              <RigaSomma
                manodopera={report.totali.imponibileManodopera}
                trasferte={report.totali.totaleTrasferteForfettarie}
                totale={report.totali.importoTotale}
                etichettaTotale="Importo totale"
                idManodopera="report-total-imponibile"
                idTrasferte="report-total-trasferte"
                idTotale="report-total-importo"
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── Riga di somma: manodopera + trasferte = totale ─────────────────

function RigaSomma({
  manodopera,
  trasferte,
  totale,
  etichettaTotale,
  evidenza = false,
  idManodopera,
  idTrasferte,
  idTotale,
}: {
  manodopera: string;
  trasferte: string;
  totale: string;
  etichettaTotale: string;
  /** Il totale della fattura del cliente: grande e in accento. */
  evidenza?: boolean;
  idManodopera?: string;
  idTrasferte?: string;
  idTotale?: string;
}) {
  // Su smartphone il totale viene prima e le componenti seguono in colonna.
  const classeComponente =
    "text-right max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:text-left";
  const classeValore = evidenza
    ? "block text-base text-testo-principale max-sm:inline"
    : "block text-sm text-testo-secondario max-sm:inline";
  return (
    <div className="flex items-end gap-4 tabular-nums max-sm:w-full max-sm:flex-col max-sm:items-stretch max-sm:gap-1">
      <div className={classeComponente}>
        <span className="block text-xs font-medium text-testo-metadati max-sm:inline">
          Manodopera
        </span>
        <span data-testid={idManodopera} className={classeValore}>
          {formattaEuro(manodopera)}
        </span>
      </div>
      <span aria-hidden="true" className="pb-0.5 text-zinc-400 max-sm:hidden dark:text-zinc-500">
        +
      </span>
      <div className={classeComponente}>
        <span className="block text-xs font-medium text-testo-metadati max-sm:inline">
          Trasferte forfettarie
        </span>
        <span data-testid={idTrasferte} className={classeValore}>
          {formattaEuro(trasferte)}
        </span>
      </div>
      <span aria-hidden="true" className="pb-0.5 text-zinc-400 max-sm:hidden dark:text-zinc-500">
        =
      </span>
      <div className="text-right max-sm:order-first max-sm:mb-2 max-sm:text-left">
        <span
          className={`block text-xs font-medium ${
            evidenza ? "text-indigo-700 dark:text-indigo-300" : "text-testo-metadati"
          }`}
        >
          {etichettaTotale}
        </span>
        <span
          data-testid={idTotale}
          className={
            evidenza
              ? "block text-[28px] leading-tight font-semibold text-indigo-600 max-sm:text-2xl dark:text-indigo-400"
              : "block text-lg leading-tight font-semibold text-testo-principale"
          }
        >
          {formattaEuro(totale)}
        </span>
      </div>
    </div>
  );
}

const CLASSE_PULSANTE_NEUTRO =
  "inline-flex items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-testo-secondario shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-100";

const CLASSE_INTESTAZIONE =
  "border-b border-zinc-200 px-5 py-2.5 text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700";

const CLASSE_CELLA =
  "border-b border-zinc-100 px-5 py-3 align-middle tabular-nums dark:border-zinc-700/50";

const CLASSE_INTESTAZIONE_COMPATTA =
  "border-b border-zinc-200 px-4 py-2 text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700";

const CLASSE_CELLA_COMPATTA =
  "border-b border-zinc-100 px-4 py-2 align-middle tabular-nums dark:border-zinc-700/50 [tr:last-child_&]:border-b-0";

/** Badge del codice offerta: la voce senza offerta è evidenziata come da assegnare. */
function classeCodiceOfferta(offertaId: string | null): string {
  return offertaId === null
    ? "inline-block w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : "inline-block w-fit rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800";
}
