"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PulsanteAttesa } from "./pulsante-attesa";
import { useIdratata } from "./use-idratata";

// Componente unico per gli elenchi delle anagrafiche (clienti, offerte, utenti):
// selezione delle righe tramite checkbox e barra contestuale con le azioni.
// Nomi e icone delle azioni sono definiti qui una sola volta; ogni pagina
// dichiara solo quali azioni offre.

// ── Configurazione ─────────────────────────────────────────────

/** Azioni che richiedono esattamente un elemento selezionato. */
export type AzioneElencoSelezionabile<T> =
  | { tipo: "modifica"; href: (elemento: T) => string }
  | { tipo: "collaboratori-abilitati"; href: (elemento: T) => string }
  | { tipo: "elimina"; esegui: (elemento: T) => void };

/**
 * Disattivazione/riattivazione, anche su più elementi. La server action riceve
 * un campo `id` per ogni elemento coinvolto e `attivo` ("true"/"false").
 */
export interface StatoElencoSelezionabile<T> {
  attivo: (elemento: T) => boolean;
  azione: (formData: FormData) => void | Promise<void>;
  /** Campi nascosti aggiuntivi (es. posizione nell'elenco). */
  campiNascosti?: ReactNode;
  /** Testo del dialog di conferma della disattivazione. */
  descrizioneDisattivazione?: (elementi: T[]) => ReactNode;
}

export interface NomiElemento {
  singolare: string;
  plurale: string;
  /** Concordanza al femminile («selezionata», «Disattivata»). */
  femminile?: boolean;
}

interface ElencoSelezionabileProps<T> {
  elementi: T[];
  idElemento: (elemento: T) => string;
  nomeElemento: (elemento: T) => string;
  nomi: NomiElemento;
  azioni?: AzioneElencoSelezionabile<T>[];
  stato?: StatoElencoSelezionabile<T>;
  children: ReactNode;
}

interface ContestoSelezione {
  elementi: unknown[];
  idElemento: (elemento: unknown) => string;
  nomeElemento: (elemento: unknown) => string;
  nomi: NomiElemento;
  azioni: AzioneElencoSelezionabile<unknown>[];
  stato?: StatoElencoSelezionabile<unknown>;
  selezionati: Set<string>;
  impostaSelezione: (selezionati: Set<string>) => void;
  chiediDisattivazione: () => void;
}

const ContestoElencoSelezionabile = createContext<ContestoSelezione | null>(null);

function useContestoSelezione(): ContestoSelezione {
  const contesto = useContext(ContestoElencoSelezionabile);
  if (!contesto) {
    throw new Error("Componente usato fuori da <ElencoSelezionabile>");
  }
  return contesto;
}

/** Indica se una riga è selezionata, per evidenziarla. */
export function useSelezioneElenco() {
  const { selezionati } = useContestoSelezione();
  return { isSelezionato: (id: string) => selezionati.has(id) };
}

// ── Provider ───────────────────────────────────────────────────

export function ElencoSelezionabile<T>({
  elementi,
  idElemento,
  nomeElemento,
  nomi,
  azioni = [],
  stato,
  children,
}: ElencoSelezionabileProps<T>) {
  const [selezionati, setSelezionati] = useState<Set<string>>(() => new Set());
  const [elementiPrecedenti, setElementiPrecedenti] = useState(elementi);
  const [conferma, setConferma] = useState(false);

  // Nuovi elementi (cambio pagina/ricerca o esito di un'azione): la selezione
  // vale solo per l'elenco visibile e si azzera.
  if (elementi !== elementiPrecedenti) {
    setElementiPrecedenti(elementi);
    setSelezionati(new Set());
    setConferma(false);
  }

  const contesto: ContestoSelezione = {
    elementi,
    idElemento: idElemento as (elemento: unknown) => string,
    nomeElemento: nomeElemento as (elemento: unknown) => string,
    nomi,
    azioni: azioni as AzioneElencoSelezionabile<unknown>[],
    stato: stato as StatoElencoSelezionabile<unknown> | undefined,
    selezionati,
    impostaSelezione: setSelezionati,
    chiediDisattivazione: () => setConferma(true),
  };

  return (
    <ContestoElencoSelezionabile.Provider value={contesto}>
      {children}
      {conferma && <DialogDisattivazione onChiudi={() => setConferma(false)} />}
    </ContestoElencoSelezionabile.Provider>
  );
}

// ── Checkbox ───────────────────────────────────────────────────

// Le caselle restano disabilitate fino all'idratazione: spuntate prima, apparirebbero
// selezionate senza che la barra delle azioni compaia.
const classeCasella =
  "h-4 w-4 cursor-pointer rounded-[4px] accent-indigo-500 align-middle";

