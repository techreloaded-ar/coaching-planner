"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { UtenteConProfiloCollaboratore } from "@/lib/utenti";
import { cambiaStatoUtenteAction } from "./cambia-stato-utente-action";

interface UtentiTabellaProps {
  utenti: UtenteConProfiloCollaboratore[];
}

function iniziali(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function IconaRuolo({ amministratore }: { amministratore: boolean }) {
  return amministratore ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3" strokeWidth={2.2} aria-hidden="true">
      <path d="M12 3l7 2.5v5.2c0 4.3-2.9 7.4-7 8.8-4.1-1.4-7-4.5-7-8.8V5.5L12 3Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3" strokeWidth={2.2} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.3" />
      <path d="M6 19a6 6 0 0 1 12 0" />
    </svg>
  );
}

export default function UtentiTabella({ utenti }: UtentiTabellaProps) {
  const [filtro, setFiltro] = useState("");
  const [utenteDaInvalidare, setUtenteDaInvalidare] =
    useState<UtenteConProfiloCollaboratore | null>(null);
  const [modaleAperta, setModaleAperta] = useState(false);
  const filtroNormalizzato = filtro.trim().toLocaleLowerCase("it");
  const utentiFiltrati = utenti.filter((utente) =>
    `${utente.nome} ${utente.email}`
      .toLocaleLowerCase("it")
      .includes(filtroNormalizzato)
  );
  const attivi = utenti.filter((utente) => utente.attivo).length;

  const chiudiModale = useCallback(() => setModaleAperta(false), []);

  const apriModaleInvalidazione = useCallback(
    (utente: UtenteConProfiloCollaboratore) => {
      setUtenteDaInvalidare(utente);
      setModaleAperta(true);
    },
    []
  );

  return (
    <>
    <section className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
        <label className="flex max-w-[340px] flex-1 items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-400 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-3 focus-within:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:bg-zinc-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.3-3.3" />
          </svg>
          <input
            type="search"
            placeholder="Cerca per nome o email…"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            aria-label="Cerca utente"
          />
        </label>
        <p className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
          <b className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{utenti.length}</b> utenti
          <span className="mx-2" aria-hidden="true">·</span>
          <b className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{attivi}</b> attivi
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]" aria-label="Elenco utenti">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <th className="whitespace-nowrap border-b border-zinc-200 px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                Nome
              </th>
              <th className="whitespace-nowrap border-b border-zinc-200 px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                Email
              </th>
              <th className="w-[180px] whitespace-nowrap border-b border-zinc-200 px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                Ruolo
              </th>
              <th className="w-[150px] whitespace-nowrap border-b border-zinc-200 px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                Stato
              </th>
              <th className="w-[120px] border-b border-zinc-200 px-4 py-[11px] dark:border-zinc-800">
                <span className="sr-only">Azioni</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {utentiFiltrati.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-[34px] text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Nessun utente corrisponde alla ricerca.
                </td>
              </tr>
            ) : (
              utentiFiltrati.map((utente) => {
                const amministratore = utente.ruolo === "AMMINISTRATORE";
                const profiloCollaboratoreDisattivato =
                  utente.collaboratore?.attivo === false;

                return (
                  <tr
                    key={utente.id}
                    className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      utente.attivo ? "" : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    <td className="border-b border-zinc-100 px-4 py-[13px] align-middle last:border-b-0 dark:border-zinc-800/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[13px] font-bold ${
                            !utente.attivo
                              ? "border border-dashed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                              : amministratore
                                ? "bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-sm"
                                : "border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                          aria-hidden="true"
                        >
                          {iniziali(utente.nome)}
                          <span className="absolute -right-[3px] -bottom-[3px] grid h-[17px] w-[17px] place-items-center rounded-full border-2 border-white bg-white text-zinc-500 shadow-sm dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400">
                            <IconaRuolo amministratore={amministratore} />
                          </span>
                        </span>
                        <span className="min-w-0 leading-[1.3]">
                          <b className={`block overflow-hidden text-ellipsis whitespace-nowrap font-semibold ${utente.attivo ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}>
                            {utente.nome}
                          </b>
                          {profiloCollaboratoreDisattivato && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[11px] w-[11px] shrink-0" strokeWidth={2} aria-hidden="true">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M8 12h8" />
                              </svg>
                              Profilo collaboratore disattivato
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-[13px] align-middle dark:border-zinc-800/60">
                      <span className="inline-flex min-w-0 items-center gap-[7px] text-zinc-600 dark:text-zinc-400" title={utente.email}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] shrink-0 text-zinc-400 dark:text-zinc-500" strokeWidth={2} aria-hidden="true">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m3 7 9 6 9-6" />
                        </svg>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{utente.email}</span>
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-[13px] align-middle dark:border-zinc-800/60">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[10px] py-1 text-[11.5px] font-bold ${
                          amministratore
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <IconaRuolo amministratore={amministratore} />
                        {amministratore ? "Amministratore" : "Collaboratore"}
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-[13px] align-middle dark:border-zinc-800/60">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[11px] py-1 text-[11.5px] font-semibold ${
                          utente.attivo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                        {utente.attivo ? "Attivo" : "Invalidato"}
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-[13px] text-right align-middle whitespace-nowrap dark:border-zinc-800/60">
                      <Link
                        href={`/anagrafiche/utenti/${utente.id}/modifica`}
                        className="inline-flex items-center gap-[5px] rounded-lg px-[9px] py-[5px] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
                          <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                        </svg>
                        Modifica
                      </Link>
                      {utente.attivo ? (
                        <button
                          type="button"
                          onClick={() => apriModaleInvalidazione(utente)}
                          className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
                            <circle cx="12" cy="12" r="8.6" /><path d="M6 6l12 12" />
                          </svg>
                          Invalida
                        </button>
                      ) : (
                        <form action={cambiaStatoUtenteAction} className="inline">
                          <input type="hidden" name="id" value={utente.id} />
                          <input type="hidden" name="attivo" value="true" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-[5px] rounded-[8px] border-0 bg-transparent px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden="true">
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
      </div>
    </section>

      <div
        className={`fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px] transition-opacity duration-[.18s] ${
          modaleAperta ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modale-titolo"
        onClick={(event) => {
          if (event.target === event.currentTarget) chiudiModale();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") chiudiModale();
        }}
      >
        <div
          className={`w-full max-w-[440px] rounded-[14px] border border-zinc-200 bg-white p-[22px] shadow-xl transition-transform duration-[.18s] dark:border-zinc-700 dark:bg-zinc-900 ${
            modaleAperta ? "scale-100 translate-y-0" : "scale-[.98] translate-y-2"
          }`}
        >
          <div className="mb-[13px] flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2} aria-hidden="true">
              <path d="M18.4 5.6 5.6 18.4M5.6 5.6l12.8 12.8" /><circle cx="12" cy="12" r="9.2" />
            </svg>
          </div>
          <h3 id="modale-titolo" className="mb-[7px] text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
            {utenteDaInvalidare
              ? `Invalidare «${utenteDaInvalidare.nome}»?`
              : "Invalidare l'utente?"}
          </h3>
          <p className="mb-[18px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
            L&apos;accesso sarà <b>revocato</b> e una sessione già aperta verrà bloccata al primo accesso successivo.
            {utenteDaInvalidare !== null && utenteDaInvalidare.collaboratore !== null && (
              <> Anche il profilo operativo verrà <b>disattivato</b>.</>
            )} Potrai riattivarlo in qualsiasi momento; nessun dato viene eliminato.
          </p>
          <div className="flex justify-end gap-[9px]">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              onClick={chiudiModale}
            >
              Annulla
            </button>
            {utenteDaInvalidare && (
              <form action={cambiaStatoUtenteAction}>
                <input type="hidden" name="id" value={utenteDaInvalidare.id} />
                <input type="hidden" name="attivo" value="false" />
                <button
                  type="submit"
                  className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-[.92]"
                  onClick={chiudiModale}
                >
                  Invalida utente
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
