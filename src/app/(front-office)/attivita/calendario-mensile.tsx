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
import { IconaOffertaNonAbilitata, SelettoreMese, useIdratata } from "@/components";
import { ORE_PER_GIORNATA, sommaOre } from "@/domain/types";
import { formattaGiornate, formattaNumeroOre, formattaOre } from "@/lib/formattazione";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import {
  ErroreIdentitaSchedaCambiata,
  ErroreSessioneAttivita,
  useCacheCalendario,
  useCollaboratoreConsultato,
} from "./attivita-cache-provider";
import InterruttoreVista from "./interruttore-vista";
import { FILTRI_VUOTI, urlElenco } from "./filtri-elenco";

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
  /** Stato di Google Calendar in fondo alla barra del mese; assente sul foglio di un altro collaboratore. */
  indicatoreCalendario?: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

export default function CalendarioMensile({
  datiMeseIniziale,
  oggi,
  indicatoreCalendario,
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

  // La griglia è derivata localmente dalle funzioni pure del dominio: non
  // viaggia nel payload né RSC né JSON. L'etichetta del mese è calcolata dal
  // selettore, che ne è anche il trigger.
  const griglia = useMemo<CellaGiorno[]>(
    () => costruisciGrigliaMese(tokenVisualizzato),
    [tokenVisualizzato]
  );

  // Sul foglio consultato da un amministratore ogni URL conserva il
  // collaboratore: la navigazione tra i mesi non riporta al proprio foglio.
  const collaboratoreConsultatoId = useCollaboratoreConsultato();
  const urlDellIntento = useCallback(
    (intento: IntentoNavigazione) =>
      urlDelFoglio(
        intento.url ?? urlDelMese(intento.token),
        collaboratoreConsultatoId
      ),
    [collaboratoreConsultatoId]
  );

  const commit = useCallback(
    (intento: IntentoNavigazione, dati: DatiCalendarioMese) => {
      setMeseVisualizzato(dati);
      setInCaricamento(false);
      setErrore(null);

      // L'URL viene registrato solo ora, quando il mese è davvero pronto.
      if (intento.registraHistory) {
        window.history.pushState(null, "", urlDellIntento(intento));
      }
    },
    [urlDellIntento]
  );

  const vaiA = useCallback(
    (intento: IntentoNavigazione) => {
      intentoCorrente.current = intento;
      const destinazione = intento.token;

      // Senza isola client (provider assente) resta la navigazione RSC.
      if (!cache) {
        router.push(urlDellIntento(intento));
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
          if (causa instanceof ErroreSessioneAttivita) return;
          // La guardia d'identità ha già svuotato tutte le cache della scheda
          // e sta per far ricaricare la pagina tramite il canale di sessione:
          // qui non c'è nulla di recuperabile da mostrare.
          if (causa instanceof ErroreIdentitaSchedaCambiata) return;
          if (intentoCorrente.current.token !== destinazione) return;

          setInCaricamento(false);
          setErrore(
            `Non è stato possibile caricare ${etichettaMese(destinazione)}.`
          );
        });
    },
    [cache, commit, router, urlDellIntento]
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
    return sommaOre(...Object.values(sintesi).map((s) => s.oreTotali));
  }, [sintesi]);

  // Giorni della settimana
  const giorniSettimana = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7 max-sm:px-4 max-sm:py-5">
      {/* ── Barra navigazione mese ── */}
      {/* Su smartphone la barra è compatta, su due righe: frecce e mese, poi
          «Mese corrente» e vista a sola icona (il testo resta come nome
          accessibile) con il riepilogo righe a destra. Il riepilogo del mese
          si apre dalla sidebar. */}
      <div className="mb-[18px] flex flex-wrap items-center gap-3 max-sm:gap-2.5">
        <div className="flex items-center gap-2 max-sm:contents">
          <button
            type="button"
            onClick={() => navigaVersoMese(mesePrecedente)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] max-sm:h-11 max-sm:w-11 border border-zinc-200 bg-white text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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

          {/* L'etichetta del mese è anche l'unico ingresso al salto diretto:
              la scelta entra nello stesso intento di navigazione delle frecce,
              quindi cache, attesa e URL restano quelli esistenti. */}
          <div className="max-sm:basis-[calc(100%-6.75rem)]">
            <SelettoreMese
              tokenVisualizzato={tokenVisualizzato}
              onScegliMese={(token) => vaiA({ token, registraHistory: true })}
            />
          </div>

          <button
            type="button"
            onClick={() => navigaVersoMese(meseSuccessivo)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] max-sm:h-11 max-sm:w-11 border border-zinc-200 bg-white text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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
            title="Mese corrente"
            className="inline-flex cursor-pointer items-center gap-[7px] max-sm:h-11 max-sm:w-11 max-sm:justify-center max-sm:p-0 rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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
            <span className="max-sm:sr-only">Mese corrente</span>
          </button>

        </div>

        <div className="flex-1 max-sm:hidden" />

        <InterruttoreVista
          vista="calendario"
          hrefCalendario={urlDelFoglio(urlDelMese(tokenVisualizzato), collaboratoreConsultatoId)}
          hrefElenco={urlDelFoglio(urlElenco(tokenVisualizzato, FILTRI_VUOTI), collaboratoreConsultatoId)}
        />

        {/* Riepilogo mese e stato di Google Calendar, a destra anche su smartphone */}
        <div className="flex items-center gap-3 max-sm:ml-auto max-sm:gap-2.5">
          {/* Riepilogo mese: neutro, il rosa resta l'accento di oggi */}
          {totaleRighe > 0 && (
            <div className="inline-flex items-center gap-[9px] whitespace-nowrap max-sm:gap-1.5 max-sm:px-2.5 max-sm:text-[13px] rounded-full border border-zinc-200 bg-white px-[13px] py-1.5 text-sm font-semibold text-testo-principale dark:border-zinc-700 dark:bg-zinc-800">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-[15px] w-[15px] text-testo-metadati max-sm:hidden"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span className="tabular-nums">{totaleRighe} righe</span>
              <span className="block h-[13px] w-px bg-zinc-200 dark:bg-zinc-700" />
              <span className="tabular-nums">{formattaGiornate(totaleOre / ORE_PER_GIORNATA)}</span>
            </div>
          )}
          {indicatoreCalendario}
        </div>
      </div>

      {/* ── Errore di caricamento del mese ── */}
      {errore && (
        <div
          role="alert"
          data-testid="errore-caricamento-mese"
          className="mb-[14px] flex flex-wrap items-center gap-3 rounded-[11px] border border-amber-300 bg-amber-50 px-[13px] py-2.5 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <span>{errore}</span>
          <button
            type="button"
            onClick={ritentaMese}
            className="inline-flex cursor-pointer items-center rounded-[9px] border border-amber-400 bg-white px-2.5 py-1 text-sm font-medium text-amber-900 shadow-sm transition hover:bg-amber-100 dark:border-amber-600 dark:bg-zinc-800 dark:text-amber-200 dark:hover:bg-zinc-750"
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

        {/* Intestazione giorni settimana: il weekend è più tenue, non rosa */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
          {giorniSettimana.map((nome, i) => (
            <div
              key={nome}
              className={`px-3 py-2.5 text-left text-sm max-sm:px-0 max-sm:text-center max-sm:text-xs ${
                i >= 5 ? "font-normal text-testo-metadati" : "font-medium text-testo-secondario"
              }`}
            >
              {nome}
            </div>
          ))}
        </div>

        {/* Corpo griglia */}
        <div className="grid grid-cols-7 auto-rows-[minmax(124px,auto)] max-sm:auto-rows-[minmax(64px,auto)]">
          {griglia.map((cella, idx) => {
            const cellaData = dataCalendario(cella.data);
            const key = formattaDataISO(cellaData);
            const tokenCella = key.slice(0, 7);
            const haAttivita = key in sintesi;
            // Righe su offerte a cui il collaboratore non è abilitato: giorno giallo.
            const righeNonAbilitate = haAttivita ? sintesi[key].righeOfferteNonAbilitate : 0;
            const isToday = stessoGiorno(cellaData, oggiDate);
            const isLastRow = idx >= griglia.length - 7;

            // Superfici: neutra appena distinta per i giorni con attività,
            // trama diagonale tenue per il weekend vuoto; il rosa resta a oggi.
            const classiGiorno = [
              "relative flex flex-col items-start gap-1.5 p-[9px_10px_10px_12px] min-w-0 w-full overflow-hidden transition-colors cursor-pointer focus-visible:z-[1] focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-indigo-500 dark:focus-visible:outline-indigo-400 max-sm:items-center max-sm:gap-1 max-sm:p-1",
              (idx + 1) % 7 !== 0 ? "border-r border-zinc-100 dark:border-zinc-800" : "",
              !isLastRow ? "border-b border-zinc-100 dark:border-zinc-800" : "",
              righeNonAbilitate > 0
                ? "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
                : haAttivita
                  ? "bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                  : cella.fuoriMese
                    ? "bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:hover:bg-zinc-800/70"
                    : cella.isWeekend
                      ? "bg-[repeating-linear-gradient(135deg,rgb(113_113_122/0.07)_0_6px,transparent_6px_12px)] hover:bg-zinc-100 dark:bg-[repeating-linear-gradient(135deg,rgb(161_161_170/0.07)_0_6px,transparent_6px_12px)] dark:hover:bg-zinc-800"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            ]
              .filter(Boolean)
              .join(" ");

            const sintesiGiorno = haAttivita ? sintesi[key] : null;

            const contenuto = (
              <>
                {sintesiGiorno && (
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                      righeNonAbilitate > 0 ? "bg-amber-500 dark:bg-amber-400" : "bg-zinc-400 dark:bg-zinc-500"
                    }`}
                  />
                )}
                {/* In cima: numero del giorno (con «Oggi») e, a destra, il conteggio righe. */}
                <div className="flex w-full items-center gap-1.5 max-sm:flex-col max-sm:gap-0.5">
                  <span
                    data-testid="numero-giorno"
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums max-sm:h-[26px] max-sm:w-[26px] max-sm:text-[13px] ${
                      isToday
                        ? "bg-rose-600 font-semibold text-white dark:bg-rose-400 dark:text-zinc-900"
                        : cella.fuoriMese
                          ? "font-normal text-testo-metadati"
                          : cella.isWeekend
                            ? "font-medium text-testo-metadati"
                            : "font-medium text-testo-secondario"
                    }`}
                  >
                    {cellaData.getDate()}
                  </span>
                  {isToday && (
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 max-sm:sr-only">
                      Oggi
                    </span>
                  )}
                  {sintesiGiorno && (
                    <span className="ml-auto inline-flex items-center gap-1.5 max-sm:hidden">
                      {righeNonAbilitate > 0 && (
                        <span
                          data-testid="indicatore-offerte-non-abilitate"
                          title={`${righeNonAbilitate} ${righeNonAbilitate === 1 ? "riga" : "righe"} su offerte non abilitate`}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-1.5 text-xs font-medium tabular-nums text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          <IconaOffertaNonAbilitata className="h-3 w-3" />
                          {righeNonAbilitate}
                        </span>
                      )}
                      <span
                        data-testid="numero-righe"
                        title={`${sintesiGiorno.righe} ${sintesiGiorno.righe === 1 ? "riga" : "righe"}`}
                        className="inline-flex items-center gap-[3px] text-xs font-medium tabular-nums text-testo-metadati"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="h-[13px] w-[13px]"
                          aria-hidden="true"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        <span>{sintesiGiorno.righe}</span>
                        <span className="sr-only">{sintesiGiorno.righe === 1 ? "riga" : "righe"}</span>
                      </span>
                    </span>
                  )}
                </div>
                {/* Al centro: i clienti della giornata, come testo secondario.
                    Su smartphone restano nella pagina della giornata. */}
                {sintesiGiorno && (
                  <div className="flex w-full min-w-0 flex-col gap-0.5 max-sm:hidden">
                    {sintesiGiorno.clienti.slice(0, 2).map((cliente) => (
                      <span
                        key={cliente.clienteId}
                        data-testid="etichetta-cliente"
                        className="flex min-w-0 items-baseline gap-1.5 text-xs leading-[1.35] text-testo-secondario"
                      >
                        <span className="min-w-0 flex-1 truncate">{cliente.ragioneSociale}</span>{" "}
                        <span className="shrink-0 tabular-nums">{formattaOre(cliente.ore)}</span>
                      </span>
                    ))}
                    {sintesiGiorno.clienti.length > 2 && (
                      <span
                        data-testid="indicatore-altri-clienti"
                        className="text-xs font-medium text-testo-metadati"
                      >
                        +{sintesiGiorno.clienti.length - 2}
                      </span>
                    )}
                  </div>
                )}
                {/* In fondo: le ore totali, il dato dominante della giornata. */}
                {sintesiGiorno && (
                  <div
                    data-testid="totali-giorno"
                    className="mt-auto whitespace-nowrap text-[22px] font-semibold leading-none tabular-nums text-testo-principale max-sm:mt-0 max-sm:text-[13px]"
                  >
                    {formattaNumeroOre(sintesiGiorno.oreTotali)}
                    <span className="text-sm font-medium text-testo-secondario max-sm:text-xs max-sm:font-normal max-sm:text-testo-metadati">
                      {" "}h
                    </span>
                  </div>
                )}
              </>
            );

            return (
              <Link
                key={key}
                href={urlDelFoglio(
                  `/attivita/${key}?mese=${tokenCella}`,
                  collaboratoreConsultatoId
                )}
                // Su rotta dinamica il prefetch del giorno non trasporta i dati
                // della giornata e competerebbe con il prefetch dei mesi.
                prefetch={false}
                className={classiGiorno}
                style={{ textDecoration: "none" }}
                aria-current={isToday ? "date" : undefined}
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

      {/* ── Legenda: descrive esattamente gli stati della griglia ── */}
      <div
        role="group"
        aria-label="Legenda del calendario"
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-testo-secondario"
      >
        <span className="inline-flex items-center gap-[7px]">
          <span className="h-3.5 w-3.5 rounded-[4px] border border-zinc-200 bg-zinc-50 shadow-[inset_3px_0_0] shadow-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:shadow-zinc-500" />
          Giorno con attività registrate
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="h-3.5 w-3.5 rounded-full bg-rose-600 dark:bg-rose-400" />
          Oggi
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="h-3.5 w-3.5 rounded-[4px] border border-amber-300 bg-amber-50 shadow-[inset_3px_0_0] shadow-amber-500 dark:border-amber-700 dark:bg-amber-950/30 dark:shadow-amber-400" />
          Righe su offerte non abilitate
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="h-3.5 w-3.5 rounded-[4px] border border-zinc-200 bg-[repeating-linear-gradient(135deg,rgb(113_113_122/0.3)_0_2px,transparent_2px_5px)] dark:border-zinc-700 dark:bg-[repeating-linear-gradient(135deg,rgb(161_161_170/0.3)_0_2px,transparent_2px_5px)]" />
          Sabato e domenica
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="h-3.5 w-3.5 rounded-[4px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
          Nessuna attività
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-3.5 w-3.5 text-testo-metadati"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          Numero di righe
        </span>
      </div>
      <p className="mt-2 text-sm text-testo-metadati">
        Clicca un giorno qualsiasi per inserire o modificare le righe
      </p>
    </div>
  );
}
