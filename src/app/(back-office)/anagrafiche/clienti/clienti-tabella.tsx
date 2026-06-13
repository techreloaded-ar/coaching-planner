"use client";

import { useState, useCallback } from "react";
import type { Cliente } from "@/generated/prisma/client";
import { cambiaStatoAction } from "./cambia-stato-action";

// ── Props ──────────────────────────────────────────────────────

interface ClientiTabellaProps {
  clienti: Cliente[];
}

// ── Componente ─────────────────────────────────────────────────

export default function ClientiTabella({ clienti }: ClientiTabellaProps) {
  const [filtro, setFiltro] = useState("");
  const [clienteDaDisattivare, setClienteDaDisattivare] = useState<string | null>(null);
  const [modaleAperta, setModaleAperta] = useState(false);

  const filtroLower = filtro.toLowerCase();
  const clientiFiltrati = clienti.filter(
    (c) =>
      !filtroLower ||
      c.ragioneSociale.toLowerCase().includes(filtroLower) ||
      (c.partitaIva ?? "").includes(filtroLower) ||
      (c.citta ?? "").toLowerCase().includes(filtroLower)
  );

  const attivi = clienti.filter((c) => c.attivo).length;
  const disattivati = clienti.length - attivi;

  const chiudiModale = useCallback(() => setModaleAperta(false), []);

  const apriModaleDisattiva = useCallback((id: string) => {
    setClienteDaDisattivare(id);
    setModaleAperta(true);
  }, []);

  return (
    <>
      <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
          <label className="flex flex-1 items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 max-w-[320px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px] shrink-0" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.3-3.3" />
            </svg>
            <input
              type="search"
              placeholder="Cerca per ragione sociale, P.IVA o città…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              aria-label="Cerca cliente"
            />
          </label>
          <span className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            {clienti.length} clienti · {attivi} attivi · {disattivati} disattivati
          </span>
        </div>

        {/* Tabella */}
        <table className="w-full border-collapse text-[13.5px]" aria-label="Elenco clienti">
          <thead>
            <tr>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Ragione sociale
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                P.IVA
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Città
              </th>
              <th className="w-[130px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Stato
              </th>
              <th className="w-[200px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                <span className="sr-only">Azioni</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clientiFiltrati.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-[34px] text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Nessun cliente corrisponde alla ricerca.
                </td>
              </tr>
            ) : (
              clientiFiltrati.map((cliente) => {
                const sede = [cliente.citta, cliente.provincia ? `(${cliente.provincia})` : ""]
                  .filter(Boolean)
                  .join(" ");
                const iniziali = cliente.ragioneSociale
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <tr
                    key={cliente.id}
                    className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      !cliente.attivo ? "text-zinc-400 dark:text-zinc-500" : ""
                    }`}
                  >
                    <td className="px-4 py-[13px] align-middle">
                      <a
                        href={`/anagrafiche/clienti/${cliente.id}`}
                        className="flex min-w-0 items-center gap-[11px] rounded-[10px] no-underline outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:hover:bg-zinc-800/40"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11.5px] font-bold text-white ${
                            cliente.attivo
                              ? "bg-indigo-500"
                              : "border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          }`}
                        >
                          {iniziali}
                        </div>
                        <div className="min-w-0 leading-[1.3]">
                          <b
                            className={`block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold ${
                              cliente.attivo
                                ? "text-zinc-800 dark:text-zinc-100"
                                : "text-zinc-400 line-through decoration-zinc-300/50 dark:text-zinc-500 dark:decoration-zinc-600/50"
                            }`}
                          >
                            {cliente.ragioneSociale}
                          </b>
                          <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                            {cliente.pec || cliente.codiceDestinatario
                              ? "Fatturazione elettronica configurata"
                              : "Dati fatturazione da completare"}
                          </span>
                        </div>
                      </a>
                    </td>
                    <td className="px-4 py-[13px] align-middle tabular-nums">{cliente.partitaIva ?? "—"}</td>
                    <td className="px-4 py-[13px] align-middle">{sede || "—"}</td>
                    <td className="px-4 py-[13px] align-middle">
                      {cliente.attivo ? (
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
                      <a
                        href={`/anagrafiche/clienti/${cliente.id}/modifica`}
                        className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                          <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                        </svg>
                        Modifica
                      </a>
                      {cliente.attivo ? (
                        <form action={cambiaStatoAction} className="inline">
                          <input type="hidden" name="id" value={cliente.id} />
                          <input type="hidden" name="attivo" value="false" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                              <circle cx="12" cy="12" r="8.6" /><path d="M6 6l12 12" />
                            </svg>
                            Disattiva
                          </button>
                        </form>
                      ) : (
                        <form action={cambiaStatoAction} className="inline">
                          <input type="hidden" name="id" value={cliente.id} />
                          <input type="hidden" name="attivo" value="true" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                              <path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" /><path d="M4.5 17.5V12H10" />
                            </svg>
                            Riattiva
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Modale di conferma disattivazione */}
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
              <path d="M18.4 5.6 5.6 18.4M5.6 5.6l12.8 12.8" /><circle cx="12" cy="12" r="9.2" />
            </svg>
          </div>
          <h3 id="modale-titolo" className="mb-[7px] text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
            Disattivare il cliente?
          </h3>
          <p className="mb-[18px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
            Il cliente non sarà più selezionabile per nuove attività e offerte. Lo storico di consuntivi e offerte esistenti resta invariato e potrai riattivarlo in qualsiasi momento.
          </p>
          <div className="flex justify-end gap-[9px]">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              onClick={chiudiModale}
            >
              Annulla
            </button>
            {clienteDaDisattivare && (
              <form action={cambiaStatoAction}>
                <input type="hidden" name="id" value={clienteDaDisattivare} />
                <input type="hidden" name="attivo" value="false" />
                <button
                  type="submit"
                  className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-[.92]"
                  onClick={chiudiModale}
                >
                  Disattiva cliente
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
