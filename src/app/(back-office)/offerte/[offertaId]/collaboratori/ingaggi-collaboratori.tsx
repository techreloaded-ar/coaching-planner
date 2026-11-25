"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { CollaboratoreIngaggiato, CollaboratoreIngaggiabile } from "@/lib/abilitazioni";
import type { StatoIngaggiAction } from "./ingaggi-actions";
import { CLASSE_ELEMENTO_IN_ATTESA, IndicatoreSalvataggio } from "@/components";
import { AvvisiMutazioni, useMutazioniElenco } from "@/components/mutazioni-elenco";
import {
  conAggiunte,
  elencoLeggibile,
  ordinaPerCognomeENome,
  type InAttesa,
} from "@/lib/mutazioni-ottimistiche";
import {
  ingaggiaCollaboratoriSuOfferta,
  revocaIngaggioCollaboratore,
} from "./ingaggi-actions";

const statoIniziale: StatoIngaggiAction = { errori: {} };

/** Iniziali di nome e cognome per l'avatar tondo del collaboratore. */
function inizialiPersona(nome: string, cognome: string): string {
  return `${nome[0] ?? ""}${cognome[0] ?? ""}`.toUpperCase();
}

function nomeCompleto(collaboratore: { nome: string; cognome: string }): string {
  return `${collaboratore.nome} ${collaboratore.cognome}`;
}

// ── Squadra ottimistica ─────────────────────────────────────────
//
// La squadra è condivisa fra la sezione «Collaboratori ingaggiati» e il
// contatore «Squadra attiva» nella testata della pagina: ingaggi e revoche si
// vedono subito in entrambi e tornano ai dati del server alla conferma.

type CollaboratoreInSquadra = InAttesa<CollaboratoreIngaggiato>;

type MutazioneSquadra =
  | { tipo: "ingaggia"; collaboratori: CollaboratoreInSquadra[] }
  | { tipo: "revoca"; collaboratoreId: string };

function applicaMutazioneSquadra(
  squadra: CollaboratoreInSquadra[],
  mutazione: MutazioneSquadra,
): CollaboratoreInSquadra[] {
  if (mutazione.tipo === "revoca") {
    return squadra.filter(
      (collaboratore) => collaboratore.collaboratoreId !== mutazione.collaboratoreId,
    );
  }
  return conAggiunte(
    squadra,
    mutazione.collaboratori,
    (collaboratore) => collaboratore.collaboratoreId,
    ordinaPerCognomeENome,
  );
}

function useSquadraOttimistica(ingaggiati: CollaboratoreIngaggiato[]) {
  return useMutazioniElenco<CollaboratoreInSquadra[], MutazioneSquadra>(
    ingaggiati,
    applicaMutazioneSquadra,
  );
}

type SquadraOttimistica = ReturnType<typeof useSquadraOttimistica>;

const ContestoSquadra = createContext<SquadraOttimistica | null>(null);

function useSquadra(): SquadraOttimistica {
  const squadra = useContext(ContestoSquadra);
  if (!squadra) throw new Error("useSquadra va usato dentro <SquadraOfferta>");
  return squadra;
}

/** Fornisce la squadra ottimistica dell'offerta a sezione e contatore. */
export function SquadraOfferta({
  ingaggiati,
  children,
}: {
  ingaggiati: CollaboratoreIngaggiato[];
  children: ReactNode;
}) {
  const squadra = useSquadraOttimistica(ingaggiati);
  return <ContestoSquadra.Provider value={squadra}>{children}</ContestoSquadra.Provider>;
}

/**
 * Contatore «Squadra attiva» della testata: conta chi può inserire ore, cioè i
 * soli ingaggiati attivi. La tabella elenca invece anche gli ingaggi storici
 * verso profili nel frattempo disattivati (AC-1).
 */
