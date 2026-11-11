"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogoCoachingPlanner, MenuAccount } from "@/components";
import { PARAMETRO_COLLABORATORE_CONSULTATO, urlDelFoglio } from "@/lib/url-foglio-attivita";
import {
  DURATA_COOKIE_SIDEBAR_COMPRESSA_SECONDI,
  NOME_COOKIE_SIDEBAR_COMPRESSA,
} from "@/lib/sidebar-compressa";
import { useApriImpostazioni } from "./impostazioni/modale-impostazioni";

// ── Icone SVG inline ───────────────────────────────────────────

function Icona({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-[17px] w-[17px] shrink-0">
      <path d={d} />
    </svg>
  );
}

const ICONA_ATTIVITA = "M8 3v3M16 3v3M4 10h16M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1ZM8 15l2.5 2.5L16 12";
const ICONA_RIEPILOGO = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8";
const ICONA_CLIENTI = "M3 21V8.5L9 4l6 4.5V21M15 21h6V11l-6-3M7.5 21v-4.5h3V21M7 9.5h.01M11 9.5h.01M7 13h.01M11 13h.01";
const ICONA_OFFERTE = "M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM14 3v6h6M8 13h8M8 17h5";
const ICONA_PERSONE = "M9 4.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM2.8 19.4a6.2 6.2 0 0 1 12.4 0M17.2 6.8a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM15.4 14.6a5 5 0 0 1 5.8 4.8";
const ICONA_VOCI_RIMBORSO = "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11ZM12 7.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z";
const ICONA_IMPORTAZIONE = "M12 3v12M7 10l5 5 5-5M4 21h16";
const ICONA_REPORT = "M3 3v18h18M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6";

// ── Dati di navigazione ────────────────────────────────────────

/** Voci di amministrazione: pagine server con dati sempre freschi, navigazione documentale. */
const GRUPPI_AMMINISTRAZIONE = [
  {
    titolo: "Anagrafica",
    voci: [
      { href: "/anagrafiche/clienti", etichetta: "Clienti", icona: ICONA_CLIENTI },
      { href: "/offerte", etichetta: "Offerte", icona: ICONA_OFFERTE },
      { href: "/anagrafiche/persone", etichetta: "Persone", icona: ICONA_PERSONE },
      { href: "/anagrafiche/voci-rimborso", etichetta: "Voci di rimborso", icona: ICONA_VOCI_RIMBORSO },
      { href: "/importazione", etichetta: "Importazione", icona: ICONA_IMPORTAZIONE },
    ],
  },
  {
    titolo: "Reportistica",
    voci: [
      { href: "/report/fatturazione-clienti", etichetta: "Fatturazione clienti", icona: ICONA_REPORT },
      { href: "/report/fatturazione-collaboratori", etichetta: "Fatturazione collaboratori", icona: ICONA_REPORT },
      { href: "/report/marginalita", etichetta: "Marginalità", icona: ICONA_REPORT },
    ],
  },
] as const;

const PERCORSO_RIEPILOGO = "/attivita/riepilogo";

/**
 * «Riepilogo mese» apre il mese che si sta guardando nell'area attività
 * (calendario/elenco con `?mese=`, dettaglio giornata `/attivita/AAAA-MM-GG`) e
 * il foglio consultato dall'amministratore; altrove il mese corrente.
 */
function hrefRiepilogo(pathname: string, searchParams: URLSearchParams): string {
  if (!pathname.startsWith("/attivita")) return PERCORSO_RIEPILOGO;
  const mese = searchParams.get("mese") ?? /^\/attivita\/(\d{4}-\d{2})-\d{2}$/.exec(pathname)?.[1];
  return urlDelFoglio(
    mese ? `${PERCORSO_RIEPILOGO}?mese=${mese}` : PERCORSO_RIEPILOGO,
    searchParams.get(PARAMETRO_COLLABORATORE_CONSULTATO)
  );
}

// ── Componenti ─────────────────────────────────────────────────

const CLASSI_VOCE =
  "relative flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-sm font-medium no-underline transition-colors max-[920px]:min-h-11";
const CLASSI_VOCE_ATTIVA = "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400";
const CLASSI_VOCE_INATTIVA =
  "text-testo-secondario hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

