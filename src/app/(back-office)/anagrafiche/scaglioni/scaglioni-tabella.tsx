"use client";

import { useState, useCallback } from "react";
import type { ScaglioneKm } from "@/generated/prisma/client";
import { eliminaScaglione } from "./actions";

// ── Utilità ────────────────────────────────────────────────────

function formattaEuro(valore: number | string) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(valore));
}

/** Etichetta leggibile della fascia: «Da A a B km» / «Fino a B km». */
function etichettaFascia(da: number, a: number) {
  return da > 0 ? `Da ${da} a ${a} km` : `Fino a ${a} km`;
}

// ── Props ──────────────────────────────────────────────────────

type ScaglioneVista = Omit<ScaglioneKm, "importo"> & {
  importo: string;
};

interface ScaglioniTabellaProps {
  scaglioni: ScaglioneVista[];
}

// ── Componente ─────────────────────────────────────────────────

export default function ScaglioniTabella({ scaglioni }: ScaglioniTabellaProps) {
  const [scaglioneDaEliminare, setScaglioneDaEliminare] = useState<ScaglioneVista | null>(null);
  const [modaleAperta, setModaleAperta] = useState(false);

  const chiudiModale = useCallback(() => setModaleAperta(false), []);

  const apriModaleElimina = useCallback((scaglione: ScaglioneVista) => {
    setScaglioneDaEliminare(scaglione);
    setModaleAperta(true);
  }, []);

  const massima = scaglioni.length > 0 ? scaglioni[scaglioni.length - 1].finoAKm : null;

  return (
    <>
      <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
          <span className="inline-flex items-center gap-[9px] rounded-full border border-indigo-200 bg-indigo-50 px-[13px] py-[5px] text-[12.5px] font-semibold text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[13px] w-[13px]" strokeWidth={2}>
              <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
            </svg>
            Configurazione rimborsi trasferta
          </span>
          <span className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            {scaglioni.length === 0
              ? "Nessuno scaglione"
              : `${scaglioni.length} scaglioni · copertura fino a ${massima} km`}
          </span>
        </div>

        {/* Tabella */}
        {scaglioni.length === 0 ? (
          <div className="flex flex-col items-center gap-[10px] px-4 py-[42px] text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
              Nessuno scaglione configurato
            </h3>
            <p className="max-w-[420px] text-[13px] leading-[1.55] text-zinc-400 dark:text-zinc-500">
              Finché non definisci almeno uno scaglione, i rimborsi trasferta non possono essere calcolati.
              Inizia dalla soglia più bassa.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]" aria-label="Elenco scaglioni chilometrici">
            <thead>
              <tr>
                <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Fascia chilometrica
                </th>
                <th className="w-[160px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Soglia massima
                </th>
                <th className="w-[180px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Importo forfettario
                </th>
                <th className="w-[180px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let sogliaPrecedente = 0;
                return scaglioni.map((scaglione) => {
                  const sogliaMin = sogliaPrecedente === 0 ? 0 : sogliaPrecedente + 1;
                  const etichetta = etichettaFascia(sogliaMin, scaglione.finoAKm);
                  sogliaPrecedente = scaglione.finoAKm;

                  return (
                    <tr key={scaglione.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-[13px] align-middle">
                        <div className="flex items-center gap-[11px] min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-indigo-500 text-[11.5px] font-bold text-white">
                            {scaglione.finoAKm}
                          </div>
                          <div className="min-w-0 leading-[1.3]">
                            <b className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
                              {etichetta}
                            </b>
                            <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                              Rimborso forfettario di fascia
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-[13px] align-middle tabular-nums">
                        fino a {scaglione.finoAKm} km
                      </td>
                      <td className="px-4 py-[13px] text-right align-middle tabular-nums">
                        {formattaEuro(scaglione.importo)}
                      </td>
                      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
                        <a
                          href={`/anagrafiche/scaglioni/${scaglione.id}`}
                          className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                            <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                          </svg>
                          Modifica
                        </a>
                        <button
                          type="button"
                          onClick={() => apriModaleElimina(scaglione)}
                          className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                            <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                          </svg>
                          Elimina
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        )}
      </section>

      {/* Modale di conferma eliminazione */}
      <div
        className={`fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px] transition-opacity duration-[.18s] ${
          modaleAperta ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modale-titolo"
        onClick={(e) => {
          if (e.target === e.currentTarget) chiudiModale();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") chiudiModale();
        }}
      >
        <div
          className={`w-full max-w-[440px] rounded-[14px] border border-zinc-200 bg-white p-[22px] shadow-xl transition-transform duration-[.18s] dark:border-zinc-700 dark:bg-zinc-900 ${
            modaleAperta ? "scale-100 translate-y-0" : "scale-[.98] translate-y-2"
          }`}
        >
          <div className="mb-[13px] flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
              <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
            </svg>
          </div>
          <h3 id="modale-titolo" className="mb-[7px] text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
            {scaglioneDaEliminare
              ? `Eliminare lo scaglione «fino a ${scaglioneDaEliminare.finoAKm} km»?`
              : "Eliminare lo scaglione?"}
          </h3>
          <p className="mb-[18px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
            Lo scaglione verrà rimosso dalla configurazione. Le fasce successive si ricalcoleranno
            automaticamente partendo dalla soglia precedente rimasta. L&apos;operazione è definitiva.
          </p>
          <div className="flex justify-end gap-[9px]">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              onClick={chiudiModale}
            >
              Annulla
            </button>
            {scaglioneDaEliminare && (
              <form action={eliminaScaglione}>
                <input type="hidden" name="id" value={scaglioneDaEliminare.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-[.92]"
                  onClick={chiudiModale}
                >
                  Elimina scaglione
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