export function CasellaSelezioneTutti() {
  const { elementi, idElemento, selezionati, impostaSelezione } = useContestoSelezione();
  const idratata = useIdratata();
  const riferimento = useRef<HTMLInputElement>(null);
  const tutti = elementi.length > 0 && selezionati.size === elementi.length;
  const parziale = selezionati.size > 0 && !tutti;

  useEffect(() => {
    if (riferimento.current) riferimento.current.indeterminate = parziale;
  }, [parziale]);

  return (
    <input
      ref={riferimento}
      type="checkbox"
      aria-label="Seleziona tutti"
      className={classeCasella}
      checked={tutti}
      disabled={!idratata || elementi.length === 0}
      onChange={() =>
        impostaSelezione(tutti ? new Set() : new Set(elementi.map(idElemento)))
      }
    />
  );
}

export function CasellaSelezione({ id, nome }: { id: string; nome: string }) {
  const { selezionati, impostaSelezione } = useContestoSelezione();
  const idratata = useIdratata();
  return (
    <input
      type="checkbox"
      aria-label={`Seleziona ${nome}`}
      className={classeCasella}
      checked={selezionati.has(id)}
      disabled={!idratata}
      onClick={(evento) => evento.stopPropagation()}
      onChange={() => {
        const nuovi = new Set(selezionati);
        if (nuovi.has(id)) nuovi.delete(id);
        else nuovi.add(id);
        impostaSelezione(nuovi);
      }}
    />
  );
}

// ── Chip di stato ──────────────────────────────────────────────

export function ChipStato({ attivo, femminile = false }: { attivo: boolean; femminile?: boolean }) {
  const desinenza = femminile ? "a" : "o";
  return attivo ? (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
      <span className="h-[6px] w-[6px] rounded-full bg-current" aria-hidden="true" />
      {`Attiv${desinenza}`}
    </span>
  ) : (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
      <span className="h-[6px] w-[6px] rounded-full bg-current" aria-hidden="true" />
      {`Disattivat${desinenza}`}
    </span>
  );
}

// ── Icone e pulsanti ───────────────────────────────────────────

