"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SelettoreTema } from "@/components";
import { normalizzaTema } from "@/lib/tema";
import CollegamentoCalendario from "./collegamento-calendario";
import { PARAMETRO_ESITO_CALENDARIO, PARAMETRO_IMPOSTAZIONI } from "./parametri";

export type CategoriaImpostazioni = "tema" | "connettori";

const CATEGORIE: { chiave: CategoriaImpostazioni; etichetta: string }[] = [
  { chiave: "tema", etichetta: "Tema" },
  { chiave: "connettori", etichetta: "Connettori" },
];

const ContestoImpostazioni = createContext<(categoria: CategoriaImpostazioni) => void>(() => {});

/** Apre la modale delle Impostazioni sulla categoria indicata. */
export function useApriImpostazioni() {
  return useContext(ContestoImpostazioni);
}

/**
 * Impostazioni in una finestra modale sopra la pagina corrente: categorie
 * Tema e Connettori, chiusura con ×, Esc o click sullo sfondo. Si apre dal
 * menu dell'account oppure arrivando con `?impostazioni=` (indirizzi
 * `/impostazioni/...` e ritorno dal consenso Google): i parametri vengono tolti
 * dall'URL appena letti, così la chiusura lascia la pagina com'era.
 */
export function ProviderImpostazioni({
  collegato,
  emailAccesso,
  children,
}: {
  /** Stato del connettore Google Calendar; `null` senza profilo collaboratore attivo */
  collegato: boolean | null;
  emailAccesso: string;
  children: React.ReactNode;
}) {
  const [categoria, setCategoria] = useState<CategoriaImpostazioni | null>(null);
  const [esitoCalendario, setEsitoCalendario] = useState<string>();
  const riferimentoDialog = useRef<HTMLDialogElement>(null);
  const searchParams = useSearchParams();
  const richiesta = searchParams.get(PARAMETRO_IMPOSTAZIONI);

  useEffect(() => {
    if (!richiesta) return;
    const url = new URL(window.location.href);
    const esito = url.searchParams.get(PARAMETRO_ESITO_CALENDARIO) ?? undefined;
    url.searchParams.delete(PARAMETRO_IMPOSTAZIONI);
    url.searchParams.delete(PARAMETRO_ESITO_CALENDARIO);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- richiesta esterna letta dall'URL una sola volta
    setEsitoCalendario(esito);
    setCategoria(richiesta === "connettori" ? "connettori" : "tema");
  }, [richiesta]);

  useEffect(() => {
    const dialog = riferimentoDialog.current;
    if (categoria && dialog && !dialog.open) dialog.showModal();
  }, [categoria]);

  function apri(nuovaCategoria: CategoriaImpostazioni) {
    setEsitoCalendario(undefined);
    setCategoria(nuovaCategoria);
  }

  function chiudi() {
    riferimentoDialog.current?.close();
  }

  return (
    <ContestoImpostazioni.Provider value={apri}>
      {children}
      {categoria && (
        <dialog
          ref={riferimentoDialog}
          aria-labelledby="titolo-impostazioni"
          onClose={() => setCategoria(null)}
          // Il click sullo sfondo arriva al dialog stesso, non al suo contenuto.
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) chiudi();
          }}
          className="m-auto h-[min(520px,calc(100dvh-2rem))] w-[min(720px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-testo-principale shadow-2xl backdrop:bg-zinc-900/45 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 py-3 pl-5 pr-3 dark:border-zinc-800">
              <h2 id="titolo-impostazioni" className="text-[17px] font-semibold tracking-tight">
                Impostazioni
              </h2>
              <button
                type="button"
                onClick={chiudi}
                aria-label="Chiudi impostazioni"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-testo-metadati transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 max-sm:flex-col">
              <nav
                aria-label="Categorie delle impostazioni"
                className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-zinc-200 px-2.5 py-3 dark:border-zinc-800 max-sm:w-full max-sm:flex-row max-sm:border-r-0 max-sm:border-b"
              >
                {CATEGORIE.map(({ chiave, etichetta }) => (
                  <button
                    key={chiave}
                    type="button"
                    onClick={() => setCategoria(chiave)}
                    aria-current={categoria === chiave ? "true" : undefined}
                    className="cursor-pointer rounded-[10px] px-3 py-2 text-left text-sm font-medium text-testo-secondario transition hover:bg-zinc-100 hover:text-zinc-900 aria-[current=true]:bg-indigo-50 aria-[current=true]:text-indigo-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-[current=true]:bg-indigo-500/15 dark:aria-[current=true]:text-indigo-400"
                  >
                    {etichetta}
                  </button>
                ))}
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5 max-sm:px-4">
                {categoria === "tema" ? (
                  <section aria-labelledby="titolo-tema" className="flex flex-col gap-3">
                    <div>
                      <h3 id="titolo-tema" className="text-[15px] font-semibold text-testo-principale">
                        Tema
                      </h3>
                      <p className="text-sm text-testo-metadati">
                        Aspetto dell&apos;interfaccia su questo browser. «Browser» segue l&apos;impostazione del sistema.
                      </p>
                    </div>
                    {/* La modale esiste solo nel client: il tema corrente è quello applicato a <html>. */}
                    <SelettoreTema temaIniziale={normalizzaTema(document.documentElement.dataset.tema)} />
                  </section>
                ) : (
                  <section aria-labelledby="titolo-connettori" className="flex flex-col gap-3">
                    <div>
                      <h3 id="titolo-connettori" className="text-[15px] font-semibold text-testo-principale">
                        Connettori
                      </h3>
                      <p className="text-sm text-testo-metadati">Collegamenti con servizi esterni.</p>
                    </div>
                    <CollegamentoCalendario
                      collegato={collegato}
                      esito={esitoCalendario}
                      emailAccesso={emailAccesso}
                    />
                  </section>
                )}
              </div>
            </div>
          </div>
        </dialog>
      )}
    </ContestoImpostazioni.Provider>
  );
}
