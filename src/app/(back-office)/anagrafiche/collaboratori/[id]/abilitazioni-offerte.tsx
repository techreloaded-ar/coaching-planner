"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OffertaAbilitata, OffertaAbilitabile } from "@/lib/abilitazioni";
import type { StatoAction } from "../actions";
import { PulsanteAttesa } from "@/components";
import { inizialiCliente } from "@/lib/formattazione";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import {
  abilitaCollaboratoreSuOfferte,
  revocaAbilitazioneCollaboratore,
} from "./abilitazioni-actions";

const statoIniziale: StatoAction = { errori: {} };

const formattaGiorni = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

interface GruppoCliente {
  clienteId: string;
  clienteRagioneSociale: string;
  offerte: OffertaAbilitata[];
}

/** Raggruppa le offerte (già ordinate per cliente e codice) per cliente. */
function raggruppaPerCliente(offerte: OffertaAbilitata[]): GruppoCliente[] {
  const gruppi = new Map<string, GruppoCliente>();
  for (const offerta of offerte) {
    const gruppo = gruppi.get(offerta.clienteId) ?? {
      clienteId: offerta.clienteId,
      clienteRagioneSociale: offerta.clienteRagioneSociale,
      offerte: [],
    };
    gruppo.offerte.push(offerta);
    gruppi.set(offerta.clienteId, gruppo);
  }
  return [...gruppi.values()];
}

/**
 * Foglio attività del collaboratore in vista Elenco, filtrato sull'offerta e
 * aperto sull'ultimo mese in cui vi ha segnato ore (mese corrente se nessuno).
 */
function urlFoglioSullOfferta(collaboratoreId: string, offerta: OffertaAbilitata): string {
  return urlFoglioDaAmministrazione(collaboratoreId, {
    offerta: offerta.offertaId,
    ...(offerta.ultimoMeseConOre ? { mese: offerta.ultimoMeseConOre } : {}),
  });
}

// ── Props ───────────────────────────────────────────────────────

interface AbilitazioniOfferteProps {
  collaboratoreId: string;
  abilitate: OffertaAbilitata[];
  abilitabili: OffertaAbilitabile[];
}

// ── Sezione "Offerte abilitate" ─────────────────────────────────

export default function AbilitazioniOfferte({
  collaboratoreId,
  abilitate,
  abilitabili,
}: AbilitazioniOfferteProps) {
  const [dialogAperto, setDialogAperto] = useState(false);
  const chiudiDialog = useCallback(() => setDialogAperto(false), []);
  const [clientiCompressi, setClientiCompressi] = useState<Set<string>>(new Set());
  const gruppi = useMemo(() => raggruppaPerCliente(abilitate), [abilitate]);

  function commutaCliente(clienteId: string) {
    setClientiCompressi((precedenti) => {
      const successivi = new Set(precedenti);
      if (!successivi.delete(clienteId)) successivi.add(clienteId);
      return successivi;
    });
  }

  return (
    <section aria-labelledby="titolo-offerte-abilitate" className="mb-[22px]">
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-[11px]">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px]" strokeWidth={2}>
              <path d="M9 12l2 2 4-4" />
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
            </svg>
          </span>
          <div>
            <h2 id="titolo-offerte-abilitate" className="text-[17px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              Offerte abilitate
            </h2>
            <p className="mt-[1px] text-[12.5px] text-zinc-400 dark:text-zinc-500">
              Offerte attive su cui il collaboratore può inserire ore · clic su una riga per aprirne le attività
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            <b className="tabular-nums text-zinc-600 dark:text-zinc-300">{abilitate.length}</b>{" "}
            {abilitate.length === 1 ? "offerta abilitata" : "offerte abilitate"}
          </span>
          <button
            type="button"
            onClick={() => setDialogAperto(true)}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[14px] py-[9px] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Abilita offerte
          </button>
        </div>
      </div>

      {abilitate.length === 0 ? (
        <StatoVuoto />
      ) : (
        <section className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full border-collapse text-[13.5px]" aria-label="Offerte abilitate">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Offerta
                </th>
                <th className="w-[170px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Giorni fatturati
                </th>
                <th className="w-[150px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Azioni
                </th>
              </tr>
            </thead>
            {gruppi.map((gruppo) => {
              const compresso = clientiCompressi.has(gruppo.clienteId);
              return (
                <tbody key={gruppo.clienteId}>
                  <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <td colSpan={3} className="p-0">
                      <button
                        type="button"
                        onClick={() => commutaCliente(gruppo.clienteId)}
                        aria-expanded={!compresso}
                        className="flex w-full items-center gap-[9px] px-4 py-[9px] text-left font-[inherit] transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`h-[14px] w-[14px] shrink-0 text-zinc-500 transition-transform ${compresso ? "" : "rotate-90"}`} strokeWidth={2.2} aria-hidden="true">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border border-zinc-200 bg-white text-[10.5px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300">
                          {inizialiCliente(gruppo.clienteRagioneSociale)}
                        </span>
                        <span className="text-[12.5px] font-bold text-zinc-700 dark:text-zinc-200">
                          {gruppo.clienteRagioneSociale}
                        </span>
                        <span className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
                          · {gruppo.offerte.length} {gruppo.offerte.length === 1 ? "offerta" : "offerte"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!compresso &&
                    gruppo.offerte.map((offerta) => (
                      <RigaOffertaAbilitata
                        key={offerta.offertaId}
                        offerta={offerta}
                        collaboratoreId={collaboratoreId}
                      />
                    ))}
                </tbody>
              );
            })}
          </table>
        </section>
      )}

      <DialogAbilita
        collaboratoreId={collaboratoreId}
        abilitabili={abilitabili}
        aperto={dialogAperto}
        onChiudi={chiudiDialog}
      />
    </section>
  );
}