function Icona({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONA_MODIFICA = <Icona><path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" /></Icona>;
const ICONA_COLLABORATORI = (
  <Icona>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.4 4.3a3.5 3.5 0 0 1 0 6.8" />
  </Icona>
);
const ICONA_DISATTIVA = <Icona><circle cx="12" cy="12" r="8.6" /><path d="M6 6l12 12" /></Icona>;
const ICONA_RIATTIVA = <Icona><path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" /><path d="M4.5 17.5V12H10" /></Icona>;
const ICONA_ELIMINA = (
  <Icona><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /></Icona>
);

const classePulsante =
  "inline-flex items-center gap-[6px] rounded-[9px] border border-zinc-200 bg-white px-[11px] py-[6px] font-[inherit] text-[12.5px] font-semibold no-underline shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-zinc-700 dark:bg-zinc-900";
const tonoNeutro = "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800";
const tonoRosso = "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10";
const tonoVerde = "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10";

/** «Disattiva» con una sola selezione, «Disattiva (2)» con più elementi selezionati. */
function etichettaConConteggio(etichetta: string, conteggio: number, selezionati: number) {
  return selezionati > 1 ? `${etichetta} (${conteggio})` : etichetta;
}

function CampiId({ id }: { id: string[] }) {
  return id.map((valore) => <input key={valore} type="hidden" name="id" value={valore} />);
}

// ── Barra ──────────────────────────────────────────────────────

/**
 * Barra sopra la tabella: senza selezione mostra i figli (ricerca e contatori),
 * con almeno un elemento selezionato la barra contestuale con le azioni.
 */
export function BarraElencoSelezionabile({ children }: { children: ReactNode }) {
  const {
    elementi,
    idElemento,
    nomi,
    azioni,
    stato,
    selezionati,
    impostaSelezione,
    chiediDisattivazione,
  } = useContestoSelezione();

  if (selezionati.size === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
        {children}
      </div>
    );
  }

  const elementiSelezionati = elementi.filter((elemento) => selezionati.has(idElemento(elemento)));
  const singolo = elementiSelezionati.length === 1 ? elementiSelezionati[0] : null;
  const daRiattivare = stato ? elementiSelezionati.filter((elemento) => !stato.attivo(elemento)) : [];
  const numeroDaDisattivare = stato ? elementiSelezionati.length - daRiattivare.length : 0;
  const n = elementiSelezionati.length;
  const desinenza = nomi.femminile ? (n === 1 ? "a" : "e") : n === 1 ? "o" : "i";

  return (
    <div
      role="group"
      aria-label="Azioni sulla selezione"
      className="flex min-h-[61px] flex-wrap items-center gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-[12px] dark:border-indigo-500/30 dark:bg-indigo-500/10"
    >
      <span aria-live="polite" className="mr-1 text-[13px] font-bold text-indigo-700 dark:text-indigo-300">
        {`${n} ${n === 1 ? nomi.singolare : nomi.plurale} selezionat${desinenza}`}
      </span>
      <span className="mx-1 h-[22px] w-px bg-indigo-200 dark:bg-indigo-500/30" aria-hidden="true" />

      {singolo !== null &&
        azioni.map((azione) => {
          switch (azione.tipo) {
            case "modifica":
              return (
                <Link key={azione.tipo} href={azione.href(singolo)} className={`${classePulsante} ${tonoNeutro}`}>
                  {ICONA_MODIFICA}
                  Modifica
                </Link>
              );
            case "collaboratori-abilitati":
              return (
                <Link key={azione.tipo} href={azione.href(singolo)} className={`${classePulsante} ${tonoNeutro}`}>
                  {ICONA_COLLABORATORI}
                  Collaboratori abilitati
                </Link>
              );
            default:
              return null;
          }
        })}

      {stato && numeroDaDisattivare > 0 && (
        <button type="button" onClick={chiediDisattivazione} className={`${classePulsante} ${tonoRosso}`}>
          {ICONA_DISATTIVA}
          {etichettaConConteggio("Disattiva", numeroDaDisattivare, n)}
        </button>
      )}

      {stato && daRiattivare.length > 0 && (
        <form action={stato.azione} className="contents">
          <CampiId id={daRiattivare.map(idElemento)} />
          <input type="hidden" name="attivo" value="true" />
          {stato.campiNascosti}
          <PulsanteAttesa className={`${classePulsante} ${tonoVerde}`}>
            {ICONA_RIATTIVA}
            {etichettaConConteggio("Riattiva", daRiattivare.length, n)}
          </PulsanteAttesa>
        </form>
      )}

      {singolo !== null &&
        azioni.map((azione) =>
          azione.tipo === "elimina" ? (
            <button
              key={azione.tipo}
              type="button"
              onClick={() => azione.esegui(singolo)}
              className={`${classePulsante} ${tonoRosso}`}
            >
              {ICONA_ELIMINA}
              Elimina
            </button>
          ) : null,
        )}

      <button
        type="button"
        onClick={() => impostaSelezione(new Set())}
        className="ml-auto inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
      >
        <Icona><path d="M6 6l12 12M18 6 6 18" /></Icona>
        Annulla selezione
      </button>
    </div>
  );
}

// ── Dialog di conferma disattivazione ──────────────────────────

function DialogDisattivazione({ onChiudi }: { onChiudi: () => void }) {
  const { elementi, idElemento, nomeElemento, nomi, stato, selezionati } = useContestoSelezione();
  if (!stato) return null;

  const daDisattivare = elementi.filter(
    (elemento) => selezionati.has(idElemento(elemento)) && stato.attivo(elemento),
  );
  const titolo =
    daDisattivare.length === 1
      ? `Disattivare «${nomeElemento(daDisattivare[0])}»?`
      : `Disattivare ${daDisattivare.length} ${nomi.plurale}?`;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-disattivazione-titolo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onChiudi();
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") onChiudi();
      }}
    >
      <div className="w-full max-w-[440px] rounded-[14px] border border-zinc-200 bg-white p-[22px] shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-[13px] flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {ICONA_DISATTIVA}
        </div>
        <h3 id="dialog-disattivazione-titolo" className="mb-[7px] text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
          {titolo}
        </h3>
        <p className="mb-[18px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
          {stato.descrizioneDisattivazione
            ? stato.descrizioneDisattivazione(daDisattivare)
            : "Gli elementi disattivati restano nello storico e potrai riattivarli in qualsiasi momento; nessun dato viene eliminato."}
        </p>
        <div className="flex justify-end gap-[9px]">
          <button
            type="button"
            autoFocus
            onClick={onChiudi}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Annulla
          </button>
          {/* L'action comunica l'esito con `redirect`: i nuovi elementi azzerano
              la selezione e chiudono il dialog. */}
          <form action={stato.azione}>
            <CampiId id={daDisattivare.map(idElemento)} />
            <input type="hidden" name="attivo" value="false" />
            {stato.campiNascosti}
            <PulsanteAttesa
              etichettaAttesa="Disattivazione…"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-[.92]"
            >
              Disattiva
            </PulsanteAttesa>
          </form>
        </div>
      </div>
    </div>
  );
}
