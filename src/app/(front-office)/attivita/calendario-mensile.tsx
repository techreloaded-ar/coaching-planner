"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  costruisciGrigliaMese,
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
  parseTokenMese,
  tokenMeseCorrente,
  type CellaGiorno,
} from "@/domain/calendario";
import type { DatiCalendarioMese } from "@/lib/attivita-contract";
import { useIdratata } from "@/components";
import {
  ErroreSessioneCalendario,
  useCacheCalendario,
} from "./calendario-cache-provider";

// ── Helpers ─────────────────────────────────────────────────────

/** Mantiene il giorno civile delle date del calendario tra server e browser. */
function dataCalendario(data: Date | string): Date {
  if (typeof data !== "string") return data;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(data);
}

/** Formatta una data in YYYY-MM-DD. Supporta Date e stringa ISO. */
function formattaDataISO(data: Date | string): string {
  const d = dataCalendario(data);
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

/** Verifica se due date sono lo stesso giorno. Supporta stringhe ISO e Date. */
function stessoGiorno(a: Date | string, b: Date | string): boolean {
  const da = dataCalendario(a);
  const db = dataCalendario(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** URL condivisibile del mese: il contratto `?mese=YYYY-MM` non cambia. */
function urlDelMese(token: string): string {
  return `/attivita?mese=${token}`;
}

// ═══════════════════════════════════════════════════════════════
// Intento di navigazione
// ═══════════════════════════════════════════════════════════════

/**
 * Destinazione richiesta dall'utente.
 *
 * Serve a distinguere l'ultima intenzione dalle risposte tardive: una lettura
 * lenta di un mese abbandonato non deve sovrascrivere il mese che l'utente sta
 * guardando adesso.
 */
interface IntentoNavigazione {
  token: string;
  /** Se registrare una nuova entry nella history (falso per Back/Forward). */
  registraHistory: boolean;
  /** URL da scrivere: il pulsante «Mese corrente» resta su `/attivita`. */
  url?: string;
}

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

interface CalendarioMensileProps {
  /** DTO del mese prodotto dal rendering server: semina la cache client. */
  datiMeseIniziale: DatiCalendarioMese;
  /** Data corrente in formato ISO string */
  oggi: string;
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

export default function CalendarioMensile({
  datiMeseIniziale,
  oggi,
}: CalendarioMensileProps) {
  const oggiDate = new Date(oggi);

  const router = useRouter();
  const cache = useCacheCalendario();
  const idratata = useIdratata();

  // Il mese mostrato è deciso dal client: SSR fornisce il primo valore, poi la
  // navigazione avviene sulla cache dei mesi senza navigazioni RSC.
  const [meseVisualizzato, setMeseVisualizzato] = useState(datiMeseIniziale);
  const [inCaricamento, setInCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  /** Ultimo payload ricevuto dal server, per riconoscerne uno nuovo. */
  const [payloadServer, setPayloadServer] = useState(datiMeseIniziale);

  const intentoCorrente = useRef<IntentoNavigazione>({
    token: datiMeseIniziale.token,
    registraHistory: false,
  });

  const tokenVisualizzato = meseVisualizzato.token;
  const sintesi = meseVisualizzato.sintesiPerGiorno;

  // Etichetta e griglia sono derivate localmente dalle funzioni pure del
  // dominio: non viaggiano nel payload né RSC né JSON.
  const etichetta = useMemo(
    () => etichettaMese(tokenVisualizzato),
    [tokenVisualizzato]
  );
  const griglia = useMemo<CellaGiorno[]>(
    () => costruisciGrigliaMese(tokenVisualizzato),
    [tokenVisualizzato]
  );

  const commit = useCallback(
    (intento: IntentoNavigazione, dati: DatiCalendarioMese) => {
      setMeseVisualizzato(dati);
      setInCaricamento(false);
      setErrore(null);

      // L'URL viene registrato solo ora, quando il mese è davvero pronto.
      if (intento.registraHistory) {
        window.history.pushState(null, "", intento.url ?? urlDelMese(intento.token));
      }
    },
    []
  );

  const vaiA = useCallback(
    (intento: IntentoNavigazione) => {
      intentoCorrente.current = intento;
      const destinazione = intento.token;

      // Senza isola client (provider assente) resta la navigazione RSC.
      if (!cache) {
        router.push(intento.url ?? urlDelMese(destinazione));
        return;
      }

      const lettura = cache.read(destinazione);

      if (lettura) {
        // Hit: commit sincrono, nessuna richiesta e nessun indicatore.
        commit(intento, lettura.dati);

        if (lettura.stato === "scaduto") {
          // Una sola rivalidazione in background: la griglia resta quella.
          void cache.load(destinazione).catch(() => undefined);
        }
        return;
      }

      // Miss: la griglia precedente resta visibile sotto l'indicatore.
      setErrore(null);
      setInCaricamento(true);

      cache
        .load(destinazione)
        .then((dati) => {
          // Risposta tardiva per un mese abbandonato: non tocca la vista.
          if (intentoCorrente.current.token !== destinazione) return;
          commit(intento, dati);
        })
        .catch((causa: unknown) => {
          // La sessione decaduta è gestita dal provider con una navigazione
          // completa: qui non si mostra un errore recuperabile.
          if (causa instanceof ErroreSessioneCalendario) return;
          if (intentoCorrente.current.token !== destinazione) return;

          setInCaricamento(false);
          setErrore(
            `Non è stato possibile caricare ${etichettaMese(destinazione)}.`
          );
        });
    },
    [cache, commit, router]
  );

  // ── Sincronizzazione con il rendering server ─────────────────
  // Il payload del server è autorevole: vale al mount e ogni volta che il
  // server ne produce uno nuovo (URL diretto, reload, ritorno dal dettaglio
  // giornata, `router.refresh()` dopo una mutazione). L'allineamento avviene
  // durante il render — il pattern React per adeguare lo stato a una prop
  // cambiata — e non in un effetto, che provocherebbe un render a cascata.
  if (payloadServer !== datiMeseIniziale) {
    setPayloadServer(datiMeseIniziale);
    setMeseVisualizzato(datiMeseIniziale);
    setInCaricamento(false);
    setErrore(null);
  }

  // La cache va seminata come effetto: è un sistema esterno a React.
  useEffect(() => {
    cache?.seed(datiMeseIniziale);
    intentoCorrente.current = {
      token: datiMeseIniziale.token,
      registraHistory: false,
    };
  }, [cache, datiMeseIniziale]);

  // ── Prefetch dei mesi adiacenti dopo il commit ───────────────
  useEffect(() => {
    if (!cache) return;
    cache.prefetch(mesePrecedente(tokenVisualizzato));
    cache.prefetch(meseSuccessivo(tokenVisualizzato));
  }, [cache, tokenVisualizzato]);

  // ── Aggiornamenti in background del mese mostrato ────────────
  useEffect(() => {
    if (!cache) return;
    return cache.subscribe((tokenAggiornato) => {
      if (tokenAggiornato !== intentoCorrente.current.token) return;
      const lettura = cache.read(tokenAggiornato);
      if (lettura) setMeseVisualizzato(lettura.dati);
    });
  }, [cache]);

  // ── Sessione decaduta: navigazione completa ──────────────────
  useEffect(() => {
    if (!cache) return;
    return cache.subscribeSessioneScaduta(() => {
      // Il server decide dove mandare l'utente: la cache è già svuotata.
      window.location.reload();
    });
  }, [cache]);

  // ── Limite reale della staleness: scadenza, focus e visibilità ─
  useEffect(() => {
    if (!cache) return;

    const lettura = cache.read(tokenVisualizzato);
    const ritardo = lettura ? Math.max(0, lettura.expiresAt - Date.now()) : 0;

    const timer = window.setTimeout(() => {
      cache.prefetch(tokenVisualizzato);
    }, ritardo);

    // Al ritorno sulla scheda si forza la rivalidazione, anche se la entry è
    // ancora fresca: `prefetch` uscirebbe subito e il ritorno sulla scheda non
    // delimiterebbe alcuna staleness. È anche il momento in cui la risposta
    // rivela un eventuale cambio di sessione avvenuto in un'altra scheda.
    function rivalidaAlRitorno() {
      if (document.visibilityState !== "visible") return;
      void cache!.revalida(tokenVisualizzato).catch(() => undefined);
    }

    window.addEventListener("focus", rivalidaAlRitorno);
    document.addEventListener("visibilitychange", rivalidaAlRitorno);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", rivalidaAlRitorno);
      document.removeEventListener("visibilitychange", rivalidaAlRitorno);
    };
    // `meseVisualizzato` riarma il timer dopo ogni aggiornamento del mese.
  }, [cache, tokenVisualizzato, meseVisualizzato]);

  // ── Back / Forward ───────────────────────────────────────────
  useEffect(() => {
    function gestisciPopstate() {
      const richiesto = new URLSearchParams(window.location.search).get("mese");
      const token =
        richiesto && parseTokenMese(richiesto) ? richiesto : tokenMeseCorrente();

      // Back/Forward ripercorre la history: non crea una nuova entry.
      vaiA({ token, registraHistory: false });
    }

    window.addEventListener("popstate", gestisciPopstate);
    return () => window.removeEventListener("popstate", gestisciPopstate);
  }, [vaiA]);

  // ── Gestori dei controlli mese ───────────────────────────────

  function navigaVersoMese(calcolaDestinazione: (base: string) => string) {
    // La catena dei click rapidi riparte dall'ultima intenzione, non dal mese
    // ancora mostrato.
    const base = intentoCorrente.current.token;
    vaiA({ token: calcolaDestinazione(base), registraHistory: true });
  }

  function navigaVersoMeseCorrente() {
    vaiA({
      token: tokenMeseCorrente(),
      registraHistory: true,
      url: "/attivita",
    });
  }

  function ritentaMese() {
    vaiA(intentoCorrente.current);
  }

  // Totale mese
  const totaleRighe = useMemo(() => {
    let r = 0;
    for (const s of Object.values(sintesi)) r += s.righe;
    return r;
  }, [sintesi]);

  const totaleOre = useMemo(() => {
    let o = 0;
    for (const s of Object.values(sintesi)) o += s.oreTotali;
    return o;
  }, [sintesi]);

  // Giorni della settimana
  const giorniSettimana = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7">
      {/* ── Barra navigazione mese ── */}
      <div className="mb-[18px] flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigaVersoMese(mesePrecedente)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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

          <div
            data-testid="calendar-month-label"
            className="min-w-[188px] text-center text-[19px] font-bold capitalize -tracking-[0.02em] text-zinc-800 dark:text-zinc-100"
          >
            {etichetta}
          </div>

          <button
            type="button"
            onClick={() => navigaVersoMese(meseSuccessivo)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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
            onClick={navigaVersoMeseCorrente}
            className="ml-1 inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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

          <Link
            href={`/attivita/riepilogo?mese=${tokenVisualizzato}`}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            Riepilogo mese
          </Link>
        </div>

        <div className="flex-1" />

        {/* Riepilogo mese */}
        {totaleRighe > 0 && (
          <div className="inline-flex items-center gap-[9px] rounded-full border border-rose-200 bg-rose-50 px-[13px] py-1.5 text-[12.5px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[15px] w-[15px]"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <b className="tabular-nums">{totaleRighe} righe</b>
            <span className="block h-[13px] w-px bg-rose-200 dark:bg-rose-800" />
            <b className="tabular-nums">{totaleOre.toFixed(1)} h</b>
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
            onClick={ritentaMese}
            className="inline-flex cursor-pointer items-center rounded-[9px] border border-amber-400 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 dark:border-amber-600 dark:bg-zinc-800 dark:text-amber-200 dark:hover:bg-zinc-750"
          >
            Riprova
          </button>
        </div>
      )}

      {/* ── Griglia calendario ── */}
      <section
        className="relative overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Calendario mensile delle attività"
        aria-busy={inCaricamento}
        data-idratata={idratata ? "true" : "false"}
      >
        {/* Indicatore di caricamento del nuovo mese (la griglia resta visibile sotto) */}
        {inCaricamento && (
          <div
            data-testid="indicatore-caricamento-mese"
            role="status"
            className="absolute inset-0 z-10 flex animate-[comparsa-caricamento_200ms_ease-out_120ms_forwards] items-center justify-center bg-white/60 opacity-0 dark:bg-zinc-900/60"
          >
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-rose-200 border-t-rose-600 dark:border-rose-900 dark:border-t-rose-400" />
            <span className="sr-only">Caricamento del mese in corso…</span>
          </div>
        )}

        {/* Intestazione giorni settimana */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
          {giorniSettimana.map((nome, i) => (
            <div
              key={nome}
              className={`px-3 py-[11px] text-left text-[11px] font-bold uppercase tracking-[0.07em] ${
                i >= 5
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {nome}
            </div>
          ))}
        </div>

        {/* Corpo griglia */}
        <div className="grid grid-cols-7 auto-rows-[minmax(116px,auto)]">
          {griglia.map((cella, idx) => {
            const cellaData = dataCalendario(cella.data);
            const key = formattaDataISO(cellaData);
            const tokenCella = key.slice(0, 7);
            const haAttivita = key in sintesi;
            const isToday = stessoGiorno(cellaData, oggiDate);
            const isLastRow = idx >= griglia.length - 7;

            const classiGiorno = [
              "relative flex flex-col items-start gap-[7px] p-[9px_10px_10px] min-w-0 w-full transition-colors cursor-pointer",
              (idx + 1) % 7 !== 0 ? "border-r border-zinc-100 dark:border-zinc-800" : "",
              !isLastRow ? "border-b border-zinc-100 dark:border-zinc-800" : "",
              cella.fuoriMese
                ? "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                : "",
              !cella.fuoriMese && cella.isWeekend && !haAttivita
                ? "bg-zinc-50/45 dark:bg-zinc-800/30"
                : "",
              haAttivita
                ? "bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/70 dark:hover:bg-rose-950/60"
                : (!cella.fuoriMese ? "hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60" : ""),
              isToday
                ? "shadow-[inset_0_0_0_2px] shadow-rose-600 dark:shadow-rose-400"
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            const contenuto = (
              <>
                {haAttivita && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-rose-600 dark:bg-rose-400" />
                )}
                <span
                  className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums ${
                    cella.fuoriMese
                      ? "text-zinc-400/65 dark:text-zinc-500/65"
                      : isToday
                        ? "bg-rose-600 text-white dark:bg-rose-400 dark:text-white"
                        : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {cellaData.getDate()}
                </span>
                {haAttivita && (
                  <div className="mt-auto flex flex-col gap-[5px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-[7px] py-[3px] text-[11px] font-bold tabular-nums text-rose-800 dark:border-rose-800 dark:bg-zinc-800 dark:text-rose-300">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.4}
                          className="h-[11px] w-[11px]"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        {sintesi[key].righe}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-rose-600 px-[7px] py-[3px] text-[11px] font-bold tabular-nums text-white dark:bg-rose-400 dark:text-zinc-900">
                        {sintesi[key].oreTotali.toFixed(1)} h
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {sintesi[key].clienti.slice(0, 2).map((cliente) => (
                        <span
                          key={cliente.clienteId}
                          data-testid="etichetta-cliente"
                          className="max-w-full truncate rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-bold tracking-[0.02em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {cliente.ragioneSociale}{" "}
                          <span className="tabular-nums">
                            {cliente.ore.toFixed(1)} h
                          </span>
                        </span>
                      ))}
                      {sintesi[key].clienti.length > 2 && (
                        <span
                          data-testid="indicatore-altri-clienti"
                          className="px-0.5 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300"
                        >
                          +{sintesi[key].clienti.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            );

            return (
              <Link
                key={key}
                href={`/attivita/${key}?mese=${tokenCella}`}
                // Su rotta dinamica il prefetch del giorno non trasporta i dati
                // della giornata e competerebbe con il prefetch dei mesi.
                prefetch={false}
                className={classiGiorno}
                style={{ textDecoration: "none" }}
                data-testid="cella-giorno"
                data-con-attivita={haAttivita ? "true" : "false"}
                data-fuori-mese={cella.fuoriMese ? "true" : "false"}
              >
                {contenuto}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Legenda ── */}
      <div className="mt-4 flex flex-wrap items-center gap-[14px]">
        <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="h-[11px] w-[11px] rounded-[4px] border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40" />
          Giorno con attività registrate
        </span>
        <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="h-[11px] w-[11px] rounded-[4px] bg-rose-600 dark:bg-rose-400" />
          Oggi
        </span>
        <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="h-[11px] w-[11px] rounded-[4px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800" />
          Nessuna attività
        </span>
        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          Clicca un giorno qualsiasi per inserire o modificare le righe
        </span>
      </div>
    </div>
  );
}
