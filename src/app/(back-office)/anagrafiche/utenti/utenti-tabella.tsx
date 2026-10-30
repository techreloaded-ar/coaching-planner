"use client";

import { useMemo, useState } from "react";
import {
  BarraElencoSelezionabile,
  CasellaSelezione,
  CasellaSelezioneTutti,
  ChipStato,
  ElencoSelezionabile,
  useSelezioneElenco,
} from "@/components";
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

/** Testo del dialog di conferma: avvisi su accesso e profili collaboratore. */
function descriviDisattivazione(utenti: UtenteConProfiloCollaboratore[]) {
  const unico = utenti.length === 1;
  const conProfilo = utenti.some((utente) => utente.collaboratore !== null);
  return (
    <>
      L&apos;accesso sarà <b>revocato</b> e una sessione già aperta verrà bloccata al primo accesso successivo.
      {conProfilo && (
        <> {unico ? "Anche il profilo operativo verrà" : "Anche i profili operativi collegati verranno"} <b>disattivat{unico ? "o" : "i"}</b>.</>
      )}{" "}
      Potrai riattivarl{unico ? "o" : "i"} in qualsiasi momento; nessun dato viene eliminato.
    </>
  );
}

export default function UtentiTabella({ utenti }: UtentiTabellaProps) {
  const [filtro, setFiltro] = useState("");
  const filtroNormalizzato = filtro.trim().toLocaleLowerCase("it");
  // Memorizzato: un nuovo elenco filtrato azzera la selezione.
  const utentiFiltrati = useMemo(
    () =>
      utenti.filter((utente) =>
        `${utente.nome} ${utente.cognome} ${utente.email}`
          .toLocaleLowerCase("it")
          .includes(filtroNormalizzato)
      ),
    [utenti, filtroNormalizzato]
  );
  const attivi = utenti.filter((utente) => utente.attivo).length;

  return (
    <ElencoSelezionabile
      elementi={utentiFiltrati}
      idElemento={(utente) => utente.id}
      nomeElemento={(utente) => `${utente.nome} ${utente.cognome}`}
      nomi={{ singolare: "utente", plurale: "utenti" }}
      azioni={[{ tipo: "modifica", href: (utente) => `/anagrafiche/utenti/${utente.id}/modifica` }]}
      stato={{
        attivo: (utente) => utente.attivo,
        azione: cambiaStatoUtenteAction,
        descrizioneDisattivazione: descriviDisattivazione,
      }}
    >
    <section className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <BarraElencoSelezionabile>
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
      </BarraElencoSelezionabile>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]" aria-label="Elenco utenti">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <th className="w-[44px] border-b border-zinc-200 px-4 py-[11px] text-left dark:border-zinc-800">
                <CasellaSelezioneTutti />
              </th>
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
              utentiFiltrati.map((utente) => <RigaUtente key={utente.id} utente={utente} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
    </ElencoSelezionabile>
  );
}

function RigaUtente({ utente }: { utente: UtenteConProfiloCollaboratore }) {
  const { isSelezionato } = useSelezioneElenco();
  const haRuoloAmministratore = utente.ruolo === "AMMINISTRATORE";
  const haRuoloCollaboratore =
    utente.ruolo === "COLLABORATORE" ||
    utente.collaboratore !== null;
  const profiloCollaboratoreDisattivato =
    utente.collaboratore?.attivo === false;
  const nominativo = `${utente.nome} ${utente.cognome}`;

  return (
    <tr
      className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
        utente.attivo ? "" : "text-zinc-400 dark:text-zinc-500"
      } ${isSelezionato(utente.id) ? "bg-indigo-50/60 dark:bg-indigo-500/10" : ""}`}
    >
      <td className="border-b border-zinc-100 px-4 py-[13px] align-middle dark:border-zinc-800/60">
        <CasellaSelezione id={utente.id} nome={nominativo} />
      </td>
      <td className="border-b border-zinc-100 px-4 py-[13px] align-middle last:border-b-0 dark:border-zinc-800/60">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[13px] font-bold ${
              !utente.attivo
                ? "border border-dashed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                : haRuoloAmministratore
                  ? "bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-sm"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
            aria-hidden="true"
          >
            {iniziali(nominativo)}
            <span className="absolute -right-[3px] -bottom-[3px] grid h-[17px] w-[17px] place-items-center rounded-full border-2 border-white bg-white text-zinc-500 shadow-sm dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400">
              <IconaRuolo amministratore={haRuoloAmministratore} />
            </span>
          </span>
          <span className="min-w-0 leading-[1.3]">
            <b className={`block overflow-hidden text-ellipsis whitespace-nowrap font-semibold ${utente.attivo ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}>
              {nominativo}
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
        <div className="flex flex-wrap items-center gap-1.5">
          {haRuoloAmministratore && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[10px] py-1 text-[11.5px] font-bold border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              <IconaRuolo amministratore={true} />
              Amministratore
            </span>
          )}
          {haRuoloCollaboratore && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[10px] py-1 text-[11.5px] font-bold border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              <IconaRuolo amministratore={false} />
              Collaboratore
            </span>
          )}
        </div>
      </td>
      <td className="border-b border-zinc-100 px-4 py-[13px] align-middle dark:border-zinc-800/60">
        <ChipStato attivo={utente.attivo} />
      </td>
    </tr>
  );
}
