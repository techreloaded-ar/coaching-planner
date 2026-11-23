"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { PulsanteAttesa } from "@/components";
import { etichettaMese } from "@/domain/calendario";
import { DESCRIZIONE_CATEGORIA_ATTIVITA } from "@/domain/types";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";
import {
  dataBreve,
  dataEstesa,
  descriviGiorni,
  etichettaGiorni,
  meseBreve,
  motivoNonCopiabile,
  raggruppaPerMese,
} from "@/lib/copia-riga";
import { formattaEuro, formattaOre } from "@/lib/formattazione";
import type { AppuntiRiga, EsitoIncolla } from "./appunti-riga";

// ═══════════════════════════════════════════════════════════════
// Icone
// ═══════════════════════════════════════════════════════════════

export function IconaCopia({ className = "h-[15px] w-[15px]" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" />
      <path d="M15.5 5.5H5.8A2.3 2.3 0 0 0 3.5 7.8v9.7" />
    </svg>
  );
}

export function IconaScelto() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m7.5 12.2 3 3 6-6.2"
        fill="none"
        stroke="white"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconaSpunta({ className = "h-[15px] w-[15px]" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconaAvviso() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="mt-[1px] h-[15px] w-[15px] flex-none"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.4M12 16.4h.01" />
    </svg>
  );
}

/** "NWL-2026-03" oppure, senza offerta, il segnaposto. */
function codiceOfferta(riga: RigaAttivitaClient): string {
  return riga.offerta?.codice ?? "Offerta da definire";
}

function etichettaRimborso(riga: RigaAttivitaClient): string | null {
  if (riga.rimborsoTrasfertaEtichetta == null) return null;
  return riga.rimborsoTrasfertaImporto != null
    ? `${riga.rimborsoTrasfertaEtichetta} · ${formattaEuro(riga.rimborsoTrasfertaImporto)}`
    : riga.rimborsoTrasfertaEtichetta;
}

// ═══════════════════════════════════════════════════════════════
// Vassoio degli appunti
// ═══════════════════════════════════════════════════════════════

interface VassoioAppuntiProps {
  appunti: AppuntiRiga;
  /** Mese mostrato dal calendario, per evidenziarne il gruppo di destinazioni. */
  tokenVisualizzato: string;
  /** Avviso non bloccante, per esempio il clic sul giorno di origine. */
  avviso: string | null;
  /** Rifiuto del server: nessuna riga creata, la selezione resta. */
  errore: string | null;
  inCorso: boolean;
  onVaiAlMese: (token: string) => void;
  onAnnulla: () => void;
  onConferma: () => void;
}

/**
 * Barra ancorata in basso che tiene in mano la riga copiata mentre il
 * calendario diventa la superficie su cui incollarla.
 */
