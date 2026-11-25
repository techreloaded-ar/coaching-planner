"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OffertaAbilitata, OffertaAbilitabile } from "@/lib/abilitazioni";
import type { StatoAction } from "../actions";
import { CLASSE_ELEMENTO_IN_ATTESA, IndicatoreSalvataggio } from "@/components";
import { AvvisiMutazioni, useMutazioniElenco } from "@/components/mutazioni-elenco";
import { formattaNumeroGiornate, inizialiCliente } from "@/lib/formattazione";
import {
  conAggiunte,
  elencoLeggibile,
  ordinaPerClienteECodice,
  type InAttesa,
} from "@/lib/mutazioni-ottimistiche";
import { urlFoglioDaAmministrazione } from "@/lib/url-foglio-attivita";
import {
  abilitaCollaboratoreSuOfferte,
  revocaAbilitazioneCollaboratore,
} from "./abilitazioni-actions";

const statoIniziale: StatoAction = { errori: {} };

/** Offerta dell'elenco: in attesa di conferma i giorni fatturati non sono ancora noti. */
type OffertaInElenco = InAttesa<OffertaAbilitata>;

type MutazioneAbilitazioni =
  | { tipo: "abilita"; offerte: OffertaInElenco[] }
  | { tipo: "revoca"; offertaId: string };

function applicaMutazioneAbilitazioni(
  offerte: OffertaInElenco[],
  mutazione: MutazioneAbilitazioni,
): OffertaInElenco[] {
  if (mutazione.tipo === "revoca") {
    return offerte.filter((offerta) => offerta.offertaId !== mutazione.offertaId);
  }
  return conAggiunte(offerte, mutazione.offerte, (offerta) => offerta.offertaId, ordinaPerClienteECodice);
}

/** Abilitazione provvisoria: giorni fatturati e ultimo mese con ore arrivano alla conferma. */
function offertaInAttesa(offerta: OffertaAbilitabile): OffertaInElenco {
  return { ...offerta, giorniFatturati: 0, ultimoMeseConOre: null, inAttesa: true };
}

interface GruppoCliente {
  clienteId: string;
  clienteRagioneSociale: string;
  offerte: OffertaInElenco[];
}

