"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { duplicaRigaSuGiorni } from "@/lib/actions/righe-attivita";
import { PulsanteAttesa } from "@/components";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";
import { etichettaMese, parseDataGiorno } from "@/domain/calendario";

// ── Tipi ────────────────────────────────────────────────────────

interface SelettoreDuplicazioneProps {
  /** Riga già salvata da replicare: è la fotografia che verrà copiata così com'è */
  riga: RigaAttivitaClient;
  /** Giorno YYYY-MM-DD da cui parte la duplicazione: non è una destinazione ammessa */
  giornoOrigine: string;
  /** Chiude il pannello senza duplicare nulla */
  onChiudi: () => void;
  /**
   * Notifica al chiamante una duplicazione riuscita, con i giorni di
   * destinazione scelti e quanti ne sono stati effettivamente creati.
   * La chiusura del pannello resta del chiamante.
   */
  onDuplicata: (giorniDestinazione: string[], giorniCreati: number) => void;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Formatta un giorno YYYY-MM-DD in forma estesa ("11 marzo 2026").
 * Stessa convenzione già usata dal dettaglio giornata.
 */
function dataEstesa(giorno: string): string {
  const [anno, mese, numero] = giorno.split("-").map(Number);
  return new Date(anno, mese - 1, numero).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Abbreviazione del mese mostrata sulla cima della tessera ("mar"). */
function meseBreve(giorno: string): string {
  const [anno, mese, numero] = giorno.split("-").map(Number);
  return new Date(anno, mese - 1, numero).toLocaleDateString("it-IT", {
    month: "short",
  });
}

/** Abbreviazione del giorno della settimana mostrata sotto il numero ("mer"). */
function giornoSettimanaBreve(giorno: string): string {
  const [anno, mese, numero] = giorno.split("-").map(Number);
  return new Date(anno, mese - 1, numero).toLocaleDateString("it-IT", {
    weekday: "short",
  });
}

/** Numero del giorno civile, mostrato in grande sulla tessera. */
function numeroGiorno(giorno: string): number {
  return Number(giorno.slice(8, 10));
}

interface GruppoMese {
  /** Token YYYY-MM del mese */
  token: string;
  /** Giorni scelti in quel mese, in ordine crescente */
  giorni: string[];
}

/**
 * Raggruppa i giorni scelti per token di mese, conservando l'ordine crescente.
 * È ciò che rende visibile la promessa della storia: date arbitrarie, anche non
 * contigue e appartenenti a mesi diversi.
 */
function raggruppaPerMese(giorni: string[]): GruppoMese[] {
  const gruppi: GruppoMese[] = [];
  for (const giorno of giorni) {
    const token = giorno.slice(0, 7);
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.token === token) {
      ultimo.giorni.push(giorno);
    } else {
      gruppi.push({ token, giorni: [giorno] });
    }
  }
  return gruppi;
}

/** "1 giorno" / "N giorni" */
function etichettaConteggio(quanti: number): string {
  return quanti === 1 ? "1 giorno" : `${quanti} giorni`;
}

// ── Componente ──────────────────────────────────────────────────

/**
 * Pannello modale per replicare una riga attività su più giorni scelti uno a
 * uno. Deliberatamente minimale: nessuna libreria di dialog o di date, nessun
 * focus trap. Si chiude con Esc, con «Annulla» e con il clic sullo sfondo.
 *
 * Il pannello non chiude da sé dopo una duplicazione riuscita: notifica il
 * chiamante e lascia a lui la chiusura. Su rifiuto del server resta aperto con
 * le date già scelte intatte, così il lavoro fatto non va perso.
 */
export function SelettoreDuplicazione({
  riga,
  giornoOrigine,
  onChiudi,
  onDuplicata,
}: SelettoreDuplicazioneProps) {
  const idTitolo = useId();
  const idCampoData = useId();
  const idAiutoData = useId();

  const [dataCandidata, setDataCandidata] = useState("");
  const [giorniScelti, setGiorniScelti] = useState<string[]>([]);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  // Chiusura con Esc: nessun setState nell'effetto, solo la registrazione del
  // listener e la sua rimozione allo smontaggio.
  //
  // Mentre la duplicazione è in volo la chiusura è inibita, come già lo sono
  // «Annulla» e la X di testata: chiudere qui smonterebbe il pannello prima che
  // arrivi la risposta, e un eventuale rifiuto resterebbe senza alcun messaggio
  // visibile — cioè senza l'esito che AC-4 promette.
  useEffect(() => {
    function alTasto(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !inCorso) onChiudi();
    }
    document.addEventListener("keydown", alTasto);
    return () => document.removeEventListener("keydown", alTasto);
  }, [onChiudi, inCorso]);

  const gruppi = useMemo(() => raggruppaPerMese(giorniScelti), [giorniScelti]);