export function VassoioAppunti({
  appunti,
  tokenVisualizzato,
  avviso,
  errore,
  inCorso,
  onVaiAlMese,
  onAnnulla,
  onConferma,
}: VassoioAppuntiProps) {
  const { riga, giornoOrigine, giorniScelti } = appunti;
  const gruppi = raggruppaPerMese(giorniScelti);
  const rimborso = etichettaRimborso(riga);
  const nessunGiorno = giorniScelti.length === 0;

  return (
    <section
      aria-label="Appunti: riga da incollare"
      data-testid="vassoio-appunti"
      className="sticky bottom-3 z-30 mt-4 overflow-hidden rounded-[14px] border border-zinc-800 bg-zinc-900 text-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
    >
      {errore && (
        <div
          role="alert"
          data-testid="errore-incolla"
          className="flex items-start gap-2 bg-red-800 px-4 py-2.5 text-sm text-white"
        >
          <IconaAvviso />
          <span>
            <span className="font-semibold">Incolla non riuscito: nessuna riga è stata creata.</span>
            <br />
            {errore}. I giorni scelti sono rimasti selezionati.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-rose-600 text-white">
          <IconaCopia className="h-[17px] w-[17px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-400">
            Negli appunti · riga di {dataBreve(giornoOrigine)}
          </div>
          <div
            data-testid="riga-appunti"
            className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold"
          >
            <span>{riga.cliente.ragioneSociale}</span>
            <span aria-hidden="true" className="text-zinc-500">·</span>
            <span>{codiceOfferta(riga)}</span>
            <span aria-hidden="true" className="text-zinc-500">·</span>
            <span className="tabular-nums">{formattaOre(riga.ore)}</span>
            <span aria-hidden="true" className="text-zinc-500">·</span>
            <span className="font-medium text-zinc-300">
              {DESCRIZIONE_CATEGORIA_ATTIVITA[riga.categoria].etichetta.toLowerCase()}
            </span>
          </div>
          {rimborso && (
            <span
              data-testid="rimborso-appunti"
              className="mt-1 inline-flex rounded-[5px] bg-amber-400/15 px-1.5 py-[1px] text-xs font-medium text-amber-300"
            >
              {rimborso}
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={onAnnulla}
            disabled={inCorso}
            className="inline-flex h-9 cursor-pointer items-center rounded-[9px] border border-zinc-700 px-3.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annulla
          </button>
          <PulsanteAttesa
            type="button"
            data-testid="conferma-incolla"
            attesaEsterna={inCorso}
            etichettaAttesa="Incollo…"
            disabled={nessunGiorno}
            onClick={onConferma}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] bg-rose-600 px-3.5 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            <IconaSpunta />
            {nessunGiorno ? "Incolla" : `Incolla su ${etichettaGiorni(giorniScelti.length)}`}
          </PulsanteAttesa>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-4 py-2.5 text-xs dark:border-zinc-700">
        <span className="font-medium text-zinc-400">Destinazioni</span>
        {nessunGiorno ? (
          <span data-testid="nessuna-destinazione" className="text-zinc-400">
            nessun giorno scelto: clicca i giorni sul calendario
          </span>
        ) : (
          gruppi.map((gruppo) => (
            <button
              key={gruppo.token}
              type="button"
              data-testid="gruppo-destinazioni"
              data-mese={gruppo.token}
              onClick={() => onVaiAlMese(gruppo.token)}
              aria-label={`Vai a ${etichettaMese(gruppo.token)}: ${etichettaGiorni(gruppo.giorni.length)} scelti`}
              aria-current={gruppo.token === tokenVisualizzato ? "true" : undefined}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-semibold tabular-nums transition hover:bg-zinc-800 ${
                gruppo.token === tokenVisualizzato
                  ? "border-rose-400 text-white"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              <span className="text-rose-300">{meseBreve(gruppo.token)}</span>
              {gruppo.giorni.map((giorno) => Number(giorno.slice(8, 10))).join(" · ")}
            </button>
          ))
        )}
        {avviso && (
          <span role="status" data-testid="avviso-incolla" className="font-medium text-amber-300">
            {avviso}
          </span>
        )}
        <span className="ml-auto hidden text-zinc-400 md:inline">
          Un clic aggiunge, un secondo toglie · la selezione resta cambiando mese
        </span>
        <span className="hidden text-zinc-400 md:inline">
          <kbd className="rounded-[4px] border border-zinc-700 bg-zinc-800 px-1 font-sans text-[11px] font-semibold text-zinc-200">
            Esc
          </kbd>{" "}
          esce senza incollare
        </span>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// Esito dell'incolla
// ═══════════════════════════════════════════════════════════════

export function EsitoIncollaBanner({
  esito,
  onChiudi,
}: {
  esito: EsitoIncolla;
  onChiudi: () => void;
}) {
  const { riga, giorni } = esito;
  const rimborso = riga.rimborsoTrasfertaEtichetta;
  return (
    <div
      role="status"
      data-testid="esito-incolla"
      className="mb-[14px] flex items-start gap-3 rounded-[11px] border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
    >
      <IconaSpunta className="mt-0.5 h-4 w-4 flex-none text-emerald-700 dark:text-emerald-400" />
      <div className="flex-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        Riga incollata su {etichettaGiorni(giorni.length)}
        <div className="mt-0.5 text-xs font-normal">
          {riga.cliente.ragioneSociale} · {codiceOfferta(riga)} · {formattaOre(riga.ore)}
          {rimborso != null && <> · rimborso «{rimborso}» incluso</>} — {descriviGiorni(giorni)}
        </div>
      </div>
      <button
        type="button"
        aria-label="Chiudi l'esito"
        onClick={onChiudi}
        className="-m-2 flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-lg text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-rose-600 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Menu della cella: quale riga copiare
// ═══════════════════════════════════════════════════════════════

export interface MenuCopiaAperto {
  giorno: string;
  righe: RigaAttivitaClient[];
  /** Rettangolo del pulsante «Copia» che ha aperto il menu. */
  ancora: DOMRect;
}

const LARGHEZZA_MENU = 360;
const MARGINE = 8;

/**
 * Menu non modale ancorato al pulsante «Copia» della cella. È posizionato
 * rispetto alla finestra, così la griglia (che ritaglia il contenuto agli
 * angoli arrotondati) non lo taglia. Si chiude con Esc (gestito dal
 * calendario), con un clic fuori, scorrendo o ridimensionando la finestra.
 */
export function MenuCopiaGiorno({
  menu,
  onCopia,
  onChiudi,
}: {
  menu: MenuCopiaAperto;
  onCopia: (riga: RigaAttivitaClient) => void;
  onChiudi: (restituisciFocus: boolean) => void;
}) {
  const idTitolo = useId();
  const riferimento = useRef<HTMLDivElement>(null);
  const [posizione, setPosizione] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const posizionato = posizione !== null;

  // Sotto il pulsante se c'è spazio, altrimenti sopra; sempre dentro la finestra.
  useLayoutEffect(() => {
    const altezza = riferimento.current?.offsetHeight ?? 0;
    const { ancora } = menu;
    const larghezza = Math.min(LARGHEZZA_MENU, window.innerWidth - 2 * MARGINE);
    const left = Math.max(
      MARGINE,
      Math.min(ancora.right - larghezza, window.innerWidth - larghezza - MARGINE)
    );
    const sotto = ancora.bottom + 6;
    const top =
      sotto + altezza <= window.innerHeight - MARGINE
        ? sotto
        : Math.max(MARGINE, ancora.top - 6 - altezza);
    setPosizione({ top, left, width: larghezza });
  }, [menu]);

  // Il focus entra nel menu, una volta posizionato: sulla prima riga
  // copiabile, o sul menu stesso.
  useEffect(() => {
    if (!posizionato) return;
    const primo = riferimento.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    (primo ?? riferimento.current)?.focus({ preventScroll: true });
  }, [posizionato]);

  useEffect(() => {
    function alMouseDown(evento: MouseEvent) {
      if (evento.target instanceof Node && riferimento.current?.contains(evento.target)) return;
      onChiudi(false);
    }
    function chiudi() {
      onChiudi(false);
    }
    document.addEventListener("mousedown", alMouseDown);
    window.addEventListener("scroll", chiudi, true);
    window.addEventListener("resize", chiudi);
    return () => {
      document.removeEventListener("mousedown", alMouseDown);
      window.removeEventListener("scroll", chiudi, true);
      window.removeEventListener("resize", chiudi);
    };
  }, [onChiudi]);

  return (
    <div
      ref={riferimento}
      role="dialog"
      aria-labelledby={idTitolo}
      tabIndex={-1}
      data-testid="menu-copia-giorno"
      style={{
        top: posizione?.top ?? 0,
        left: posizione?.left ?? 0,
        width: posizione?.width ?? LARGHEZZA_MENU,
        visibility: posizione ? "visible" : "hidden",
      }}
      className="fixed z-40 rounded-[12px] border border-zinc-200 bg-white p-2 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900"
    >
      <h2 id={idTitolo} className="px-2 pb-1.5 pt-1 text-xs font-semibold text-testo-metadati">
        Quale riga del {dataEstesa(menu.giorno)} vuoi copiare?
      </h2>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {menu.righe.map((riga) => {
          const motivo = motivoNonCopiabile(riga);
          const rimborso = etichettaRimborso(riga);
          return (
            <li
              key={riga.id}
              data-testid="voce-menu-copia"
              data-copiabile={motivo ? "false" : "true"}
              className="flex items-start gap-3 px-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-testo-principale">
                  {riga.cliente.ragioneSociale}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-testo-secondario">
                  <span className="rounded-[4px] bg-zinc-100 px-1.5 py-[1px] font-semibold dark:bg-zinc-800">
                    {codiceOfferta(riga)}
                  </span>
                  <span className="tabular-nums">{formattaOre(riga.ore)}</span>
                  <span>{DESCRIZIONE_CATEGORIA_ATTIVITA[riga.categoria].etichetta}</span>
                </div>
                {rimborso && (
                  <div className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                    {rimborso}
                  </div>
                )}
                {motivo && (
                  <div
                    id={`motivo-menu-${riga.id}`}
                    data-testid="motivo-non-copiabile"
                    className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300"
                  >
                    {motivo}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={motivo !== null}
                aria-describedby={motivo ? `motivo-menu-${riga.id}` : undefined}
                aria-label={`Copia la riga ${riga.cliente.ragioneSociale} ${codiceOfferta(riga)} ${formattaOre(riga.ore)}`}
                onClick={() => onCopia(riga)}
                className="inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-[8px] border border-rose-200 bg-white px-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-testo-metadati disabled:opacity-60 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/40 dark:disabled:border-zinc-700"
              >
                <IconaCopia className="h-[13px] w-[13px]" />
                Copia
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