/** Raggruppa le offerte (già ordinate per cliente e codice) per cliente. */
function raggruppaPerCliente(offerte: OffertaInElenco[]): GruppoCliente[] {
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
  const {
    elenco: offerte,
    salvataggioInCorso,
    muta,
    avvisi,
    chiudiAvviso,
  } = useMutazioniElenco<OffertaInElenco[], MutazioneAbilitazioni>(
    abilitate,
    applicaMutazioneAbilitazioni,
  );
  const [dialogAperto, setDialogAperto] = useState(false);
  const chiudiDialog = useCallback(() => setDialogAperto(false), []);
  const [clientiCompressi, setClientiCompressi] = useState<Set<string>>(new Set());
  const gruppi = useMemo(() => raggruppaPerCliente(offerte), [offerte]);

  // Le offerte appena abilitate, anche se in attesa di conferma, non sono più
  // proponibili nel dialog.
  const disponibili = useMemo(() => {
    const giaAbilitate = new Set(offerte.map((offerta) => offerta.offertaId));
    return abilitabili.filter((offerta) => !giaAbilitate.has(offerta.offertaId));
  }, [offerte, abilitabili]);

  function commutaCliente(clienteId: string) {
    setClientiCompressi((precedenti) => {
      const successivi = new Set(precedenti);
      if (!successivi.delete(clienteId)) successivi.add(clienteId);
      return successivi;
    });
  }

  function abilita(scelte: OffertaAbilitabile[]) {
    setDialogAperto(false);
    const datiForm = new FormData();
    datiForm.set("collaboratoreId", collaboratoreId);
    for (const offerta of scelte) {
      datiForm.append("offertaId", offerta.offertaId);
    }
    muta(
      { tipo: "abilita", offerte: scelte.map(offertaInAttesa) },
      () => abilitaCollaboratoreSuOfferte(statoIniziale, datiForm),
      {
        operazione: `L'abilitazione su ${elencoLeggibile(scelte.map((offerta) => offerta.codice))} non è riuscita`,
      },
    );
  }

  function revoca(offerta: OffertaAbilitata) {
    const datiForm = new FormData();
    datiForm.set("collaboratoreId", collaboratoreId);
    datiForm.set("offertaId", offerta.offertaId);
    muta(
      { tipo: "revoca", offertaId: offerta.offertaId },
      () => revocaAbilitazioneCollaboratore(statoIniziale, datiForm),
      { operazione: `La revoca dell'abilitazione su ${offerta.codice} non è riuscita` },
    );
  }

  return (
    <section
      aria-labelledby="titolo-offerte-abilitate"
      aria-busy={salvataggioInCorso}
      className="mb-[22px]"
    >
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-[11px]">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[18px] w-[18px]" strokeWidth={2}>
              <path d="M9 12l2 2 4-4" />
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
            </svg>
          </span>
          <div>
            <h2 id="titolo-offerte-abilitate" className="text-[17px] font-semibold tracking-tight text-testo-principale">
              Offerte abilitate
            </h2>
            <p className="mt-[1px] text-sm text-testo-metadati">
              Offerte attive su cui il collaboratore può inserire ore · clic su una riga per aprirne le attività
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-testo-metadati">
            <b className="tabular-nums text-testo-secondario">{offerte.length}</b>{" "}
            {offerte.length === 1 ? "offerta abilitata" : "offerte abilitate"}
          </span>
          <button
            type="button"
            onClick={() => setDialogAperto(true)}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[14px] py-[9px] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Abilita offerte
          </button>
        </div>
      </div>

      <AvvisiMutazioni avvisi={avvisi} onChiudi={chiudiAvviso} className="mb-[14px]" />

      {offerte.length === 0 ? (
        <StatoVuoto />
      ) : (
        <section className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full border-collapse text-sm" aria-label="Offerte abilitate">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                  Offerta
                </th>
                <th className="w-[170px] whitespace-nowrap px-4 py-[11px] text-right text-xs font-medium text-testo-metadati">
                  Giorni fatturati
                </th>
                <th className="w-[150px] whitespace-nowrap px-4 py-[11px] text-right text-xs font-medium text-testo-metadati">
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`h-[14px] w-[14px] shrink-0 text-testo-metadati transition-transform ${compresso ? "" : "rotate-90"}`} strokeWidth={2.2} aria-hidden="true">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border border-zinc-200 bg-white text-xs font-medium text-testo-metadati dark:border-zinc-700 dark:bg-zinc-700/60">
                          {inizialiCliente(gruppo.clienteRagioneSociale)}
                        </span>
                        <span className="text-sm font-semibold text-testo-secondario">
                          {gruppo.clienteRagioneSociale}
                        </span>
                        <span className="text-sm font-medium text-testo-metadati">
                          · {gruppo.offerte.length} {gruppo.offerte.length === 1 ? "offerta" : "offerte"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!compresso &&
                    gruppo.offerte.map((offerta) =>
                      offerta.inAttesa ? (
                        <RigaOffertaInAttesa key={offerta.offertaId} offerta={offerta} />
                      ) : (
                        <RigaOffertaAbilitata
                          key={offerta.offertaId}
                          offerta={offerta}
                          collaboratoreId={collaboratoreId}
                          onRevoca={revoca}
                        />
                      ),
                    )}
                </tbody>
              );
            })}
          </table>
        </section>
      )}

      <DialogAbilita
        abilitabili={disponibili}
        aperto={dialogAperto}
        onChiudi={chiudiDialog}
        onAbilita={abilita}
      />
    </section>
  );
}

// ── Riga cliccabile con azione di revoca ────────────────────────

function RigaOffertaAbilitata({
  offerta,
  collaboratoreId,
  onRevoca,
}: {
  offerta: OffertaAbilitata;
  collaboratoreId: string;
  onRevoca: (offerta: OffertaAbilitata) => void;
}) {
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
          className="block text-sm font-medium text-indigo-600 no-underline hover:underline dark:text-indigo-400"
        >
          {offerta.codice}
        </Link>
        <span className="text-sm text-testo-secondario">
          {offerta.descrizione}
        </span>
      </td>
      <td
        className={`px-4 py-[13px] text-right align-middle font-semibold tabular-nums ${
          offerta.giorniFatturati === 0 ? "text-testo-metadati" : "text-testo-principale"
        }`}
      >
        {formattaNumeroGiornate(offerta.giorniFatturati)}
      </td>
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <button
          type="button"
          onClick={() => onRevoca(offerta)}
          className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] font-[inherit] text-sm font-medium text-testo-secondario transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Revoca
        </button>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="ml-1 inline h-[14px] w-[14px] text-testo-metadati" strokeWidth={2.2} aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </td>
    </tr>
  );
}