  const aggiungi = useCallback(() => {
    const candidata = dataCandidata;

    if (!parseDataGiorno(candidata)) {
      setAvviso("Scegli una data valida.");
      return;
    }
    if (candidata === giornoOrigine) {
      setAvviso("Il giorno di origine non è fra le destinazioni selezionabili.");
      return;
    }
    if (giorniScelti.includes(candidata)) {
      setAvviso("Questo giorno è già fra le destinazioni scelte.");
      return;
    }

    setGiorniScelti([...giorniScelti, candidata].sort());
    setDataCandidata("");
    setAvviso(null);
  }, [dataCandidata, giornoOrigine, giorniScelti]);

  const rimuovi = useCallback((giorno: string) => {
    setGiorniScelti((precedenti) => precedenti.filter((g) => g !== giorno));
  }, []);

  const conferma = useCallback(async () => {
    if (giorniScelti.length === 0) return;

    setErrore(null);
    setInCorso(true);
    try {
      const risultato = await duplicaRigaSuGiorni(riga.id, giorniScelti);
      if (!risultato.success) {
        // Il pannello resta aperto con le date invariate: il rifiuto non deve
        // costare al collaboratore il lavoro di composizione già fatto.
        setErrore(risultato.error ?? "Duplicazione non riuscita");
        return;
      }
      onDuplicata(giorniScelti, risultato.giorniCreati ?? giorniScelti.length);
    } finally {
      setInCorso(false);
    }
  }, [giorniScelti, riga.id, onDuplicata]);