// ── Riga cliccabile con azione di revoca ────────────────────────

function RigaOffertaAbilitata({
  offerta,
  collaboratoreId,
}: {
  offerta: OffertaAbilitata;
  collaboratoreId: string;
}) {
  const [, azione] = useActionState(revocaAbilitazioneCollaboratore, statoIniziale);
  const router = useRouter();
  const href = urlFoglioSullOfferta(collaboratoreId, offerta);

  return (
    <tr
      onClick={(e) => {
        // Link del codice e Revoca gestiscono da sé il proprio clic.
        if ((e.target as HTMLElement).closest("a, button, form")) return;
        router.push(href);
      }}
      className="cursor-pointer border-t border-zinc-100 transition-colors hover:bg-indigo-50/60 dark:border-zinc-800/60 dark:hover:bg-indigo-500/10"
    >
      <td className="px-4 py-[13px] align-middle">
        <Link
          href={href}
          className="block text-[12px] font-semibold text-indigo-600 no-underline hover:underline dark:text-indigo-400"
        >
          {offerta.codice}
        </Link>
        <span className="text-[12.5px] text-zinc-600 dark:text-zinc-300">
          {offerta.descrizione}
        </span>
      </td>
      <td
        className={`px-4 py-[13px] text-right align-middle font-semibold tabular-nums ${
          offerta.giorniFatturati === 0 ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-100"
        }`}
      >
        {formattaGiorni.format(offerta.giorniFatturati)}
      </td>
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <form action={azione} className="inline">
          <input type="hidden" name="collaboratoreId" value={collaboratoreId} />
          <input type="hidden" name="offertaId" value={offerta.offertaId} />
          <PulsanteAttesa className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
            Revoca
          </PulsanteAttesa>
        </form>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="ml-1 inline h-[14px] w-[14px] text-zinc-400 dark:text-zinc-500" strokeWidth={2.2} aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
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
          <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        </svg>
      </div>
      <p className="m-0 text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
        Nessuna offerta abilitata.
      </p>
      <p className="mx-auto mt-[6px] max-w-[440px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        Usa &quot;Abilita offerte&quot; per selezionare le offerte attive su cui il
        collaboratore potrà inserire ore.
      </p>
    </div>
  );
}

// ── Dialog di ricerca e selezione multipla ──────────────────────

