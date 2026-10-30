"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIdratata } from "@/components";
import { PARAMETRO_COLLABORATORE_CONSULTATO } from "@/lib/url-foglio-attivita";
import type { CollaboratoreDelSelettore } from "@/lib/foglio-attivita";

interface SelettoreFoglioAttivitaProps {
  /** Collaboratori consultabili, già ordinati per cognome e nome dal server. */
  collaboratori: CollaboratoreDelSelettore[];
  /**
   * Profilo collaboratore attivo dell'amministratore: abilita la voce
   * «Le mie attività» ed è escluso dall'elenco dei collaboratori.
   */
  proprioCollaboratoreId: string | null;
  /** Nome dell'amministratore, mostrato accanto a «Le mie attività». */
  nomeUtente: string;
}

/** Voce scelta: l'id del collaboratore, oppure `null` per il proprio foglio. */
interface Voce {
  chiave: string;
  collaboratoreId: string | null;
  etichetta: string;
  dettaglio?: string;
  gruppo: "PROPRIO" | "ATTIVI" | "DISATTIVATI";
}

const ETICHETTA_GRUPPO: Record<Voce["gruppo"], string> = {
  PROPRIO: "Il mio foglio",
  ATTIVI: "Collaboratori attivi",
  DISATTIVATI: "Disattivati",
};

function normalizza(testo: string): string {
  return testo.toLocaleLowerCase("it-IT").trim();
}

/**
 * Titolo dell'intestazione del front office per gli amministratori: mostra di
 * chi è il foglio attività e, cliccato, apre un elenco con ricerca per passare
 * al foglio di un altro collaboratore restando sulla stessa vista (stesso
 * mese, giorno o riepilogo). Il cambio è una navigazione: dati e
 * autorizzazione restano decisi dal server.
 */