export function ContatoreSquadraAttiva() {
  const { elenco: squadra } = useSquadra();
  const collaboratoriAttivi = squadra.filter(
    (collaboratore) => collaboratore.collaboratoreAttivo,
  ).length;

  return (
    <div
      data-testid="squadra-attiva"
      className="flex shrink-0 flex-col justify-center border-l border-zinc-200 py-1 pl-5 text-right max-[720px]:mt-1 max-[720px]:w-full max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:pt-3 max-[720px]:pl-0 max-[720px]:text-left dark:border-zinc-800"
    >
      <span className="mb-1 text-xs font-medium text-testo-metadati">
        Squadra attiva
      </span>
      <span className="text-[22px] font-semibold tracking-tight text-testo-principale tabular-nums">
        {collaboratoriAttivi}
      </span>
      <span className="text-xs font-medium text-testo-metadati">
        {collaboratoriAttivi === 1 ? "collaboratore" : "collaboratori"}
      </span>
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────

interface IngaggiCollaboratoriProps {
  offertaId: string;
  codiceOfferta: string;
  ingaggiabili: CollaboratoreIngaggiabile[];
}

// ── Sezione "Collaboratori ingaggiati" ──────────────────────────

/** Va resa dentro `<SquadraOfferta>`, che fornisce la squadra ottimistica. */
export default function IngaggiCollaboratori({
  offertaId,
  codiceOfferta,
  ingaggiabili,
}: IngaggiCollaboratoriProps) {
  const { elenco: ingaggiati, salvataggioInCorso, muta, avvisi, chiudiAvviso } = useSquadra();
  const [dialogAperto, setDialogAperto] = useState(false);
  const chiudiDialog = useCallback(() => setDialogAperto(false), []);

  // Chi è appena entrato in squadra, anche se in attesa di conferma, non è più
  // proponibile nel dialog.
  const disponibili = useMemo(() => {
    const inSquadra = new Set(ingaggiati.map((collaboratore) => collaboratore.collaboratoreId));
    return ingaggiabili.filter((collaboratore) => !inSquadra.has(collaboratore.collaboratoreId));
  }, [ingaggiati, ingaggiabili]);

  function ingaggia(scelti: CollaboratoreIngaggiabile[]) {
    setDialogAperto(false);
    const datiForm = new FormData();
    datiForm.set("offertaId", offertaId);
    for (const collaboratore of scelti) {
      datiForm.append("collaboratoreId", collaboratore.collaboratoreId);
    }
    muta(
      {
        tipo: "ingaggia",
        // Il dialog propone solo collaboratori attivi.
        collaboratori: scelti.map((collaboratore) => ({
          ...collaboratore,
          collaboratoreAttivo: true,
          inAttesa: true,
        })),
      },
      () => ingaggiaCollaboratoriSuOfferta(statoIniziale, datiForm),
      {
        operazione: `L'ingaggio di ${elencoLeggibile(scelti.map(nomeCompleto))} sull'offerta ${codiceOfferta} non è riuscito`,
      },
    );
  }

  function revoca(collaboratore: CollaboratoreIngaggiato) {
    const datiForm = new FormData();
    datiForm.set("offertaId", offertaId);
    datiForm.set("collaboratoreId", collaboratore.collaboratoreId);
    muta(
      { tipo: "revoca", collaboratoreId: collaboratore.collaboratoreId },
      () => revocaIngaggioCollaboratore(statoIniziale, datiForm),
      { operazione: `La revoca di ${nomeCompleto(collaboratore)} non è riuscita` },
    );
  }

  return (
    <section
      aria-labelledby="titolo-collaboratori-ingaggiati"
      aria-busy={salvataggioInCorso}
      className="mb-[22px]"
    >
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-[11px]">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px]" strokeWidth={2}>
              <circle cx="9" cy="8" r="3.4" />
              <path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0" />
              <circle cx="17.2" cy="9.4" r="2.6" />
              <path d="M15.4 14.6a5 5 0 0 1 5.8 4.8" />
            </svg>
          </span>
          <div>
            <h2 id="titolo-collaboratori-ingaggiati" className="text-[17px] font-semibold tracking-tight text-testo-principale">
              Collaboratori ingaggiati
            </h2>
            <p className="mt-[1px] text-sm text-testo-metadati">
              Chi può inserire ore su questa offerta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-testo-metadati">
            <b className="tabular-nums text-testo-secondario">{ingaggiati.length}</b>{" "}
            {ingaggiati.length === 1 ? "collaboratore ingaggiato" : "collaboratori ingaggiati"}
          </span>
          <button
            type="button"
            onClick={() => setDialogAperto(true)}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[14px] py-[9px] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ingaggia collaboratori
          </button>
        </div>
      </div>

      <AvvisiMutazioni avvisi={avvisi} onChiudi={chiudiAvviso} className="mb-[14px]" />

      {ingaggiati.length === 0 ? (
        <StatoVuoto />
      ) : (
        <section className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full border-collapse text-sm" aria-label="Collaboratori ingaggiati">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                  Collaboratore
                </th>
                <th className="w-[170px] whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                  Stato
                </th>
                <th className="w-[140px] whitespace-nowrap px-4 py-[11px] text-right text-xs font-medium text-testo-metadati">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {ingaggiati.map((collaboratore) => (
                <RigaCollaboratoreIngaggiato
                  key={collaboratore.collaboratoreId}
                  collaboratore={collaboratore}
                  codiceOfferta={codiceOfferta}
                  onRevoca={revoca}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <DialogIngaggia
        codiceOfferta={codiceOfferta}
        ingaggiabili={disponibili}
        aperto={dialogAperto}
        onChiudi={chiudiDialog}
        onIngaggia={ingaggia}
      />
    </section>
  );
}

// ── Riga con azione di revoca ───────────────────────────────────

function RigaCollaboratoreIngaggiato({
  collaboratore,
  codiceOfferta,
  onRevoca,
}: {
  collaboratore: CollaboratoreInSquadra;
  codiceOfferta: string;
  onRevoca: (collaboratore: CollaboratoreIngaggiato) => void;
}) {
  const nome = nomeCompleto(collaboratore);

  return (
    <tr
      className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50 ${
        collaboratore.inAttesa ? CLASSE_ELEMENTO_IN_ATTESA : ""
      }`}
    >
      <td className="px-4 py-[13px] align-middle">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              collaboratore.collaboratoreAttivo
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                : "border border-zinc-200 bg-zinc-100 text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            {inizialiPersona(collaboratore.nome, collaboratore.cognome)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-testo-principale" title={nome}>
              {nome}
            </span>
            <span className="block truncate text-xs text-testo-metadati">
              {collaboratore.email}
            </span>
          </span>
        </div>
      </td>
      <td className="px-4 py-[13px] align-middle">
        {collaboratore.collaboratoreAttivo ? (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            Attivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-xs font-medium whitespace-nowrap text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            Disattivato
          </span>
        )}
      </td>
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        {collaboratore.inAttesa ? (
          // In attesa di conferma: nessuna azione, solo lo stato del salvataggio.
          <IndicatoreSalvataggio />
        ) : (
          <button
            type="button"
            onClick={() => onRevoca(collaboratore)}
            aria-label={`Revoca l'ingaggio di ${nome} sull'offerta ${codiceOfferta}`}
            className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] font-[inherit] text-sm font-medium text-testo-secondario transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
            Revoca
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Stato vuoto ─────────────────────────────────────────────────

function StatoVuoto() {
  return (
    <div className="rounded-[11px] border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={1.9}>
          <circle cx="9" cy="8" r="3.4" />
          <path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0" />
          <circle cx="17.2" cy="9.4" r="2.6" />
          <path d="M15.4 14.6a5 5 0 0 1 5.8 4.8" />
        </svg>
      </div>
      <p className="m-0 text-sm font-medium text-testo-principale">
        Nessun collaboratore ingaggiato
      </p>
      <p className="mx-auto mt-[6px] max-w-[440px] text-sm leading-relaxed text-testo-metadati">
        Su questa offerta non è ancora ingaggiato nessuno. Usa &quot;Ingaggia
        collaboratori&quot; per scegliere fra i collaboratori attivi chi comporrà la
        squadra.
      </p>
    </div>
  );
}

// ── Dialog di ricerca e selezione multipla ──────────────────────

function DialogIngaggia({
  codiceOfferta,
  ingaggiabili,
  aperto,
  onChiudi,
  onIngaggia,
}: {
  codiceOfferta: string;
  ingaggiabili: CollaboratoreIngaggiabile[];
  aperto: boolean;
  onChiudi: () => void;
  onIngaggia: (scelti: CollaboratoreIngaggiabile[]) => void;
}) {
  const [ricerca, setRicerca] = useState("");
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const campoRicercaRef = useRef<HTMLInputElement>(null);

  // Ripristina ricerca e selezione a ogni transizione di apertura/chiusura.
  const [aperturaPrecedente, setAperturaPrecedente] = useState(aperto);
  if (aperto !== aperturaPrecedente) {
    setAperturaPrecedente(aperto);
    setRicerca("");
    setSelezionati(new Set());
  }

  // Porta il fuoco al campo di ricerca all'apertura.
  useEffect(() => {
    if (aperto) {
      campoRicercaRef.current?.focus();
    }
  }, [aperto]);

  const filtroLower = ricerca.trim().toLowerCase();
  const risultati = useMemo(
    () =>
      ingaggiabili.filter(
        (collaboratore) =>
          !filtroLower ||
          collaboratore.nome.toLowerCase().includes(filtroLower) ||
          collaboratore.cognome.toLowerCase().includes(filtroLower),
      ),
    [ingaggiabili, filtroLower],
  );

  function commuta(collaboratoreId: string, scelta: boolean) {
    setSelezionati((precedenti) => {
      const successivi = new Set(precedenti);
      if (scelta) {
        successivi.add(collaboratoreId);
      } else {
        successivi.delete(collaboratoreId);
      }
      return successivi;
    });
  }

  // La selezione vive nello stato, non nei checkbox montati: i collaboratori
  // scelti e poi nascosti da un cambio di ricerca restano nell'ingaggio.
  const scelti = ingaggiabili.filter((collaboratore) =>
    selezionati.has(collaboratore.collaboratoreId),
  );
  const numeroSelezionati = scelti.length;

  // Il dialog si chiude subito: la squadra mostra i collaboratori scelti in
  // attesa di conferma, e un eventuale rifiuto compare come avviso nella sezione.
  function invia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (scelti.length > 0) onIngaggia(scelti);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px] transition-opacity duration-[.18s] ${
        aperto ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titolo-dialog-ingaggia"
      aria-hidden={!aperto}
      onClick={(e) => {
        if (e.target === e.currentTarget) onChiudi();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onChiudi();
      }}
    >
      <div
        className={`flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-zinc-200 bg-white shadow-xl transition-transform duration-[.18s] dark:border-zinc-700 dark:bg-zinc-900 ${
          aperto ? "scale-100 translate-y-0" : "scale-[.98] translate-y-2"
        }`}
      >
        {/* Intestazione */}
        <div className="flex items-start gap-[11px] border-b border-zinc-200 px-[20px] py-[16px] dark:border-zinc-800">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px]" strokeWidth={2}>
              <circle cx="9" cy="8" r="3.4" />
              <path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0" />
              <path d="M18 8.4v5.2M15.4 11h5.2" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="titolo-dialog-ingaggia" className="text-[16.5px] font-semibold text-testo-principale">
              Ingaggia collaboratori
            </h3>
            <p className="mt-[1px] text-sm text-testo-metadati">
              Seleziona i collaboratori attivi da ingaggiare sull&apos;offerta {codiceOfferta}.
            </p>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi la finestra"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-testo-metadati transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Ricerca */}
        <div className="border-b border-zinc-200 px-[20px] py-[13px] dark:border-zinc-800">
          <label className="flex items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={campoRicercaRef}
              type="search"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca per nome o cognome…"
              aria-label="Cerca collaboratori"
              className="w-full border-0 bg-transparent font-[inherit] text-sm text-testo-principale outline-none placeholder:text-zinc-400"
            />
          </label>
        </div>

        <form onSubmit={invia} className="flex min-h-0 flex-1 flex-col">
          {/* Elenco collaboratori selezionabili */}
          <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[14px]">
            {risultati.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-testo-metadati">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.8} aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p className="m-0 text-sm font-medium">
                  {ingaggiabili.length === 0
                    ? "Tutti i collaboratori attivi sono già ingaggiati su questa offerta."
                    : "Nessun collaboratore attivo corrisponde alla ricerca."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {risultati.map((collaboratore) => {
                  const scelta = selezionati.has(collaboratore.collaboratoreId);
                  return (
                    <label
                      key={collaboratore.collaboratoreId}
                      className={`flex cursor-pointer items-center gap-[11px] rounded-[11px] border px-[13px] py-[11px] transition ${
                        scelta
                          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={collaboratore.collaboratoreId}
                        checked={scelta}
                        onChange={(e) => commuta(collaboratore.collaboratoreId, e.target.checked)}
                        className="h-[16px] w-[16px] shrink-0 accent-indigo-500"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        {inizialiPersona(collaboratore.nome, collaboratore.cognome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-testo-principale">
                          {collaboratore.nome} {collaboratore.cognome}
                        </span>
                        <span className="block truncate text-xs text-testo-metadati">
                          {collaboratore.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Piè di pagina */}
          <div className="flex flex-wrap items-center justify-end gap-[9px] border-t border-zinc-200 px-[20px] py-[14px] dark:border-zinc-800">
            <span className="mr-auto text-sm font-medium text-testo-metadati">
              <b className="tabular-nums text-testo-secondario">{numeroSelezionati}</b>{" "}
              {numeroSelezionati === 1 ? "collaboratore selezionato" : "collaboratori selezionati"}
            </span>
            <button
              type="button"
              onClick={onChiudi}
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-sm font-medium text-testo-secondario shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={numeroSelezionati === 0}
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Ingaggia selezionati
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
