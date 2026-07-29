"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useActionState } from "react";
import type { CollaboratoreIngaggiato, CollaboratoreIngaggiabile } from "@/lib/abilitazioni";
import type { StatoIngaggiAction } from "./ingaggi-actions";
import { PulsanteAttesa } from "@/components";
import {
  ingaggiaCollaboratoriSuOfferta,
  revocaIngaggioCollaboratore,
} from "./ingaggi-actions";

const statoIniziale: StatoIngaggiAction = { errori: {} };

/** Iniziali di nome e cognome per l'avatar tondo del collaboratore. */
function inizialiPersona(nome: string, cognome: string): string {
  return `${nome[0] ?? ""}${cognome[0] ?? ""}`.toUpperCase();
}

// ── Props ───────────────────────────────────────────────────────

interface IngaggiCollaboratoriProps {
  offertaId: string;
  codiceOfferta: string;
  ingaggiati: CollaboratoreIngaggiato[];
  ingaggiabili: CollaboratoreIngaggiabile[];
}

// ── Sezione "Collaboratori ingaggiati" ──────────────────────────

export default function IngaggiCollaboratori({
  offertaId,
  codiceOfferta,
  ingaggiati,
  ingaggiabili,
}: IngaggiCollaboratoriProps) {
  const [dialogAperto, setDialogAperto] = useState(false);
  const chiudiDialog = useCallback(() => setDialogAperto(false), []);

  return (
    <section aria-labelledby="titolo-collaboratori-ingaggiati" className="mb-[22px]">
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
            <h2 id="titolo-collaboratori-ingaggiati" className="text-[17px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              Collaboratori ingaggiati
            </h2>
            <p className="mt-[1px] text-[12.5px] text-zinc-400 dark:text-zinc-500">
              Chi può inserire ore su questa offerta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            <b className="tabular-nums text-zinc-600 dark:text-zinc-300">{ingaggiati.length}</b>{" "}
            {ingaggiati.length === 1 ? "collaboratore ingaggiato" : "collaboratori ingaggiati"}
          </span>
          <button
            type="button"
            onClick={() => setDialogAperto(true)}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[14px] py-[9px] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ingaggia collaboratori
          </button>
        </div>
      </div>

      {ingaggiati.length === 0 ? (
        <StatoVuoto />
      ) : (
        <section className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full border-collapse text-[13.5px]" aria-label="Collaboratori ingaggiati">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Collaboratore
                </th>
                <th className="w-[170px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Stato
                </th>
                <th className="w-[140px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {ingaggiati.map((collaboratore) => (
                <RigaCollaboratoreIngaggiato
                  key={collaboratore.collaboratoreId}
                  collaboratore={collaboratore}
                  offertaId={offertaId}
                  codiceOfferta={codiceOfferta}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <DialogIngaggia
        offertaId={offertaId}
        codiceOfferta={codiceOfferta}
        ingaggiabili={ingaggiabili}
        aperto={dialogAperto}
        onChiudi={chiudiDialog}
      />
    </section>
  );
}

// ── Riga con azione di revoca ───────────────────────────────────

function RigaCollaboratoreIngaggiato({
  collaboratore,
  offertaId,
  codiceOfferta,
}: {
  collaboratore: CollaboratoreIngaggiato;
  offertaId: string;
  codiceOfferta: string;
}) {
  const [statoRevoca, azione] = useActionState(revocaIngaggioCollaboratore, statoIniziale);
  const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;

  return (
    <tr className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-[13px] align-middle">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              collaboratore.collaboratoreAttivo
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                : "border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
            }`}
          >
            {inizialiPersona(collaboratore.nome, collaboratore.cognome)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100" title={nomeCompleto}>
              {nomeCompleto}
            </span>
            <span className="block truncate text-[12px] text-zinc-400 dark:text-zinc-500">
              {collaboratore.email}
            </span>
          </span>
        </div>
      </td>
      <td className="px-4 py-[13px] align-middle">
        {collaboratore.collaboratoreAttivo ? (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            Attivo
          </span>
        ) : (
          <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
            <span className="h-[6px] w-[6px] rounded-full bg-current" />
            Disattivato
          </span>
        )}
      </td>
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <form action={azione} className="inline">
          <input type="hidden" name="offertaId" value={offertaId} />
          <input type="hidden" name="collaboratoreId" value={collaboratore.collaboratoreId} />
          <PulsanteAttesa
            aria-label={`Revoca l'ingaggio di ${nomeCompleto} sull'offerta ${codiceOfferta}`}
            className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
            Revoca
          </PulsanteAttesa>
        </form>
        {statoRevoca.errori?._form && (
          <p role="alert" className="mt-1 text-[11.5px] font-semibold whitespace-normal text-red-600 dark:text-red-400">
            {statoRevoca.errori._form}
          </p>
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
      <p className="m-0 text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
        Nessun collaboratore ingaggiato
      </p>
      <p className="mx-auto mt-[6px] max-w-[440px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        Su questa offerta non è ancora ingaggiato nessuno. Usa &quot;Ingaggia
        collaboratori&quot; per scegliere fra i collaboratori attivi chi comporrà la
        squadra.
      </p>
    </div>
  );
}

// ── Dialog di ricerca e selezione multipla ──────────────────────

function DialogIngaggia({
  offertaId,
  codiceOfferta,
  ingaggiabili,
  aperto,
  onChiudi,
}: {
  offertaId: string;
  codiceOfferta: string;
  ingaggiabili: CollaboratoreIngaggiabile[];
  aperto: boolean;
  onChiudi: () => void;
}) {
  const [ricerca, setRicerca] = useState("");
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [stato, azione] = useActionState(ingaggiaCollaboratoriSuOfferta, statoIniziale);
  const campoRicercaRef = useRef<HTMLInputElement>(null);

  // Ripristina ricerca e selezione a ogni transizione di apertura/chiusura.
  const [aperturaPrecedente, setAperturaPrecedente] = useState(aperto);
  if (aperto !== aperturaPrecedente) {
    setAperturaPrecedente(aperto);
    setRicerca("");
    setSelezionati(new Set());
  }

  // Chiude il dialog alla riuscita dell'ingaggio.
  useEffect(() => {
    if (stato.successo) {
      onChiudi();
    }
  }, [stato, onChiudi]);

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

  const numeroSelezionati = selezionati.size;

  // I collaboratori selezionati che il filtro di ricerca corrente nasconde non
  // hanno un checkbox montato nel DOM: senza un input nascosto la submit nativa
  // del form li perderebbe silenziosamente al cambio di ricerca.
  const idVisibili = useMemo(
    () => new Set(risultati.map((collaboratore) => collaboratore.collaboratoreId)),
    [risultati],
  );
  const selezionatiNonVisibili = useMemo(
    () => [...selezionati].filter((collaboratoreId) => !idVisibili.has(collaboratoreId)),
    [selezionati, idVisibili],
  );

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
            <h3 id="titolo-dialog-ingaggia" className="text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
              Ingaggia collaboratori
            </h3>
            <p className="mt-[1px] text-[12.5px] text-zinc-500 dark:text-zinc-400">
              Seleziona i collaboratori attivi da ingaggiare sull&apos;offerta {codiceOfferta}.
            </p>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi la finestra"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Ricerca */}
        <div className="border-b border-zinc-200 px-[20px] py-[13px] dark:border-zinc-800">
          <label className="flex items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
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
              className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
          </label>
        </div>

        <form action={azione} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="offertaId" value={offertaId} />
          {selezionatiNonVisibili.map((collaboratoreId) => (
            <input key={collaboratoreId} type="hidden" name="collaboratoreId" value={collaboratoreId} />
          ))}

          {/* Elenco collaboratori selezionabili */}
          <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[14px]">
            {risultati.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-400 dark:text-zinc-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.8} aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p className="m-0 text-[13px] font-medium">
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
                        name="collaboratoreId"
                        value={collaboratore.collaboratoreId}
                        checked={scelta}
                        onChange={(e) => commuta(collaboratore.collaboratoreId, e.target.checked)}
                        className="h-[16px] w-[16px] shrink-0 accent-indigo-500"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        {inizialiPersona(collaboratore.nome, collaboratore.cognome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
                          {collaboratore.nome} {collaboratore.cognome}
                        </span>
                        <span className="block truncate text-[11.5px] text-zinc-400 dark:text-zinc-500">
                          {collaboratore.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Errore di forma */}
          {stato.errori?._form && (
            <div className="mx-[20px] mb-[12px] flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[10px] text-[12.5px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1px] h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              <span>{stato.errori._form}</span>
            </div>
          )}

          {/* Piè di pagina */}
          <div className="flex flex-wrap items-center justify-end gap-[9px] border-t border-zinc-200 px-[20px] py-[14px] dark:border-zinc-800">
            <span className="mr-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
              <b className="tabular-nums text-zinc-600 dark:text-zinc-300">{numeroSelezionati}</b>{" "}
              {numeroSelezionati === 1 ? "collaboratore selezionato" : "collaboratori selezionati"}
            </span>
            <button
              type="button"
              onClick={onChiudi}
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Annulla
            </button>
            <PulsanteAttesa
              disabled={numeroSelezionati === 0}
              etichettaAttesa="Ingaggio…"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Ingaggia selezionati
            </PulsanteAttesa>
          </div>
        </form>
      </div>
    </div>
  );
}
