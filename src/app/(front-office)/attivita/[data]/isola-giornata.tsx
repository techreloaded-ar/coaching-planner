"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { giornoSpostatoDi, parseDataGiorno } from "@/domain/calendario";
import type {
  ContestoInserimentoGiornata,
  DatiGiornataAttivita,
} from "@/lib/attivita-contract";
import { useIdratata } from "@/components";
import {
  ErroreSessioneAttivita,
  useCacheCalendario,
  useCacheContestoInserimento,
  useCacheGiornate,
} from "../attivita-cache-provider";
import DettaglioGiornata from "./dettaglio-giornata";

// ── Helpers ─────────────────────────────────────────────────────

/** Pathname condivisibile di una giornata: il contratto URL non cambia. */
function pathnameDelGiorno(data: string): string {
  return `/attivita/${data}`;
}

/** Riconosce un pathname di giornata e ne estrae la data, oppure `null`. */
function giornoNelPathname(pathname: string): string | null {
  const trovato = /^\/attivita\/(\d{4}-\d{2}-\d{2})$/.exec(pathname);
  if (!trovato) return null;
  return parseDataGiorno(trovato[1]) ? trovato[1] : null;
}

/** Etichetta estesa della giornata, usata nel messaggio di errore. */
function dataEstesa(data: string): string {
  const [anno, mese, giorno] = data.split("-").map(Number);
  return new Date(anno, mese - 1, giorno).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════
// Intento di navigazione
// ═══════════════════════════════════════════════════════════════

/**
 * Destinazione richiesta dall'utente.
 *
 * Serve a distinguere l'ultima intenzione dalle risposte tardive: una lettura
 * lenta di un giorno abbandonato non deve sovrascrivere il giorno che l'utente
 * sta guardando adesso.
 */
interface IntentoGiornata {
  data: string;
  /** Se registrare una nuova entry nella history (falso per Back/Forward). */
  registraHistory: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

interface IsolaGiornataProps {
  /** DTO della giornata prodotto dal rendering server: semina la cache client. */
  datiGiornataIniziale: DatiGiornataAttivita;
  /** DTO del contesto di inserimento, invariante rispetto al giorno. */
  contestoIniziale: ContestoInserimentoGiornata;
  /** Token mese (YYYY-MM) con cui la pagina è stata aperta, se presente. */
  meseToken?: string;
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

/**
 * Isola client del dettaglio giornata.
 *
 * Possiede la giornata mostrata, il contesto di inserimento, l'attesa, l'errore
 * e la cronologia: il cambio giorno è un commit dalla cache della scheda, non
 * una navigazione RSC. L'URL viene scritto dentro `commit`, cioè solo a dati
 * pronti, e il contratto `/attivita/YYYY-MM-DD` con l'eventuale `?mese=` resta
 * quello di prima.
 */
export default function IsolaGiornata({
  datiGiornataIniziale,
  contestoIniziale,
  meseToken,
}: IsolaGiornataProps) {
  const router = useRouter();
  const pathname = usePathname();
  const cacheGiornate = useCacheGiornate();
  const cacheContesto = useCacheContestoInserimento();
  const cacheCalendario = useCacheCalendario();
  const idratata = useIdratata();

  // La giornata mostrata è decisa dal client: il rendering server fornisce il
  // primo valore, poi il cambio giorno avviene sulla cache delle giornate.
  const [giornataVisualizzata, setGiornataVisualizzata] =
    useState(datiGiornataIniziale);
  const [contesto, setContesto] = useState(contestoIniziale);
  const [inCaricamento, setInCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  /** Ultimo payload di giornata ricevuto dal server, per riconoscerne uno nuovo. */
  const [payloadGiornataServer, setPayloadGiornataServer] =
    useState(datiGiornataIniziale);
  /** Ultimo payload di contesto ricevuto dal server. */
  const [payloadContestoServer, setPayloadContestoServer] =
    useState(contestoIniziale);

  // ── Selettore di salto diretto a un giorno ───────────────────
  const [valoreSelettoreGiorno, setValoreSelettoreGiorno] = useState(
    datiGiornataIniziale.data
  );
  /** Ultimo giorno mostrato già riflesso nel selettore. */
  const [giornoSelettoreSincronizzato, setGiornoSelettoreSincronizzato] =
    useState(datiGiornataIniziale.data);

  const intentoCorrente = useRef<IntentoGiornata>({
    data: datiGiornataIniziale.data,
    registraHistory: false,
  });

  /**
   * Falso dopo lo smontaggio dell'isola.
   *
   * `commit` scrive nella cronologia della scheda, che è globale e sopravvive
   * al componente: senza questa guardia una lettura ancora in volo quando
   * l'utente lascia la pagina riscriverebbe l'URL di una rotta che non le
   * appartiene più.
   */
  const montata = useRef(true);

  /**
   * Vero mentre una lettura richiesta dall'utente è in volo.
   *
   * Durante l'attesa l'URL descrive ancora il giorno di partenza mentre
   * l'intento è già quello di arrivo: il disallineamento è previsto e verrà
   * risolto dal commit, quindi il riallineamento sull'URL non deve intervenire.
   */
  const navigazioneInVolo = useRef(false);

  const giornoVisualizzato = giornataVisualizzata.data;

  /**
   * URL condivisibile del giorno.
   *
   * Il token mese segue sempre il giorno di **destinazione**, non quello di
   * provenienza: altrimenti, attraversando un confine di mese, il breadcrumb
   * continuerebbe a puntare al mese sbagliato (e l'errore si autoperpetuerebbe
   * ad ogni cambio giorno successivo).
   */
  const urlDelGiorno = useCallback(
    (data: string) =>
      meseToken
        ? `${pathnameDelGiorno(data)}?mese=${data.slice(0, 7)}`
        : pathnameDelGiorno(data),
    [meseToken]
  );

  const commit = useCallback(
    (intento: IntentoGiornata, dati: DatiGiornataAttivita) => {
      // Isola smontata: l'utente ha lasciato la pagina mentre la lettura era in
      // volo. Né la vista né — soprattutto — la cronologia della scheda sono
      // più di questa isola: `pushState` qui produrrebbe un URL che mente sul
      // contenuto mostrato e una voce di cronologia fantasma.
      if (!montata.current) return;

      navigazioneInVolo.current = false;
      setGiornataVisualizzata(dati);
      setInCaricamento(false);
      setErrore(null);

      // L'URL viene registrato solo ora, quando la giornata è davvero pronta.
      if (intento.registraHistory) {
        window.history.pushState(null, "", urlDelGiorno(intento.data));
      }
    },
    [urlDelGiorno]
  );

  const vaiA = useCallback(
    (intento: IntentoGiornata) => {
      intentoCorrente.current = intento;
      const destinazione = intento.data;

      // Senza isola client (provider assente) resta la navigazione RSC.
      if (!cacheGiornate) {
        router.push(urlDelGiorno(destinazione));
        return;
      }

      const lettura = cacheGiornate.read(destinazione);

      if (lettura) {
        // Hit: commit sincrono, nessuna richiesta e nessun indicatore.
        commit(intento, lettura.dati);

        if (lettura.stato === "scaduto") {
          // Una sola rivalidazione in background: la vista resta quella.
          void cacheGiornate.load(destinazione).catch(() => undefined);
        }
        return;
      }

      // Miss: il contenuto precedente resta visibile sotto l'indicatore.
      navigazioneInVolo.current = true;
      setErrore(null);
      setInCaricamento(true);

      cacheGiornate
        .load(destinazione)
        .then((dati) => {
          // Risposta tardiva dopo che l'utente ha lasciato l'isola: non deve
          // toccare nulla, nemmeno la cronologia della scheda.
          if (!montata.current) return;
          // Risposta tardiva per un giorno abbandonato: non tocca la vista.
          if (intentoCorrente.current.data !== destinazione) return;
          commit(intento, dati);
        })
        .catch((causa: unknown) => {
          // La sessione decaduta è gestita dalla sottoscrizione di sessione con
          // una navigazione completa: qui non si mostra un errore recuperabile.
          if (causa instanceof ErroreSessioneAttivita) return;
          if (!montata.current) return;
          if (intentoCorrente.current.data !== destinazione) return;

          navigazioneInVolo.current = false;
          setInCaricamento(false);
          setErrore(
            `Non è stato possibile caricare la giornata del ${dataEstesa(
              destinazione
            )}.`
          );
        });
    },
    [cacheGiornate, commit, router, urlDelGiorno]
  );

  // ── Sincronizzazione con il rendering server ─────────────────
  // Il payload del server vale al mount e ogni volta che il server ne produce
  // uno nuovo (reload, URL diretto, risposta di una Server Action, `refresh`),
  // ma **solo se coerente con l'URL corrente**: una `revalidatePath` di server
  // action rigenera l'albero RSC del giorno da cui l'utente è partito, e
  // adottarlo senza condizioni riporterebbe la vista su quel giorno mentre
  // l'utente ne sta guardando un altro. Quando non è coerente, il payload viene
  // comunque seminato in cache dall'effetto più sotto, senza spostare la vista.
  // L'allineamento avviene durante il render — il pattern React per adeguare lo
  // stato a una prop cambiata — e non in un effetto, che provocherebbe un
  // render a cascata.
  //
  // Nota sul confine con il router: dopo un cambio giorno scritto con la
  // History API, l'URL punta al nuovo giorno mentre l'albero RSC del router
  // descrive ancora quello di partenza. La prima Server Action successiva
  // riconcilia i due, e la riconciliazione cambia la «state key» del segmento
  // dinamico `[data]`, quindi rimonta questa isola con il payload del giorno in
  // URL. È innocuo — la vista resta sul giorno giusto e le cache vivono nel
  // provider del layout, che non viene smontato — ma è la ragione per cui le
  // letture del form non passano più da una Server Action.
  if (payloadGiornataServer !== datiGiornataIniziale) {
    setPayloadGiornataServer(datiGiornataIniziale);
    if (pathname === pathnameDelGiorno(datiGiornataIniziale.data)) {
      setGiornataVisualizzata(datiGiornataIniziale);
      setInCaricamento(false);
      setErrore(null);
    }
  }

  // Il contesto di inserimento è invariante rispetto al giorno: un payload
  // nuovo del server è sempre il più recente e non sposta la vista.
  if (payloadContestoServer !== contestoIniziale) {
    setPayloadContestoServer(contestoIniziale);
    setContesto(contestoIniziale);
  }

  // Il selettore mostra sempre il giorno effettivamente in vista, qualunque sia
  // la causa del cambio: frecce, salto diretto, Back/Forward o nuovo payload
  // del server. Anche qui l'allineamento avviene durante il render.
  if (giornoSelettoreSincronizzato !== giornoVisualizzato) {
    setGiornoSelettoreSincronizzato(giornoVisualizzato);
    setValoreSelettoreGiorno(giornoVisualizzato);
  }

  // ── Semina delle cache ───────────────────────────────────────
  // Le cache sono sistemi esterni a React: si seminano in un effetto.
  useEffect(() => {
    cacheGiornate?.seed(datiGiornataIniziale);

    // L'intento segue il payload server solo quando la vista lo ha adottato,
    // cioè quando l'URL corrente è quello di quel giorno.
    if (
      window.location.pathname === pathnameDelGiorno(datiGiornataIniziale.data)
    ) {
      intentoCorrente.current = {
        data: datiGiornataIniziale.data,
        registraHistory: false,
      };
    }
  }, [cacheGiornate, datiGiornataIniziale]);

  useEffect(() => {
    cacheContesto?.seed(contestoIniziale);
  }, [cacheContesto, contestoIniziale]);

  // ── Ciclo di vita dell'isola ─────────────────────────────────
  // Le letture in volo sopravvivono al componente: da qui in poi sanno di non
  // avere più titolo per scrivere né la vista né la cronologia.
  useEffect(() => {
    montata.current = true;
    return () => {
      montata.current = false;
    };
  }, []);

  // ── L'URL è l'unica sorgente di verità sul giorno mostrato ───
  // Il `pushState` di Next copia nell'entry appena creata l'albero RSC di
  // quella corrente: la voce di cronologia del giorno raggiunto con un cambio
  // giorno client porta quindi l'albero del giorno di partenza. Finché l'isola
  // resta montata è innocuo, perché la vista vive nel client; ma se l'utente
  // esce verso un'altra rotta e torna indietro, il router ripristina quell'albero
  // insieme all'URL del giorno giusto, e l'isola verrebbe rimontata con il
  // payload del giorno sbagliato: intestazione, selettore e righe
  // contraddirebbero l'URL, che è ciò che l'utente vede, condivide e ricarica.
  //
  // In quel caso vince l'URL. Il giorno viene riletto dalla cache di scheda
  // (tipicamente un hit, quindi senza richieste) e senza registrare una nuova
  // voce di cronologia, perché la voce esiste già ed è quella su cui siamo.
  //
  // Il pathname viene letto da `window.location`, non dal router: il router
  // aggiorna il proprio URL canonico dentro una transizione, quindi durante una
  // catena di cambi giorno rapidi può essere momentaneamente indietro, mentre
  // `window.location` è aggiornato in modo sincrono da `pushState`.
  useEffect(() => {
    if (navigazioneInVolo.current) return;

    const giornoInUrl = giornoNelPathname(window.location.pathname);
    if (!giornoInUrl || giornoInUrl === intentoCorrente.current.data) return;

    vaiA({ data: giornoInUrl, registraHistory: false });
  }, [vaiA, datiGiornataIniziale, pathname]);

  // ── Prefetch dei soli giorni adiacenti dopo il commit ────────
  // Un salto lontano dal selettore data resta un miss, per scelta di perimetro.
  useEffect(() => {
    if (!cacheGiornate) return;
    cacheGiornate.prefetch(giornoSpostatoDi(giornoVisualizzato, -1));
    cacheGiornate.prefetch(giornoSpostatoDi(giornoVisualizzato, 1));
  }, [cacheGiornate, giornoVisualizzato]);

  // ── Aggiornamenti in background della giornata mostrata ──────
  // Una rivalidazione avviata altrove — scadenza, ritorno sulla scheda,
  // invalidazione dopo una mutazione — scrive in cache: la vista la adotta
  // solo se riguarda il giorno dell'intento corrente, così una risposta di un
  // giorno abbandonato non sposta ciò che l'utente sta guardando.
  useEffect(() => {
    const giornate = cacheGiornate;
    if (!giornate) return;

    return giornate.subscribe((giornoAggiornato) => {
      if (giornoAggiornato !== intentoCorrente.current.data) return;
      const lettura = giornate.read(giornoAggiornato);
      // Una notifica di invalidazione non ha una lettura: la vista resta la
      // precedente finché la rilettura non arriva.
      if (lettura) setGiornataVisualizzata(lettura.dati);
    });
  }, [cacheGiornate]);

  // ── Aggiornamenti in background del contesto di inserimento ──
  // Il contesto ha una chiave sola: qualunque notifica lo riguarda.
  useEffect(() => {
    const cacheDelContesto = cacheContesto;
    if (!cacheDelContesto) return;

    return cacheDelContesto.subscribe(() => {
      const lettura = cacheDelContesto.read();
      if (lettura) setContesto(lettura.dati);
    });
  }, [cacheContesto]);

  // ── Sessione non più valida: navigazione completa ────────────
  // Il canale è unico per scheda: la stessa notifica vale per le tre cache,
  // già svuotate quando arriva qui.
  useEffect(() => {
    const giornate = cacheGiornate;
    if (!giornate) return;

    return giornate.subscribeSessioneScaduta(() => {
      // Il server decide dove mandare l'utente: qui serve solo uscire
      // dall'isola client con una navigazione completa.
      window.location.reload();
    });
  }, [cacheGiornate]);

  // ── Limite reale della staleness: scadenza, focus e visibilità ─
  // Vale sia per la giornata mostrata sia per il contesto di inserimento, che
  // non viene più richiesto ad ogni cambio giorno: senza queste due mitigazioni
  // clienti e voci di rimborso resterebbero quelli del primo rendering per
  // tutta la vita della scheda.
  useEffect(() => {
    const giornate = cacheGiornate;
    const cacheDelContesto = cacheContesto;
    if (!giornate || !cacheDelContesto) return;

    const adesso = Date.now();
    const letturaGiornata = giornate.read(giornoVisualizzato);
    const letturaContesto = cacheDelContesto.read();

    const timerGiornata = window.setTimeout(
      () => giornate.prefetch(giornoVisualizzato),
      letturaGiornata ? Math.max(0, letturaGiornata.expiresAt - adesso) : 0
    );
    const timerContesto = window.setTimeout(
      () => cacheDelContesto.prefetch(),
      letturaContesto ? Math.max(0, letturaContesto.expiresAt - adesso) : 0
    );

    // Al ritorno sulla scheda la rivalidazione è **forzata**, anche su voci
    // ancora fresche: `prefetch` uscirebbe subito su una voce fresca e il
    // ritorno sulla scheda non delimiterebbe alcuna staleness. È anche il
    // momento in cui la risposta rivela un cambio di sessione avvenuto altrove.
    function rivalidaAlRitorno() {
      if (document.visibilityState !== "visible") return;
      void giornate!.revalida(giornoVisualizzato).catch(() => undefined);
      void cacheDelContesto!.revalida().catch(() => undefined);
    }

    window.addEventListener("focus", rivalidaAlRitorno);
    document.addEventListener("visibilitychange", rivalidaAlRitorno);

    return () => {
      window.clearTimeout(timerGiornata);
      window.clearTimeout(timerContesto);
      window.removeEventListener("focus", rivalidaAlRitorno);
      document.removeEventListener("visibilitychange", rivalidaAlRitorno);
    };
    // `giornataVisualizzata` e `contesto` riarmano i timer dopo ogni
    // aggiornamento dei rispettivi dati.
  }, [
    cacheGiornate,
    cacheContesto,
    giornoVisualizzato,
    giornataVisualizzata,
    contesto,
  ]);

  // ── Back / Forward ───────────────────────────────────────────
  useEffect(() => {
    function gestisciPopstate() {
      const giorno = giornoNelPathname(window.location.pathname);
      // Voci di cronologia di altre rotte: le gestisce il router di Next.
      if (!giorno) return;

      // Back/Forward ripercorre la history: non crea una nuova entry.
      vaiA({ data: giorno, registraHistory: false });
    }

    window.addEventListener("popstate", gestisciPopstate);
    return () => window.removeEventListener("popstate", gestisciPopstate);
  }, [vaiA]);

  // ── Gestori dei controlli giorno ─────────────────────────────

  const navigaVersoGiorno = useCallback(
    (nuovaData: string) => {
      if (!parseDataGiorno(nuovaData)) return;
      if (nuovaData === intentoCorrente.current.data) return;
      vaiA({ data: nuovaData, registraHistory: true });
    },
    [vaiA]
  );

  function navigaDiGiorni(delta: number) {
    // La catena dei click rapidi riparte dall'ultima intenzione, non dal giorno
    // ancora mostrato.
    navigaVersoGiorno(giornoSpostatoDi(intentoCorrente.current.data, delta));
  }

  function ritentaGiornata() {
    vaiA(intentoCorrente.current);
  }

  // ── Invalidazione dopo una mutazione ─────────────────────────

  /**
   * `revalidatePath` nelle server action protegge il rendering SSR/RSC;
   * l'invalidazione del mese nella cache client protegge l'isola del
   * calendario, che altrimenti riuserebbe una sintesi antecedente alla
   * modifica. L'invalidazione della giornata mutata rende invece impossibile
   * che la cache della scheda continui a servire le righe precedenti alla
   * mutazione: la rilettura forzata raggiunge la vista attraverso la
   * sottoscrizione agli aggiornamenti in background, senza navigazione RSC.
   *
   * Riceve il giorno **visualizzato**, non quello dell'ultimo payload prodotto
   * dal server: dopo un cambio giorno client i due possono differire, e il
   * mese da invalidare è quello del giorno davvero mutato.
   *
   * Nessun `router.refresh()` in questo percorso, deliberatamente. È
   * ridondante, perché le server action continuano a fare `revalidatePath` e
   * la risposta della server action invalida già la Router Cache client per
   * quei percorsi, quindi un rientro successivo sulla giornata rilegge dal
   * server. Ed è dannoso, perché rigenererebbe l'albero RSC del giorno da cui
   * l'utente è partito, riportando la vista sul giorno sbagliato.
   */
  const invalidaDopoMutazione = useCallback(
    async (giorno: string) => {
      cacheCalendario?.invalidate(giorno.slice(0, 7));

      if (!cacheGiornate) {
        // Senza isola client (provider assente) non c'è cache da rileggere:
        // resta il rientro dal server, come per la navigazione.
        router.refresh();
        return;
      }

      cacheGiornate.invalidate(giorno);

      try {
        // L'attesa copre la rilettura: la vista viene aggiornata dalla
        // sottoscrizione, che scatta quando la risposta entra in cache.
        await cacheGiornate.revalida(giorno);
      } catch {
        // La rilettura fallita non è recuperabile qui: la giornata mutata resta
        // invalidata, quindi il prossimo ingresso la rilegge dal server.
      }
    },
    [cacheCalendario, cacheGiornate, router]
  );

  // ── Breadcrumb ───────────────────────────────────────────────
  // Il ritorno al calendario segue il giorno mostrato, non quello di apertura.
  const ritornoHref = meseToken
    ? `/attivita?mese=${giornoVisualizzato.slice(0, 7)}`
    : "/attivita";

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link
          href={ritornoHref}
          className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-[15px] w-[15px]"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Torna al calendario
        </Link>
      </div>

      <div className="mx-auto w-full max-w-[1080px] px-8 py-7">
        {/* ── Controllo cambio giorno ── */}
        <div
          data-testid="controllo-cambio-giorno"
          className="mb-4 flex flex-wrap items-center gap-2.5"
        >
          <button
            type="button"
            onClick={() => navigaDiGiorni(-1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Giorno precedente"
            title="Giorno precedente"
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

          <label htmlFor="selettore-giorno" className="sr-only">
            Vai al giorno
          </label>
          <input
            id="selettore-giorno"
            type="date"
            data-testid="selettore-giorno"
            value={valoreSelettoreGiorno}
            onChange={(evento) => {
              const scelto = evento.target.value;

              // Digitazione parziale o campo svuotato: non c'è alcun giorno
              // verso cui navigare, quindi il selettore torna subito a
              // descrivere il giorno mostrato invece di restare a metà. Lo
              // stato non cambia, ed è React stesso a ripristinare il valore
              // del campo controllato dopo l'evento.
              if (!parseDataGiorno(scelto)) {
                setValoreSelettoreGiorno(giornoVisualizzato);
                return;
              }

              setValoreSelettoreGiorno(scelto);
              navigaVersoGiorno(scelto);
            }}
            className="rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-[13.5px] text-zinc-800 shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />

          <button
            type="button"
            onClick={() => navigaDiGiorni(1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Giorno successivo"
            title="Giorno successivo"
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
        </div>

        {/* ── Errore di caricamento della giornata ── */}
        {errore && (
          <div
            role="alert"
            data-testid="errore-caricamento-giornata"
            className="mb-[14px] flex flex-wrap items-center gap-3 rounded-[11px] border border-amber-300 bg-amber-50 px-[13px] py-2.5 text-[13px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <span>{errore}</span>
            <button
              type="button"
              onClick={ritentaGiornata}
              className="inline-flex cursor-pointer items-center rounded-[9px] border border-amber-400 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 dark:border-amber-600 dark:bg-zinc-800 dark:text-amber-200 dark:hover:bg-zinc-750"
            >
              Riprova
            </button>
          </div>
        )}

        {/* ── Contenuto della giornata ── */}
        <div
          data-testid="contenuto-giornata"
          className="relative"
          aria-busy={inCaricamento}
          data-idratata={idratata ? "true" : "false"}
        >
          {/* Indicatore del nuovo giorno: il contenuto precedente resta sotto */}
          {inCaricamento && (
            <div
              data-testid="indicatore-caricamento-giornata"
              role="status"
              className="absolute inset-0 z-10 flex animate-[comparsa-caricamento_200ms_ease-out_120ms_forwards] items-start justify-center bg-white/60 pt-16 opacity-0 dark:bg-zinc-900/60"
            >
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-rose-200 border-t-rose-600 dark:border-rose-900 dark:border-t-rose-400" />
              <span className="sr-only">Caricamento della giornata in corso…</span>
            </div>
          )}

          {/*
            Il remount al cambio giorno resta il meccanismo che azzera lo stato
            del form: `key` sul giorno mostrato, come faceva `page.tsx`.
          */}
          <DettaglioGiornata
            key={giornoVisualizzato}
            data={giornoVisualizzato}
            righe={giornataVisualizzata.righe}
            clienti={contesto.clienti}
            vociRimborso={contesto.vociRimborso}
            onMutazioneCompletata={invalidaDopoMutazione}
          />
        </div>
      </div>
    </>
  );
}