  const nessunGiornoScelto = giorniScelti.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitolo}
      data-testid="selettore-duplicazione"
      onClick={(evento) => {
        // Stessa inibizione dell'Esc: lo sfondo non chiude durante l'attesa.
        if (evento.target === evento.currentTarget && !inCorso) onChiudi();
      }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[2px] sm:p-6"
    >
      <div className="flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[16px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        {/* ── Testata ── */}
        <div className="flex items-start gap-3 border-b border-zinc-200 bg-gradient-to-b from-rose-50 to-transparent p-[17px_19px] dark:border-zinc-700 dark:from-rose-950/30">
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-rose-600 text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[17px] w-[17px]"
            >
              <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" />
              <path d="M15.5 5.5H5.8A2.3 2.3 0 0 0 3.5 7.8v9.7" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3
              id={idTitolo}
              className="text-[16px] font-bold text-zinc-800 dark:text-zinc-100"
            >
              Duplica su più giorni
            </h3>
            <p className="mt-[3px] text-[12.5px] text-zinc-500 dark:text-zinc-400">
              Scegli i giorni su cui replicare questa riga. Verranno create righe
              nuove, identiche all&apos;originale.
            </p>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            disabled={inCorso}
            aria-label="Chiudi la finestra"
            className="ml-auto grid h-[28px] w-[28px] flex-none place-items-center rounded-[8px] border border-zinc-200 bg-white text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[14px] w-[14px]"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* ── Corpo ── */}
        <div className="overflow-auto p-[17px_19px]">
          {/* Scheda della riga di origine: ciò che verrà copiato */}
          <div className="mb-[17px] rounded-[11px] border border-dashed border-rose-200 bg-rose-50 px-[13px] py-[11px] dark:border-rose-900 dark:bg-rose-950/30">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-rose-700 dark:text-rose-300">
              Riga di origine — {dataEstesa(giornoOrigine)}
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] font-bold text-zinc-800 dark:text-zinc-100">
              {riga.cliente.ragioneSociale}
              <span className="font-normal text-zinc-400">·</span>
              {riga.offerta.codice} — {riga.offerta.descrizione}
              <span className="font-normal text-zinc-400">·</span>
              {riga.ore.toFixed(1)} h
              <span className="font-normal text-zinc-400">·</span>
              {riga.fatturabile ? "fatturabile" : "non fatturabile"}
            </div>
            {riga.rimborsoTrasfertaEtichetta != null && (
              <div className="mt-1.5 text-[11.5px] font-semibold text-amber-800 dark:text-amber-300">
                Rimborso trasferta copiato così com&apos;è:{" "}
                {riga.rimborsoTrasfertaEtichetta}
                {riga.rimborsoTrasfertaImporto != null &&
                  ` — € ${parseFloat(riga.rimborsoTrasfertaImporto).toFixed(2)}`}
              </div>
            )}
          </div>

          {/* Aggiunta di un giorno di destinazione */}
          <label
            htmlFor={idCampoData}
            className="mb-[6px] block text-[12px] font-semibold text-zinc-600 dark:text-zinc-400"
          >
            Aggiungi un giorno di destinazione
          </label>
          <div className="flex flex-wrap items-center gap-[9px]">
            <input
              id={idCampoData}
              type="date"
              data-testid="data-duplicazione"
              aria-describedby={idAiutoData}
              value={dataCandidata}
              onChange={(evento) => setDataCandidata(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") {
                  evento.preventDefault();
                  aggiungi();
                }
              }}
              className="min-w-[180px] flex-1 rounded-[8px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] text-zinc-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-rose-900/40"
            />
            <button
              type="button"
              onClick={aggiungi}
              className="inline-flex items-center gap-[5px] rounded-[8px] border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-[13px] w-[13px]"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Aggiungi data
            </button>
          </div>
          <p
            id={idAiutoData}
            className="mt-2 text-[11.5px] text-zinc-400 dark:text-zinc-500"
          >
            Puoi aggiungere quanti giorni vuoi, anche non consecutivi e di mesi
            diversi. Il giorno di origine ({dataEstesa(giornoOrigine)}) non è
            selezionabile.
          </p>

          {avviso && (
            <div
              role="status"
              data-testid="avviso-duplicazione"
              className="mt-2.5 flex items-start gap-2 rounded-[9px] border border-amber-300 bg-amber-50 px-[11px] py-2 text-[12px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="mt-[1px] h-[14px] w-[14px] flex-none"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 7.6h.01" />
              </svg>
              <span>{avviso}</span>
            </div>
          )}

          {/* Pista dei giorni scelti */}
          <div className="mt-[19px] border-t border-zinc-100 pt-4 dark:border-zinc-700">
            <div className="mb-[11px] flex items-baseline gap-2">
              <h4 className="text-[12px] font-extrabold uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
                Giorni scelti
              </h4>
              {!nessunGiornoScelto && (
                <span
                  data-testid="conteggio-giorni-duplicazione"
                  className="ml-auto rounded-full border border-rose-200 bg-rose-50 px-2.5 py-[2px] text-[11.5px] font-extrabold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  {etichettaConteggio(giorniScelti.length)}
                </span>
              )}
            </div>

            {nessunGiornoScelto ? (
              <div
                data-testid="pista-duplicazione-vuota"
                className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-[22px] text-center text-[12.5px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-500"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  className="mx-auto mb-2 h-[26px] w-[26px] opacity-40"
                >
                  <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
                  <path d="M16 2.5v4M8 2.5v4M3 10h18" />
                </svg>
                Nessun giorno scelto.
                <br />
                Aggiungi almeno una data per abilitare la duplicazione.
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-x-[14px] gap-y-2">
                {gruppi.map((gruppo) => (
                  <div key={gruppo.token} className="flex flex-col gap-[7px]">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-zinc-400 dark:text-zinc-500">
                      {etichettaMese(gruppo.token)}
                    </span>
                    <div className="flex flex-wrap gap-[7px]">
                      {gruppo.giorni.map((giorno) => (
                        <div
                          key={giorno}
                          data-testid="giorno-scelto"
                          data-giorno={giorno}
                          className="relative w-[60px] overflow-hidden rounded-[10px] border border-rose-200 bg-white text-center shadow-sm dark:border-rose-900 dark:bg-zinc-800"
                        >
                          <div className="bg-rose-600 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.08em] text-white">
                            {meseBreve(giorno)}
                          </div>
                          <div className="pb-[1px] pt-[5px] text-[21px] font-extrabold tabular-nums text-zinc-800 dark:text-zinc-100">
                            {numeroGiorno(giorno)}
                          </div>
                          <div className="pb-1.5 text-[9.5px] font-bold capitalize text-zinc-400 dark:text-zinc-500">
                            {giornoSettimanaBreve(giorno)}
                          </div>
                          <button
                            type="button"
                            onClick={() => rimuovi(giorno)}
                            aria-label={`Togli il ${dataEstesa(giorno)} dalle destinazioni`}
                            className="absolute right-[3px] top-[20px] grid h-[17px] w-[17px] place-items-center rounded-full border border-zinc-200 bg-white p-0 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              className="h-[9px] w-[9px]"
                            >
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errore && (
            <div
              role="alert"
              data-testid="errore-duplicazione"
              className="mt-4 flex items-start gap-2.5 rounded-[9px] border border-red-200 bg-red-50 px-[13px] py-2.5 text-[12.5px] font-semibold text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.1}
                className="mt-[1px] h-[15px] w-[15px] flex-none"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.4M12 16.4h.01" />
              </svg>
              <span>{errore}</span>
            </div>
          )}
        </div>

        {/* ── Piede ── */}
        <div className="flex items-center gap-2.5 border-t border-zinc-200 bg-zinc-50 p-[14px_19px] dark:border-zinc-700 dark:bg-zinc-900/40">
          <span className="flex-1 text-[11.5px] font-semibold text-zinc-400 dark:text-zinc-500">
            Le righe esistenti sui giorni scelti non vengono toccate.
          </span>
          <button
            type="button"
            onClick={onChiudi}
            disabled={inCorso}
            className="inline-flex items-center rounded-[8px] border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          >
            Annulla
          </button>
          <PulsanteAttesa
            type="button"
            data-testid="conferma-duplicazione"
            attesaEsterna={inCorso}
            etichettaAttesa="Duplicazione…"
            disabled={nessunGiornoScelto}
            onClick={conferma}
            className="inline-flex items-center gap-[5px] rounded-[8px] bg-rose-600 px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-rose-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[13px] w-[13px]"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {nessunGiornoScelto
              ? "Duplica"
              : `Duplica su ${etichettaConteggio(giorniScelti.length)}`}
          </PulsanteAttesa>
        </div>
      </div>
    </div>
  );
}
