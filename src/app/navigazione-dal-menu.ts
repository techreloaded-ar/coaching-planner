"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";

/** Pagina richiesta con un clic sul menu e non ancora arrivata. */
export interface DestinazioneMenu {
  pathname: string;
  /** Parametri di ricerca della destinazione, senza il `?` iniziale. */
  ricerca: string;
}

/** Oltre questo tempo una navigazione mai arrivata non lascia lo scheletro a schermo. */
const DURATA_MASSIMA_ATTESA_MS = 15_000;

/**
 * Feedback immediato del menu laterale: al clic su una voce la voce si accende
 * e il contenuto passa allo scheletro della pagina di arrivo, senza aspettare
 * il server. Lo scheletro sparisce quando cambia l'indirizzo mostrato (la
 * pagina è arrivata), quando la pagina torna dalla cache del browser
 * (Indietro dopo una navigazione documentale) o, in ultima istanza, dopo
 * `DURATA_MASSIMA_ATTESA_MS`.
 *
 * Il rendering del server non cambia: niente confini `loading`, quindi
 * redirect e not-found delle pagine restano risposte HTTP vere.
 */
export function useNavigazioneDalMenu(pathname: string, ricerca: string) {
  const [destinazione, setDestinazione] = useState<DestinazioneMenu | null>(null);
  const posizione = `${pathname}?${ricerca}`;
  const [posizioneOsservata, setPosizioneOsservata] = useState(posizione);

  // La pagina richiesta (o quella a cui il server ha reindirizzato) è arrivata.
  if (posizione !== posizioneOsservata) {
    setPosizioneOsservata(posizione);
    setDestinazione(null);
  }

  useEffect(() => {
    if (!destinazione) return;
    const scadenza = setTimeout(() => setDestinazione(null), DURATA_MASSIMA_ATTESA_MS);
    return () => clearTimeout(scadenza);
  }, [destinazione]);

  useEffect(() => {
    function alRitornoDallaCache(evento: PageTransitionEvent) {
      if (evento.persisted) setDestinazione(null);
    }
    window.addEventListener("pageshow", alRitornoDallaCache);
    return () => window.removeEventListener("pageshow", alRitornoDallaCache);
  }, []);

  /** Da chiamare nel `onClick` della voce: ignora i clic che non navigano qui. */
  const avvia = useCallback((evento: MouseEvent<HTMLAnchorElement>) => {
    const richiesta = destinazioneDelClic(evento, window.location);
    if (richiesta) setDestinazione(richiesta);
  }, []);

  return { destinazione, avvia };
}

/**
 * Destinazione di un clic su un link del menu, oppure `null` quando il clic
 * non porta altrove in questa scheda: tasti modificatori o pulsante non
 * principale (nuova scheda o finestra), clic già gestito, stessa pagina.
 */
export function destinazioneDelClic(
  evento: Pick<
    MouseEvent<HTMLAnchorElement>,
    "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "currentTarget"
  >,
  attuale: Pick<Location, "href" | "pathname" | "search">,
): DestinazioneMenu | null {
  if (
    evento.defaultPrevented ||
    evento.button !== 0 ||
    evento.metaKey ||
    evento.ctrlKey ||
    evento.shiftKey ||
    evento.altKey
  ) {
    return null;
  }
  const href = evento.currentTarget.getAttribute("href");
  if (!href) return null;
  const url = new URL(href, attuale.href);
  if (url.pathname === attuale.pathname && url.search === attuale.search) return null;
  return { pathname: url.pathname, ricerca: url.search.replace(/^\?/, "") };
}