export default function SelettoreFoglioAttivita({
  collaboratori,
  proprioCollaboratoreId,
  nomeUtente,
}: SelettoreFoglioAttivitaProps) {
  const router = useRouter();
  const idratata = useIdratata();
  const collaboratoreConsultatoId =
    useSearchParams()?.get(PARAMETRO_COLLABORATORE_CONSULTATO) || null;

  const [aperto, setAperto] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [indiceAttivo, setIndiceAttivo] = useState(0);
  const riferimentoContenitore = useRef<HTMLDivElement>(null);
  const riferimentoPulsante = useRef<HTMLButtonElement>(null);
  const idElenco = useId();
  const idVoce = useId();

  const consultato = collaboratori.find(
    (collaboratore) => collaboratore.id === collaboratoreConsultatoId
  );
  const titolo = consultato
    ? `Attività di ${consultato.nome} ${consultato.cognome}`
    : "Le mie attività";

  const voci = useMemo<Voce[]>(() => {
    const filtro = normalizza(ricerca);
    const corrisponde = (...testi: string[]) =>
      filtro === "" || testi.some((testo) => normalizza(testo).includes(filtro));

    const risultato: Voce[] = [];
    if (proprioCollaboratoreId && corrisponde("Le mie attività", nomeUtente)) {
      risultato.push({
        chiave: "proprio",
        collaboratoreId: null,
        etichetta: "Le mie attività",
        dettaglio: nomeUtente,
        gruppo: "PROPRIO",
      });
    }
    for (const gruppo of ["ATTIVI", "DISATTIVATI"] as const) {
      for (const collaboratore of collaboratori) {
        if (collaboratore.id === proprioCollaboratoreId) continue;
        if (collaboratore.attivo !== (gruppo === "ATTIVI")) continue;
        const nome = `${collaboratore.nome} ${collaboratore.cognome}`;
        if (!corrisponde(nome, `${collaboratore.cognome} ${collaboratore.nome}`)) {
          continue;
        }
        risultato.push({
          chiave: collaboratore.id,
          collaboratoreId: collaboratore.id,
          etichetta: nome,
          dettaglio: gruppo === "DISATTIVATI" ? "sola lettura" : undefined,
          gruppo,
        });
      }
    }
    return risultato;
  }, [collaboratori, proprioCollaboratoreId, nomeUtente, ricerca]);

  useEffect(() => {
    if (!aperto) return;
    function alMouseDown(evento: MouseEvent) {
      if (!riferimentoContenitore.current?.contains(evento.target as Node)) {
        setAperto(false);
      }
    }
    document.addEventListener("mousedown", alMouseDown);
    return () => document.removeEventListener("mousedown", alMouseDown);
  }, [aperto]);

  function apri() {
    setRicerca("");
    setIndiceAttivo(0);
    setAperto(true);
  }

  function chiudi() {
    setAperto(false);
    riferimentoPulsante.current?.focus();
  }

  function scegli(voce: Voce) {
    setAperto(false);
    if (voce.collaboratoreId === collaboratoreConsultatoId) return;

    // La vista corrente si legge da `window.location`: il cambio giorno del
    // dettaglio giornata scrive l'URL con la History API.
    const url = new URL(window.location.href);
    if (voce.collaboratoreId) {
      url.searchParams.set(PARAMETRO_COLLABORATORE_CONSULTATO, voce.collaboratoreId);
    } else {
      url.searchParams.delete(PARAMETRO_COLLABORATORE_CONSULTATO);
    }
    router.push(url.pathname + url.search);
  }

  function alTastoRicerca(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAttivo((indice) => Math.min(indice + 1, voci.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAttivo((indice) => Math.max(indice - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const voce = voci[indiceAttivo];
      if (voce) scegli(voce);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      chiudi();
    } else if (evento.key === "Tab") {
      setAperto(false);
    }
  }

  const voceAttiva = voci[indiceAttivo];

  return (
    <div
      ref={riferimentoContenitore}
      data-testid="selettore-foglio-attivita"
      data-idratata={idratata ? "true" : "false"}
      className="relative"
    >
      <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
        <button
          ref={riferimentoPulsante}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={aperto}
          aria-controls={aperto ? idElenco : undefined}
          onClick={() => (aperto ? setAperto(false) : apri())}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {titolo}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h1>

      {aperto && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <input
            type="search"
            role="combobox"
            aria-label="Cerca collaboratore"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={idElenco}
            aria-activedescendant={
              voceAttiva ? `${idVoce}-${voceAttiva.chiave}` : undefined
            }
            placeholder="Cerca collaboratore…"
            autoFocus
            value={ricerca}
            onChange={(evento) => {
              setRicerca(evento.target.value);
              setIndiceAttivo(0);
            }}
            onKeyDown={alTastoRicerca}
            className="mb-1.5 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[13px] text-zinc-800 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <div
            id={idElenco}
            role="listbox"
            aria-label="Fogli attività"
            className="max-h-80 overflow-y-auto"
          >
            {voci.length === 0 && (
              <p className="px-2 py-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                Nessun collaboratore trovato
              </p>
            )}
            {(["PROPRIO", "ATTIVI", "DISATTIVATI"] as const).map((gruppo) => {
              const vociDelGruppo = voci.filter((voce) => voce.gruppo === gruppo);
              if (vociDelGruppo.length === 0) return null;
              const idGruppo = `${idElenco}-${gruppo}`;
              return (
                <div key={gruppo} role="group" aria-labelledby={idGruppo}>
                  <div
                    id={idGruppo}
                    className="px-2 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[.07em] text-zinc-400 dark:text-zinc-500"
                  >
                    {ETICHETTA_GRUPPO[gruppo]}
                  </div>
                  {vociDelGruppo.map((voce) => {
                    const selezionata =
                      voce.collaboratoreId === collaboratoreConsultatoId;
                    const attiva = voce === voceAttiva;
                    return (
                      <div
                        key={voce.chiave}
                        id={`${idVoce}-${voce.chiave}`}
                        role="option"
                        aria-selected={selezionata}
                        onMouseDown={(evento) => evento.preventDefault()}
                        onMouseEnter={() => setIndiceAttivo(voci.indexOf(voce))}
                        onClick={() => scegli(voce)}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13.5px] ${
                          selezionata
                            ? "font-semibold text-indigo-700 dark:text-indigo-300"
                            : voce.gruppo === "DISATTIVATI"
                              ? "text-zinc-400 dark:text-zinc-500"
                              : "text-zinc-700 dark:text-zinc-200"
                        } ${attiva ? "bg-indigo-50 dark:bg-indigo-500/15" : ""}`}
                      >
                        <span>{voce.etichetta}</span>
                        <span className="text-[12px] font-normal text-zinc-400 dark:text-zinc-500">
                          {selezionata ? "✓" : voce.dettaglio}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