/** Contenuto di una voce: icona ed etichetta (solo nome accessibile a sidebar collassata). */
function ContenutoVoce({ etichetta, icona, attiva, compressa }: { etichetta: string; icona: string; attiva: boolean; compressa: boolean }) {
  return (
    <>
      {attiva && (
        <span aria-hidden="true" className="absolute -left-[10px] top-2 bottom-2 w-[3px] rounded-full bg-indigo-500 dark:bg-indigo-400" />
      )}
      <Icona d={icona} />
      <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${compressa ? "min-[920px]:sr-only" : ""}`}>
        {etichetta}
      </span>
    </>
  );
}

/** Titolo di un gruppo di voci; a sidebar collassata resta solo un separatore tra i gruppi. */
function TitoloGruppo({ titolo, compressa, primo = false }: { titolo: string; compressa: boolean; primo?: boolean }) {
  return (
    <>
      <span className={`px-[10px] pb-[7px] text-xs font-medium text-testo-metadati ${primo ? "pt-1" : "pt-4"} ${compressa ? "min-[920px]:sr-only" : ""}`}>
        {titolo}
      </span>
      {compressa && !primo && <span aria-hidden="true" className="mx-1.5 my-2 h-px bg-zinc-200 max-[920px]:hidden dark:bg-zinc-700" />}
    </>
  );
}

/**
 * Struttura comune a tutte le aree autenticate: sidebar a sinistra con le
 * voci del ruolo e l'account in fondo, intestazione e contenuto a fianco.
 *
 * Da 920 px in su la sidebar è sempre visibile e si collassa a sole icone
 * (scelta ricordata nel browser). Sotto diventa un menu a scomparsa che entra
 * dal bordo sinistro dal pulsante ≡ dell'intestazione: il resto della pagina è
 * inerte finché resta aperto e si chiude con ×, Esc, lo sfondo o una voce.
 */
export default function SidebarApplicazione({
  amministratore,
  compressaIniziale,
  nome,
  email,
  azioneEsci,
  intestazione,
  children,
}: {
  amministratore: boolean;
  compressaIniziale: boolean;
  nome: string;
  email: string;
  azioneEsci: () => Promise<void>;
  /** Contenuto dell'intestazione (titolo o selettore del foglio); senza, su desktop l'intestazione non c'è */
  intestazione?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [compressa, setCompressa] = useState(compressaIniziale);
  const [menuAperto, setMenuAperto] = useState(false);
  const pulsanteMenu = useRef<HTMLButtonElement>(null);
  const pulsanteChiudi = useRef<HTMLButtonElement>(null);
  // Il pulsante ≡ è inerte finché il menu è aperto: il focus ci torna dopo il rendering.
  const focusAlPulsanteMenu = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apriImpostazioni = useApriImpostazioni();

  useEffect(() => {
    if (!menuAperto) {
      if (focusAlPulsanteMenu.current) pulsanteMenu.current?.focus();
      focusAlPulsanteMenu.current = false;
      return;
    }
    pulsanteChiudi.current?.focus();
    const desktop = window.matchMedia("(min-width: 920px)");
    function alTasto(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      focusAlPulsanteMenu.current = true;
      setMenuAperto(false);
    }
    // Allargando la finestra il menu a scomparsa non esiste più.
    function alCambioLarghezza() {
      if (desktop.matches) setMenuAperto(false);
    }
    document.addEventListener("keydown", alTasto);
    desktop.addEventListener("change", alCambioLarghezza);
    return () => {
      document.removeEventListener("keydown", alTasto);
      desktop.removeEventListener("change", alCambioLarghezza);
    };
  }, [menuAperto]);

  function chiudiMenu() {
    focusAlPulsanteMenu.current = true;
    setMenuAperto(false);
  }

  function alternaCompressa() {
    const nuova = !compressa;
    setCompressa(nuova);
    document.cookie = `${NOME_COOKIE_SIDEBAR_COMPRESSA}=${nuova ? "1" : "0"}; path=/; max-age=${DURATA_COOKIE_SIDEBAR_COMPRESSA_SECONDI}; samesite=lax`;
  }

  const attivitaAttiva = pathname === "/attivita" || (pathname.startsWith("/attivita/") && !pathname.startsWith(PERCORSO_RIEPILOGO));
  const riepilogoAttivo = pathname.startsWith(PERCORSO_RIEPILOGO);
  const suNavigazione = () => setMenuAperto(false);

  return (
    <div className="min-h-[calc(100dvh-var(--altezza-banner-ambiente))]">
      <aside
        aria-label="Barra laterale"
        className={`fixed bottom-0 left-0 top-[var(--altezza-banner-ambiente)] z-40 flex-col border-r border-zinc-200 bg-white transition-[width] dark:border-zinc-800 dark:bg-zinc-900 max-[920px]:w-[290px] max-[920px]:max-w-[85vw] max-[920px]:shadow-xl min-[920px]:flex ${
          compressa ? "min-[920px]:w-16" : "min-[920px]:w-[248px]"
        } ${menuAperto ? "flex" : "hidden"}`}
      >
        <div className={`flex items-center gap-2 border-b border-zinc-100 py-[14px] pl-4 pr-2.5 dark:border-zinc-800 ${compressa ? "min-[920px]:justify-center min-[920px]:px-0" : ""}`}>
          <div className="flex min-w-0 flex-1 items-center gap-[11px] min-[920px]:flex-none">
            <LogoCoachingPlanner mostraNome={false} />
            <div className={`min-w-0 leading-[1.25] ${compressa ? "min-[920px]:hidden" : ""}`}>
              <b className="block text-sm font-semibold tracking-tight whitespace-nowrap text-testo-principale">Coaching Planner</b>
              {amministratore && <span className="text-xs font-medium text-testo-metadati">Amministrazione</span>}
            </div>
          </div>
          <button
            ref={pulsanteChiudi}
            type="button"
            onClick={chiudiMenu}
            aria-label="Chiudi menu di navigazione"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-testo-metadati transition hover:bg-zinc-100 hover:text-zinc-900 min-[920px]:hidden dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-[10px] py-[14px]" aria-label="Navigazione principale">
          <TitoloGruppo titolo="Attività" compressa={compressa} primo />
          <Link
            href="/attivita"
            onClick={suNavigazione}
            aria-current={attivitaAttiva ? "page" : undefined}
            title={compressa ? "Le mie attività" : undefined}
            className={`${CLASSI_VOCE} ${attivitaAttiva ? CLASSI_VOCE_ATTIVA : CLASSI_VOCE_INATTIVA}`}
          >
            <ContenutoVoce etichetta="Le mie attività" icona={ICONA_ATTIVITA} attiva={attivitaAttiva} compressa={compressa} />
          </Link>
          <Link
            href={hrefRiepilogo(pathname, searchParams)}
            // Niente prefetch: l'href segue il mese visualizzato e ogni
            // prefetch sarebbe una richiesta RSC in più a ogni cambio mese.
            prefetch={false}
            onClick={suNavigazione}
            aria-current={riepilogoAttivo ? "page" : undefined}
            title={compressa ? "Riepilogo mese" : undefined}
            className={`${CLASSI_VOCE} ${riepilogoAttivo ? CLASSI_VOCE_ATTIVA : CLASSI_VOCE_INATTIVA}`}
          >
            <ContenutoVoce etichetta="Riepilogo mese" icona={ICONA_RIEPILOGO} attiva={riepilogoAttivo} compressa={compressa} />
          </Link>

          {amministratore &&
            GRUPPI_AMMINISTRAZIONE.map((gruppo) => (
              <div key={gruppo.titolo} className="contents">
                <TitoloGruppo titolo={gruppo.titolo} compressa={compressa} />
                {gruppo.voci.map((voce) => {
                  const attiva = pathname === voce.href || pathname.startsWith(`${voce.href}/`);
                  return (
                    <a
                      key={voce.href}
                      href={voce.href}
                      onClick={suNavigazione}
                      aria-current={attiva ? "page" : undefined}
                      title={compressa ? voce.etichetta : undefined}
                      className={`${CLASSI_VOCE} ${attiva ? CLASSI_VOCE_ATTIVA : CLASSI_VOCE_INATTIVA}`}
                    >
                      <ContenutoVoce etichetta={voce.etichetta} icona={voce.icona} attiva={attiva} compressa={compressa} />
                    </a>
                  );
                })}
              </div>
            ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-zinc-100 p-[10px] dark:border-zinc-800">
          <button
            type="button"
            onClick={alternaCompressa}
            aria-label={compressa ? "Espandi barra laterale" : "Comprimi barra laterale"}
            title={compressa ? "Espandi barra laterale" : "Comprimi barra laterale"}
            className={`flex cursor-pointer items-center gap-[11px] rounded-[10px] px-[11px] py-2 text-[13px] font-medium text-testo-metadati transition hover:bg-zinc-100 hover:text-zinc-900 max-[920px]:hidden dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${compressa ? "justify-center px-0" : ""}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px] shrink-0">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d="M9 4v16" />
              <path d={compressa ? "m14 10 2 2-2 2" : "m16 10-2 2 2 2"} />
            </svg>
            {!compressa && <span aria-hidden="true">Comprimi</span>}
          </button>
          <MenuAccount
            nome={nome}
            email={email}
            ruolo={amministratore ? "Amministratore" : "Collaboratore"}
            azioneEsci={azioneEsci}
            apriImpostazioni={() => {
              setMenuAperto(false);
              apriImpostazioni("tema");
            }}
            compatto={compressa}
          />
        </div>
      </aside>

      {menuAperto && (
        <div aria-hidden="true" onClick={chiudiMenu} className="fixed inset-0 z-30 bg-zinc-900/40 min-[920px]:hidden" />
      )}

      <div
        inert={menuAperto}
        className={`flex min-h-[calc(100dvh-var(--altezza-banner-ambiente))] flex-col transition-[margin] ${compressa ? "min-[920px]:ml-16" : "min-[920px]:ml-[248px]"}`}
      >
        <header
          className={`sticky top-[var(--altezza-banner-ambiente)] z-10 flex min-h-[57px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 bg-white/80 px-8 py-2.5 backdrop-blur-lg max-sm:gap-x-3 max-sm:px-4 dark:border-zinc-800 dark:bg-zinc-950/80 ${
            intestazione ? "" : "min-[920px]:hidden"
          }`}
        >
          <button
            ref={pulsanteMenu}
            type="button"
            onClick={() => setMenuAperto(true)}
            aria-label="Apri menu di navigazione"
            aria-expanded={menuAperto}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-testo-secondario shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 min-[920px]:hidden dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {intestazione ?? (
            <span className="min-[920px]:hidden">
              <LogoCoachingPlanner />
            </span>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
