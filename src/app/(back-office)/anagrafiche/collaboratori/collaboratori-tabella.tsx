"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CollaboratoreConUtente } from "@/lib/collaboratori";
import { formattaEuro } from "@/lib/formattazione";
import { cambiaStatoAction } from "./cambia-stato-action";

// ── Props ──────────────────────────────────────────────────────

type CollaboratoreVista = Omit<CollaboratoreConUtente, "tariffaGiornaliera"> & {
  tariffaGiornaliera: string;
};

interface CollaboratoriTabellaProps {
  collaboratori: CollaboratoreVista[];
}

// ── Componente ─────────────────────────────────────────────────

export default function CollaboratoriTabella({ collaboratori }: CollaboratoriTabellaProps) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [collaboratoreDaDisattivare, setCollaboratoreDaDisattivare] = useState<CollaboratoreVista | null>(null);
  const [modaleAperta, setModaleAperta] = useState(false);

  const filtroLower = filtro.toLowerCase();
  const collaboratoriFiltrati = collaboratori.filter((c) => {
    if (!filtroLower) return true;
    const nomeCompleto = `${c.nome} ${c.cognome}`.toLowerCase();
    return (
      nomeCompleto.includes(filtroLower) ||
      c.utente.email.toLowerCase().includes(filtroLower) ||
      c.partitaIva.includes(filtroLower)
    );
  });

  const attivi = collaboratori.filter((c) => c.attivo).length;
  const disattivati = collaboratori.length - attivi;

  const chiudiModale = useCallback(() => setModaleAperta(false), []);

  const apriModaleDisattiva = useCallback((collaboratore: CollaboratoreVista) => {
    setCollaboratoreDaDisattivare(collaboratore);
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
              placeholder="Cerca per nome, email o P.IVA…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              aria-label="Cerca collaboratore"
            />
          </label>
          <span className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            {collaboratori.length} collaboratori · {attivi} attivi · {disattivati} disattivati
          </span>
        </div>

        {/* Tabella */}
        <table className="w-full border-collapse text-[13.5px]" aria-label="Elenco collaboratori">
          <thead>
            <tr>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Collaboratore
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Email di accesso
              </th>
              <th className="w-[140px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                P.IVA
              </th>
              <th className="w-[170px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Tariffa giornaliera
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
            {collaboratoriFiltrati.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-[34px] text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Nessun collaboratore corrisponde alla ricerca.
                </td>
              </tr>
            ) : (
              collaboratoriFiltrati.map((collaboratore) => {
                const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;
                const iniziali = `${collaboratore.nome[0] ?? ""}${collaboratore.cognome[0] ?? ""}`.toUpperCase();

                return (
                  <tr
                    key={collaboratore.id}
                    onClick={() => router.push(`/anagrafiche/collaboratori/${collaboratore.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      !collaboratore.attivo ? "text-zinc-400 dark:text-zinc-500" : ""
                    }`}
                  >
                    <td className="px-4 py-[13px] align-middle">
                      <div className="flex items-center gap-[11px] min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11.5px] font-bold text-white ${
                            collaboratore.attivo
                              ? "bg-indigo-500"
                              : "border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          }`}
                        >
                          {iniziali}
                        </div>
                        <div className="min-w-0 leading-[1.3]">
                          <Link
                            href={`/anagrafiche/collaboratori/${collaboratore.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold no-underline ${
                              collaboratore.attivo
                                ? "text-zinc-800 dark:text-zinc-100"
                                : "text-zinc-400 line-through decoration-zinc-300/50 dark:text-zinc-500 dark:decoration-zinc-600/50"
                            }`}
                          >
                            {nomeCompleto}
                          </Link>
                          <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                            {collaboratore.attivo ? "Accesso Google attivo" : "Accesso revocato"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-[13px] align-middle">
                      <span className="inline-flex items-center gap-[7px]" title={collaboratore.utente.email}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] shrink-0 text-zinc-400 dark:text-zinc-500" strokeWidth={2}>
                          <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                        </svg>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{collaboratore.utente.email}</span>
                      </span>
                    </td>
                    <td className="px-4 py-[13px] align-middle tabular-nums">{collaboratore.partitaIva}</td>
                    <td className="px-4 py-[13px] text-right align-middle tabular-nums">
                      {formattaEuro(collaboratore.tariffaGiornaliera)}
                    </td>
                    <td className="px-4 py-[13px] align-middle">
                      {collaboratore.attivo ? (
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
                    <td
                      className="px-4 py-[13px] text-right align-middle whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        href={`/anagrafiche/collaboratori/${collaboratore.id}/modifica`}
                        className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                          <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                        </svg>
                        Modifica
                      </a>
                      {collaboratore.attivo ? (
                        <button
                          type="button"
                          onClick={() => apriModaleDisattiva(collaboratore)}
                          className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                            <circle cx="12" cy="12" r="8.6" /><path d="M6 6l12 12" />
                          </svg>
                          Disattiva
                        </button>
                      ) : (
                        <form action={cambiaStatoAction} className="inline">
                          <input type="hidden" name="id" value={collaboratore.id} />
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
            {collaboratoreDaDisattivare
              ? `Disattivare «${collaboratoreDaDisattivare.nome} ${collaboratoreDaDisattivare.cognome}»?`
              : "Disattivare il collaboratore?"}
          </h3>
          <p className="mb-[18px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
            L&apos;accesso al front office sarà <b>revocato</b>: il collaboratore non potrà più effettuare il login
            con il proprio account Google. Lo <b>storico delle sue attività resta conservato</b> e valorizzato con
            le tariffe applicate. Potrai riattivarlo in qualsiasi momento.
          </p>
          <div className="flex justify-end gap-[9px]">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              onClick={chiudiModale}
            >
              Annulla
            </button>
            {collaboratoreDaDisattivare && (
              <form action={cambiaStatoAction}>
                <input type="hidden" name="id" value={collaboratoreDaDisattivare.id} />
                <input type="hidden" name="attivo" value="false" />
                <button
                  type="submit"
                  className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-[.92]"
                  onClick={chiudiModale}
                >
                  Disattiva collaboratore
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