// ── Riga in attesa di conferma ──────────────────────────────────

/**
 * Abilitazione appena chiesta: attenuata, senza link né azioni. Giorni
 * fatturati e ultimo mese con ore (che dà il link al foglio) arrivano alla
 * conferma del server; fino ad allora «—».
 */
function RigaOffertaInAttesa({ offerta }: { offerta: OffertaInElenco }) {
  return (
    <tr className={`border-t border-zinc-100 dark:border-zinc-800/60 ${CLASSE_ELEMENTO_IN_ATTESA}`}>
      <td className="px-4 py-[13px] align-middle">
        <span className="block text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {offerta.codice}
        </span>
        <span className="text-sm text-testo-secondario">
          {offerta.descrizione}
        </span>
      </td>
      <td className="px-4 py-[13px] text-right align-middle font-semibold tabular-nums text-testo-metadati">
        —
      </td>
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <IndicatoreSalvataggio />
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
      <p className="m-0 text-sm font-medium text-testo-principale">
        Nessuna offerta abilitata.
      </p>
      <p className="mx-auto mt-[6px] max-w-[440px] text-sm leading-relaxed text-testo-metadati">
        Usa &quot;Abilita offerte&quot; per selezionare le offerte attive su cui il
        collaboratore potrà inserire ore.
      </p>
    </div>
  );
}

// ── Dialog di ricerca e selezione multipla ──────────────────────

function DialogAbilita({
  abilitabili,
  aperto,
  onChiudi,
  onAbilita,
}: {
  abilitabili: OffertaAbilitabile[];
  aperto: boolean;
  onChiudi: () => void;
  onAbilita: (scelte: OffertaAbilitabile[]) => void;
}) {
  const [ricerca, setRicerca] = useState("");
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set());
  const campoRicercaRef = useRef<HTMLInputElement>(null);

  // Ripristina ricerca e selezione a ogni transizione di apertura/chiusura.
  const [aperturaPrecedente, setAperturaPrecedente] = useState(aperto);
  if (aperto !== aperturaPrecedente) {
    setAperturaPrecedente(aperto);
    setRicerca("");
    setSelezionate(new Set());
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

  // La selezione vive nello stato, non nei checkbox montati: le offerte scelte
  // e poi nascoste da un cambio di ricerca restano nell'abilitazione.
  const scelte = abilitabili.filter((offerta) => selezionate.has(offerta.offertaId));
  const numeroSelezionate = scelte.length;

  // Il dialog si chiude subito: l'elenco mostra le offerte scelte in attesa di
  // conferma, e un eventuale rifiuto compare come avviso nella sezione.
  function invia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (scelte.length > 0) onAbilita(scelte);
  }

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
            <h3 id="titolo-dialog-abilita" className="text-[16.5px] font-semibold text-testo-principale">
              Abilita offerte
            </h3>
            <p className="mt-[1px] text-sm text-testo-metadati">
              Seleziona le offerte attive su cui abilitare il collaboratore.
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
              placeholder="Cerca per codice, descrizione o cliente…"
              aria-label="Cerca offerta"
              className="w-full border-0 bg-transparent font-[inherit] text-sm text-testo-principale outline-none placeholder:text-zinc-400"
            />
          </label>
        </div>

        <form onSubmit={invia} className="flex min-h-0 flex-1 flex-col">
          {/* Elenco offerte selezionabili */}
          <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[14px]">
            {risultati.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-testo-metadati">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.8} aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p className="m-0 text-sm font-medium">Nessuna offerta trovata.</p>
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
                        value={offerta.offertaId}
                        checked={scelta}
                        onChange={(e) => commuta(offerta.offertaId, e.target.checked)}
                        className="mt-[3px] h-[16px] w-[16px] shrink-0 accent-indigo-500"
                      />
                      <span className="min-w-0 flex-1 leading-[1.4]">
                        <span className="flex flex-wrap items-center gap-x-[9px] gap-y-[2px]">
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            {offerta.codice}
                          </span>
                          <span className="text-sm font-medium text-testo-principale">
                            {offerta.descrizione}
                          </span>
                        </span>
                        <span className="mt-[2px] block text-xs text-testo-metadati">
                          {offerta.clienteRagioneSociale}
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
              <b className="tabular-nums text-testo-secondario">{numeroSelezionate}</b>{" "}
              {numeroSelezionate === 1 ? "offerta selezionata" : "offerte selezionate"}
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
              disabled={numeroSelezionate === 0}
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Abilita selezionate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