function DialogAbilita({
  collaboratoreId,
  abilitabili,
  aperto,
  onChiudi,
}: {
  collaboratoreId: string;
  abilitabili: OffertaAbilitabile[];
  aperto: boolean;
  onChiudi: () => void;
}) {
  const [ricerca, setRicerca] = useState("");
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set());
  const [stato, azione] = useActionState(abilitaCollaboratoreSuOfferte, statoIniziale);
  const campoRicercaRef = useRef<HTMLInputElement>(null);

  // Ripristina ricerca e selezione a ogni transizione di apertura/chiusura.
  const [aperturaPrecedente, setAperturaPrecedente] = useState(aperto);
  if (aperto !== aperturaPrecedente) {
    setAperturaPrecedente(aperto);
    setRicerca("");
    setSelezionate(new Set());
  }

  // Chiude il dialog alla riuscita dell'abilitazione.
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
      abilitabili.filter(
        (offerta) =>
          !filtroLower ||
          offerta.codice.toLowerCase().includes(filtroLower) ||
          offerta.descrizione.toLowerCase().includes(filtroLower) ||
          offerta.clienteRagioneSociale.toLowerCase().includes(filtroLower),
      ),
    [abilitabili, filtroLower],
  );

  function commuta(offertaId: string, scelta: boolean) {
    setSelezionate((precedenti) => {
      const successivi = new Set(precedenti);
      if (scelta) {
        successivi.add(offertaId);
      } else {
        successivi.delete(offertaId);
      }
      return successivi;
    });
  }

  const numeroSelezionate = selezionate.size;

  // Le offerte selezionate che il filtro di ricerca corrente nasconde non hanno
  // un checkbox montato nel DOM: senza un input nascosto la submit nativa del
  // form le perderebbe silenziosamente non appena l'utente cambia ricerca.
  const idVisibili = useMemo(() => new Set(risultati.map((offerta) => offerta.offertaId)), [risultati]);
  const selezionateNonVisibili = useMemo(
    () => [...selezionate].filter((offertaId) => !idVisibili.has(offertaId)),
    [selezionate, idVisibili],
  );

  return (
    <div
      className={`fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px] transition-opacity duration-[.18s] ${
        aperto ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titolo-dialog-abilita"
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
              <path d="M9 12l2 2 4-4" />
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="titolo-dialog-abilita" className="text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
              Abilita offerte
            </h3>
            <p className="mt-[1px] text-[12.5px] text-zinc-500 dark:text-zinc-400">
              Seleziona le offerte attive su cui abilitare il collaboratore.
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
              placeholder="Cerca per codice, descrizione o cliente…"
              aria-label="Cerca offerta"
              className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
          </label>
        </div>

        <form action={azione} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="collaboratoreId" value={collaboratoreId} />
          {selezionateNonVisibili.map((offertaId) => (
            <input key={offertaId} type="hidden" name="offertaId" value={offertaId} />
          ))}

          {/* Elenco offerte selezionabili */}
          <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[14px]">
            {risultati.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-400 dark:text-zinc-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.8} aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p className="m-0 text-[13px] font-medium">Nessuna offerta trovata.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {risultati.map((offerta) => {
                  const scelta = selezionate.has(offerta.offertaId);
                  return (
                    <label
                      key={offerta.offertaId}
                      className={`flex cursor-pointer items-start gap-[11px] rounded-[11px] border px-[13px] py-[11px] transition ${
                        scelta
                          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="offertaId"
                        value={offerta.offertaId}
                        checked={scelta}
                        onChange={(e) => commuta(offerta.offertaId, e.target.checked)}
                        className="mt-[3px] h-[16px] w-[16px] shrink-0 accent-indigo-500"
                      />
                      <span className="min-w-0 flex-1 leading-[1.4]">
                        <span className="flex flex-wrap items-center gap-x-[9px] gap-y-[2px]">
                          <span className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {offerta.codice}
                          </span>
                          <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
                            {offerta.descrizione}
                          </span>
                        </span>
                        <span className="mt-[2px] block text-[12px] text-zinc-500 dark:text-zinc-400">
                          {offerta.clienteRagioneSociale}
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
              <b className="tabular-nums text-zinc-600 dark:text-zinc-300">{numeroSelezionate}</b>{" "}
              {numeroSelezionate === 1 ? "offerta selezionata" : "offerte selezionate"}
            </span>
            <button
              type="button"
              onClick={onChiudi}
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Annulla
            </button>
            <PulsanteAttesa
              disabled={numeroSelezionate === 0}
              etichettaAttesa="Abilitazione…"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Abilita selezionate
            </PulsanteAttesa>
          </div>
        </form>
      </div>
    </div>
  );
}
