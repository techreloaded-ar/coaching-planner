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
import { formattaEuro, inizialiCliente } from "@/lib/formattazione";

// ── Formattatori ────────────────────────────────────────────────

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

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
      {/* ── Barra di navigazione del mese ── */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            // La catena dei click rapidi riparte dall'ultima intenzione.
            onClick={() => vaiA(mesePrecedente(tokenRichiesto.current), true)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Mese precedente"
            title="Mese precedente"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[18px] w-[18px]"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>

          {/* L'etichetta del mese è anche l'ingresso al salto diretto, con lo
              stesso selettore del calendario attività. */}
          <SelettoreMese
            tokenVisualizzato={token}
            onScegliMese={(mese) => vaiA(mese, true)}
          />

          <button
            type="button"
            onClick={() => vaiA(meseSuccessivo(tokenRichiesto.current), true)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Mese successivo"
            title="Mese successivo"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[18px] w-[18px]"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => vaiA(tokenMeseCorrente(), true, PERCORSO_REPORT)}
            className="ml-1 inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
            Mese corrente
          </button>
        </div>

        <div className="flex-1" />

        {report && !vuoto && (
          <div className="flex items-center gap-3">
            <a
              href={`/report/fatturazione-clienti/esporta?mese=${token}`}
              download
              data-testid="esporta-excel"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 dark:hover:text-zinc-100"
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

            {/* Pill riepilogo mese */}
            <div className="inline-flex items-center gap-[9px] rounded-full border border-indigo-200 bg-indigo-50 px-[14px] py-1.5 text-[12.5px] font-semibold text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-[15px] w-[15px]"
              >
                <path d="M3 21V8.5L9 4l6 4.5V21" />
                <path d="M15 21h6V11l-6-3" />
              </svg>
              <span>
                <b className="tabular-nums">{clienti.length}</b>{" "}
                {clienti.length === 1 ? "cliente" : "clienti"}
              </span>
              <span className="h-[13px] w-px bg-indigo-200 dark:bg-indigo-500/40" />
              <span>
                <b className="tabular-nums">
                  {formattatoreGiornate.format(giornateTotali)}
                </b>{" "}
                giornate
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Errore di caricamento del mese ── */}
      {errore && (
        <div
          role="alert"
          data-testid="errore-caricamento-mese"
          className="mb-[14px] flex flex-wrap items-center gap-3 rounded-[11px] border border-amber-300 bg-amber-50 px-[13px] py-2.5 text-[13px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <span>{errore}</span>
          <button
            type="button"
            onClick={() => vaiA(tokenRichiesto.current, false)}
            className="inline-flex items-center rounded-[9px] border border-amber-400 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 dark:border-amber-600 dark:bg-zinc-800 dark:text-amber-200 dark:hover:bg-zinc-750"
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
              className="flex animate-[comparsa-caricamento_200ms_ease-out_120ms_forwards] items-center justify-center rounded-[11px] border border-zinc-200 bg-white py-14 opacity-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400" />
              <span className="sr-only">Caricamento del mese in corso…</span>
            </div>
          )
        ) : vuoto ? (
          /* ── Stato vuoto ── */
          <div className="rounded-[11px] border border-zinc-200 bg-white px-6 py-14 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-6 w-6"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 14h6M9 17h4" />
              </svg>
            </div>
            <h3 className="mb-[7px] text-[16px] font-bold text-zinc-800 dark:text-zinc-100">
              Nessuna attività da fatturare per questo mese
            </h3>
            <p className="mx-auto max-w-[420px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              Non risultano giornate fatturabili né trasferte forfettarie
              nel mese selezionato. Cambia mese o attendi la registrazione delle
              attività dei collaboratori.
            </p>
          </div>
        ) : (
          <>
            {/* ── Elenco schede per cliente ── */}
            <div className="flex flex-col gap-[18px]">
              {clienti.map((cliente) => {
                const giornate = giornateCliente(cliente);
                const espanso = clienteEspansoId === cliente.clienteId;
                return (
                  <div
                    key={cliente.clienteId}
                    data-testid={`report-client-${cliente.clienteId}`}
                    className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {/* Intestazione: ragione sociale + importo totale (espande il dettaglio collaboratori) */}
                    <button
                      type="button"
                      onClick={() =>
                        setClienteEspansoId(
                          espanso ? null : cliente.clienteId,
                        )
                      }
                      aria-expanded={espanso}
                      aria-controls={`dettaglio-collaboratori-${cliente.clienteId}`}
                      aria-label={`Dettaglio collaboratori ${cliente.clienteRagioneSociale}, da fatturare ${formattaEuro(cliente.importoTotale)}`}
                      className="flex w-full flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 text-left cursor-pointer dark:border-zinc-700 dark:bg-zinc-800/60"
                    >
                      <div className="flex min-w-0 items-center gap-[13px]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-indigo-50 text-[14px] font-extrabold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                          {inizialiCliente(cliente.clienteRagioneSociale)}
                        </div>
                        <div className="min-w-0 leading-[1.3]">
                          <b className="block text-[16px] font-bold -tracking-[0.01em] text-zinc-800 dark:text-zinc-100">
                            {cliente.clienteRagioneSociale}
                          </b>
                          <span className="text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">
                            {formattatoreGiornate.format(giornate)} giornate
                            fatturabili
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right leading-[1.15]">
                          <span className="mb-[3px] block text-[10.5px] font-bold uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
                            Da fatturare
                          </span>
                          <span className="text-[26px] font-extrabold -tracking-[0.03em] tabular-nums text-indigo-600 dark:text-indigo-400">
                            {formattaEuro(cliente.importoTotale)}
                          </span>
                        </div>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${
                            espanso ? "rotate-180" : ""
                          }`}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </button>

                    {/* Tabella dettaglio per offerta */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[13.5px]">
                        <thead>
                          <tr>
                            <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                              Offerta
                            </th>
                            <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                              Tariffa/gg
                            </th>
                            <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                              Giornate
                            </th>
                            <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                              Imponibile
                            </th>
                            <th className="border-b border-zinc-200 bg-white px-5 py-[11px] text-right text-[10.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                              Trasferte
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cliente.perOfferta.map((offerta) => (
                            <tr
                              key={offerta.offertaId ?? "senza-offerta"}
                              className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                              <td className="border-b border-zinc-100 px-5 py-[13px] align-middle dark:border-zinc-700/50">
                                <div className="flex min-w-0 flex-col gap-1">
                                  <span className={classeCodiceOfferta(offerta.offertaId)}>
                                    {offerta.offertaCodice}
                                  </span>
                                  <span className="text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                                    {offerta.offertaDescrizione}
                                  </span>
                                </div>
                              </td>
                              <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                                {formattaEuro(offerta.tariffaGiornaliera)}
                                {offerta.tariffaGiornaliera === null && (
                                  <span className="mt-[3px] block text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                    tariffa da definire
                                  </span>
                                )}
                              </td>
                              <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                {formattatoreGiornate.format(
                                  offerta.giornateFatturabili,
                                )}
                              </td>
                              <td className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle text-[14px] font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                {formattaEuro(offerta.imponibile)}
                              </td>
                              <td
                                data-testid={`report-offerta-${offerta.offertaId ?? "senza-offerta"}-trasferte`}
                                className="border-b border-zinc-100 px-5 py-[13px] text-right align-middle tabular-nums whitespace-nowrap dark:border-zinc-700/50"
                              >
                                {offerta.importoTrasfertaForfettaria === null ? (
                                  <span className="text-[12.5px] text-zinc-400 dark:text-zinc-500">
                                    Inclusa nella tariffa
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end gap-[2px]">
                                    <span className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">
                                      {formattaEuro(offerta.importoTrasferte)}
                                    </span>
                                    <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
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

                    {/* Dettaglio collaboratori per offerta (espandibile). Il nodo resta
                        sempre nel DOM, nascosto con `hidden` quando collassato, così
                        aria-controls del bottone punta sempre a un id esistente. */}
                    <section
                      role="region"
                      id={`dettaglio-collaboratori-${cliente.clienteId}`}
                      aria-label={`Dettaglio collaboratori ${cliente.clienteRagioneSociale}`}
                      hidden={!espanso}
                      className="border-b border-zinc-200 bg-zinc-50/60 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800/40"
                    >
                      <div className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="h-[14px] w-[14px]"
                          >
                            <circle cx="9" cy="8" r="3.2" />
                            <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
                            <circle cx="17.2" cy="9.2" r="2.4" />
                            <path d="M15.5 14.3a5 5 0 0 1 5.7 4.7" />
                          </svg>
                          Ore erogate per collaboratore
                        </div>

                        {cliente.perOfferta.every(
                          (offerta) => offerta.perCollaboratore.length === 0,
                        ) ? (
                          <p className="text-[13px] italic text-zinc-400 dark:text-zinc-500">
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
                                  <span className="text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                                    {offerta.offertaDescrizione}
                                  </span>
                                </div>
                                <div className="overflow-x-auto rounded-[8px] border border-zinc-200 dark:border-zinc-700">
                                  <table className="w-full border-collapse text-[13px]">
                                    <thead>
                                      <tr>
                                        <th className="border-b border-zinc-200 bg-white px-4 py-2 text-left text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                          Collaboratore
                                        </th>
                                        <th className="border-b border-zinc-200 bg-white px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                          Ore fatturabili
                                        </th>
                                        <th className="border-b border-zinc-200 bg-white px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                          Giornate
                                        </th>
                                        <th className="border-b border-zinc-200 bg-white px-4 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                                          Imponibile
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {offerta.perCollaboratore.map((voce) => (
                                        <tr
                                          key={voce.collaboratoreId}
                                          className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                        >
                                          <td className="border-b border-zinc-100 px-4 py-[9px] align-middle font-semibold text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                            {voce.collaboratoreNome}
                                          </td>
                                          <td className="border-b border-zinc-100 px-4 py-[9px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
                                            {formattatoreGiornate.format(
                                              voce.oreFatturabili,
                                            )}{" "}
                                            h
                                          </td>
                                          <td className="border-b border-zinc-100 px-4 py-[9px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
                                            {formattatoreGiornate.format(
                                              voce.giornateFatturabili,
                                            )}{" "}
                                            gg
                                          </td>
                                          <td className="border-b border-zinc-100 px-4 py-[9px] text-right align-middle font-bold tabular-nums whitespace-nowrap text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-100">
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

                    {/* Trasferte forfettarie fatturate al cliente */}
                    <div className="flex items-center justify-between gap-[14px] border-b border-zinc-100 bg-white px-5 py-3 dark:border-zinc-700/50 dark:bg-zinc-800">
                      <div className="flex items-center gap-[9px] text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
                        >
                          <path d="M3 12h18M3 12l4-4M3 12l4 4" />
                          <path d="M21 6v12" />
                        </svg>
                        Trasferte forfettarie
                      </div>
                      <span
                        data-testid={`report-client-${cliente.clienteId}-trasferte`}
                        className="text-[14px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100"
                      >
                        {formattaEuro(cliente.trasferteForfettarie)}
                      </span>
                    </div>

                    {/* Totale da fatturare del cliente */}
                    <div className="flex items-center justify-between gap-[14px] border-t border-indigo-200 bg-indigo-50 px-5 py-[15px] dark:border-indigo-500/40 dark:bg-indigo-500/10">
                      <div className="flex items-center gap-[9px] text-[12px] font-bold uppercase tracking-[0.04em] text-indigo-700 dark:text-indigo-300">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          className="h-4 w-4"
                        >
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        Totale da fatturare
                      </div>
                      <span
                        data-testid={`report-client-${cliente.clienteId}-totale`}
                        className="text-[20px] font-extrabold -tracking-[0.02em] tabular-nums text-indigo-600 dark:text-indigo-400"
                      >
                        {formattaEuro(cliente.importoTotale)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Scheda totale complessivo del mese ── */}
            <div className="relative mt-[22px] overflow-hidden rounded-[11px] border border-indigo-700 bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-[22px] text-white shadow-lg">
              <div className="mb-4 flex items-center gap-[9px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/80">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  className="h-4 w-4"
                >
                  <path d="M3 3v18h18" />
                  <path d="M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6" />
                </svg>
                Totale complessivo da fatturare — {etichetta}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="flex flex-wrap items-stretch">
                  <div className="mr-[26px] border-r border-white/20 pr-[26px]">
                    <div className="mb-[5px] text-[11.5px] font-semibold text-white/80">
                      Imponibile manodopera
                    </div>
                    <div
                      data-testid="report-total-imponibile"
                      className="text-[19px] font-bold -tracking-[0.02em] tabular-nums"
                    >
                      {formattaEuro(report.totali.imponibileManodopera)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-[5px] text-[11.5px] font-semibold text-white/80">
                      Totale trasferte forfettarie
                    </div>
                    <div
                      data-testid="report-total-trasferte"
                      className="text-[19px] font-bold -tracking-[0.02em] tabular-nums"
                    >
                      {formattaEuro(report.totali.totaleTrasferteForfettarie)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.05em] text-white/80">
                    Importo totale
                  </div>
                  <div
                    data-testid="report-total-importo"
                    className="text-[38px] leading-none font-extrabold -tracking-[0.04em] tabular-nums"
                  >
                    {formattaEuro(report.totali.importoTotale)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Badge del codice offerta: la voce senza offerta è evidenziata come da assegnare. */
function classeCodiceOfferta(offertaId: string | null): string {
  return offertaId === null
    ? "inline-block w-fit rounded-[6px] border border-amber-200 bg-amber-50 px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : "inline-block w-fit rounded-[6px] border border-zinc-200 bg-zinc-50 px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
}
