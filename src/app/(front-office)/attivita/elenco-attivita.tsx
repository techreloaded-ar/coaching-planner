"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
  parseTokenMese,
} from "@/domain/calendario";
import { ETICHETTA_OFFERTA_DA_DEFINIRE, ORE_PER_GIORNATA } from "@/domain/types";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";
import { eliminaRiga } from "@/lib/actions/righe-attivita";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import {
  AvvisoOffertaNonAbilitata,
  BadgeCategoriaAttivita,
  CLASSE_RIGA_OFFERTA_NON_ABILITATA,
  IconaOffertaNonAbilitata,
  PulsanteAttesa,
  SelettoreMese,
  useIdratata,
} from "@/components";
import {
  useCacheCalendario,
  useCacheGiornate,
  useCollaboratoreConsultato,
} from "./attivita-cache-provider";
import InterruttoreVista from "./interruttore-vista";
import {
  FILTRI_VUOTI,
  filtraRigheElenco,
  filtriEffettivi,
  opzioniClienti,
  opzioniOfferte,
  queryFiltri,
  segmentiNota,
  totaliElenco,
  urlElenco,
  type FiltriElenco,
} from "./filtri-elenco";
import { formattaGiornate, formattaNumeroOre } from "@/lib/formattazione";

interface ElencoAttivitaProps {
  /** Token YYYY-MM del mese mostrato. */
  token: string;
  /** Righe del mese, ordinate per giorno. */
  righe: RigaAttivitaClient[];
  /** Filtri letti dall'URL al rendering server. */
  filtriIniziali: FiltriElenco;
  /** Foglio di un collaboratore disattivato: nessuna azione sulle righe. */
  solaLettura: boolean;
  /** Nome del collaboratore il cui foglio è consultato da un amministratore, `null` sul proprio foglio. */
  nomeCollaboratoreConsultato: string | null;
}

function formattaEuro(importo: string): string {
  return `€ ${Number(importo).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function giornoDellaRiga(data: string): { giorno: string; settimana: string } {
  const [anno, mese, giorno] = data.split("-").map(Number);
  const date = new Date(anno, mese - 1, giorno);
  return {
    giorno: date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    settimana: date.toLocaleDateString("it-IT", { weekday: "long" }),
  };
}

/** Primo e ultimo giorno del mese (YYYY-MM-DD), limiti del selettore «Aggiungi». */
function estremiMese(token: string): { primo: string; ultimo: string } {
  const parsed = parseTokenMese(token);
  const giorni = parsed ? new Date(parsed.anno, parsed.mese, 0).getDate() : 28;
  return { primo: `${token}-01`, ultimo: `${token}-${String(giorni).padStart(2, "0")}` };
}

/** Oggi se cade nel mese mostrato, altrimenti il primo del mese. */
function giornoPredefinito(token: string): string {
  const oggi = new Date();
  const tokenOggi = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
  return tokenOggi === token
    ? `${tokenOggi}-${String(oggi.getDate()).padStart(2, "0")}`
    : `${token}-01`;
}

const CLASSE_PULSANTE =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 text-sm font-medium text-testo-metadati shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-200";
const CLASSE_CAMPO =
  "h-9 rounded-[10px] border border-zinc-200 bg-white px-3 text-sm text-testo-principale shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800";
const CLASSE_ETICHETTA = "text-xs font-medium text-testo-metadati";

export default function ElencoAttivita({ token, righe, filtriIniziali, solaLettura, nomeCollaboratoreConsultato }: ElencoAttivitaProps) {
  const router = useRouter();
  const idratata = useIdratata();
  const cacheCalendario = useCacheCalendario();
  const cacheGiornate = useCacheGiornate();
  const collaboratoreConsultatoId = useCollaboratoreConsultato();

  const [filtriScelti, setFiltriScelti] = useState(filtriIniziali);
  const [aggiuntaAperta, setAggiuntaAperta] = useState(false);
  const [giornoNuovaRiga, setGiornoNuovaRiga] = useState(() => giornoPredefinito(token));
  const [rigaInConferma, setRigaInConferma] = useState<string | null>(null);
  const [rigaInEliminazione, setRigaInEliminazione] = useState<string | null>(null);
  const [erroreEliminazione, setErroreEliminazione] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtri = useMemo(() => filtriEffettivi(righe, filtriScelti), [righe, filtriScelti]);
  const clienti = useMemo(() => opzioniClienti(righe), [righe]);
  const offerte = useMemo(() => opzioniOfferte(righe, filtri.cliente), [righe, filtri.cliente]);
  const righeVisibili = useMemo(() => filtraRigheElenco(righe, filtri), [righe, filtri]);
  const totaliVisibili = useMemo(() => totaliElenco(righeVisibili), [righeVisibili]);
  const totaliMese = useMemo(() => totaliElenco(righe), [righe]);
  const filtriAttivi = Boolean(filtri.cliente || filtri.offerta || filtri.nota.trim());

  const urlDiElenco = (mese: string | null) =>
    urlDelFoglio(urlElenco(mese, filtri), collaboratoreConsultatoId);

  /** Applica i filtri e li riscrive nell'URL, senza nuova voce di cronologia. */
  const aggiornaFiltri = (nuovi: FiltriElenco) => {
    setFiltriScelti(nuovi);
    setRigaInConferma(null);
    window.history.replaceState(
      null,
      "",
      urlDelFoglio(urlElenco(token, filtriEffettivi(righe, nuovi)), collaboratoreConsultatoId)
    );
  };

  /** URL della giornata aperta dall'Elenco: il ritorno riporta qui con i filtri. */
  const urlGiornata = (data: string, rigaDaModificare?: string) => {
    const parametri = new URLSearchParams({ mese: data.slice(0, 7) });
    if (rigaDaModificare) parametri.set("modifica", rigaDaModificare);
    parametri.set("elenco", queryFiltri(filtri));
    return urlDelFoglio(`/attivita/${data}?${parametri}`, collaboratoreConsultatoId);
  };

  const elimina = async (riga: RigaAttivitaClient) => {
    setRigaInEliminazione(riga.id);
    setErroreEliminazione(null);
    try {
      const esito = await eliminaRiga(riga.id, collaboratoreConsultatoId);
      if (!esito.success) {
        setErroreEliminazione(esito.error ?? "Eliminazione non riuscita.");
        return;
      }
      // Calendario e giornata della scheda non devono mostrare la riga eliminata.
      cacheCalendario?.invalidate(token);
      cacheGiornate?.invalidate(riga.data);
      setRigaInConferma(null);
      startTransition(() => router.refresh());
    } finally {
      setRigaInEliminazione(null);
    }
  };

  // L'abilitazione cambia il giallo di tutte le righe dell'offerta, in ogni
  // mese e giornata già in cache.
  const dopoAbilitazione = () => {
    cacheCalendario?.clear();
    cacheGiornate?.clear();
    startTransition(() => router.refresh());
  };

  const { primo, ultimo } = estremiMese(token);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7 max-md:px-4 max-md:py-5">
      {/* ── Barra navigazione mese ── */}
      {/* Su smartphone la barra segue il calendario: frecce e mese, poi
          «Mese corrente» e vista a sola icona con il riepilogo righe a destra.
          Il riepilogo del mese si apre dalla sidebar. */}
      <div className="mb-[18px] flex flex-wrap items-center gap-4 max-sm:gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 max-sm:contents">
          <Link href={urlDiElenco(mesePrecedente(token))} className={`${CLASSE_PULSANTE} w-9 px-0 max-sm:h-11 max-sm:w-11`} aria-label="Mese precedente" title="Mese precedente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>
          <div className="max-sm:basis-[calc(100%-6.75rem)]">
            <SelettoreMese tokenVisualizzato={token} onScegliMese={(scelto) => router.push(urlDiElenco(scelto))} />
          </div>
          <Link href={urlDiElenco(meseSuccessivo(token))} className={`${CLASSE_PULSANTE} w-9 px-0 max-sm:h-11 max-sm:w-11`} aria-label="Mese successivo" title="Mese successivo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-[18px] w-[18px]">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
          <Link href={urlDiElenco(null)} className={`${CLASSE_PULSANTE} ml-1 max-sm:ml-0 max-sm:h-11 max-sm:w-11 max-sm:justify-center max-sm:p-0`} title="Mese corrente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
            <span className="max-sm:sr-only">Mese corrente</span>
          </Link>
        </div>

        <div className="flex-1 max-sm:hidden" />

        <InterruttoreVista
          vista="elenco"
          hrefCalendario={urlDelFoglio(`/attivita?mese=${token}`, collaboratoreConsultatoId)}
          hrefElenco={urlDiElenco(token)}
        />

        {righe.length > 0 && (
          <div className="inline-flex items-center gap-[9px] max-sm:ml-auto rounded-full border border-rose-200 bg-rose-50 px-[13px] py-1.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <b className="tabular-nums">{righe.length} righe</b>
            <span className="block h-[13px] w-px bg-rose-200 dark:bg-rose-800" />
            <b className="tabular-nums">{formattaGiornate(totaliMese.ore / ORE_PER_GIORNATA)}</b>
          </div>
        )}
      </div>

      {/* ── Filtri e aggiunta ── */}
      <div className="relative mb-3 flex flex-wrap items-end gap-2.5">
        {righe.length > 0 && (
          <>
            <label className="flex w-[220px] flex-col gap-1 max-sm:w-full">
              <span className={CLASSE_ETICHETTA}>Cliente</span>
              <select
                className={`${CLASSE_CAMPO} w-full`}
                value={filtri.cliente}
                onChange={(e) => aggiornaFiltri({ ...filtri, cliente: e.target.value, offerta: "" })}
              >
                <option value="">Tutti i clienti</option>
                {clienti.map((o) => (
                  <option key={o.valore} value={o.valore}>{o.etichetta}</option>
                ))}
              </select>
            </label>
            <label className="flex w-[260px] flex-col gap-1 max-sm:w-full">
              <span className={CLASSE_ETICHETTA}>Offerta</span>
              <select
                className={`${CLASSE_CAMPO} w-full`}
                value={filtri.offerta}
                onChange={(e) => aggiornaFiltri({ ...filtri, offerta: e.target.value })}
              >
                <option value="">Tutte le offerte</option>
                {offerte.map((o) => (
                  <option key={o.valore} value={o.valore}>{o.etichetta}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
              <span className={CLASSE_ETICHETTA}>Cerca nella nota</span>
              <input
                type="search"
                className={CLASSE_CAMPO}
                placeholder="Testo della nota…"
                value={filtri.nota}
                onChange={(e) => aggiornaFiltri({ ...filtri, nota: e.target.value })}
              />
            </label>
            <button type="button" className={CLASSE_PULSANTE} disabled={!filtriAttivi} onClick={() => aggiornaFiltri(FILTRI_VUOTI)}>
              Azzera filtri
            </button>
          </>
        )}

        {!solaLettura && (
          <button
            type="button"
            aria-expanded={aggiuntaAperta}
            onClick={() => setAggiuntaAperta((aperta) => !aperta)}
            className="ml-auto inline-flex h-9 cursor-pointer items-center gap-[7px] rounded-[10px] bg-rose-600 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-4 w-4" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Aggiungi riga
          </button>
        )}

        {aggiuntaAperta && (
          <form
            aria-label="Giorno della nuova riga"
            onSubmit={(e) => {
              e.preventDefault();
              if (giornoNuovaRiga >= primo && giornoNuovaRiga <= ultimo) router.push(urlGiornata(giornoNuovaRiga));
            }}
            className="absolute right-0 top-full z-20 mt-2 w-[270px] rounded-[12px] border border-zinc-200 bg-white p-3.5 shadow-[0_12px_40px_rgba(24,24,27,0.16)] dark:border-zinc-700 dark:bg-zinc-900"
          >
            <label className="flex flex-col gap-1.5">
              <span className={CLASSE_ETICHETTA}>Giorno della nuova riga</span>
              <input
                type="date"
                required
                min={primo}
                max={ultimo}
                value={giornoNuovaRiga}
                onChange={(e) => setGiornoNuovaRiga(e.target.value)}
                className={CLASSE_CAMPO}
              />
            </label>
            <p className="mt-1.5 text-xs text-testo-metadati">
              Solo giorni di {etichettaMese(token)}
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button type="button" className={CLASSE_PULSANTE} onClick={() => setAggiuntaAperta(false)}>
                Annulla
              </button>
              <button type="submit" className="inline-flex h-9 cursor-pointer items-center rounded-[10px] bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700">
                Apri giornata
              </button>
            </div>
          </form>
        )}
      </div>

      {erroreEliminazione && (
        <div role="alert" className="mb-3 rounded-[11px] border border-amber-300 bg-amber-50 px-[13px] py-2.5 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
          {erroreEliminazione}
        </div>
      )}

      {/* ── Tabella ── */}
      <section aria-label="Elenco delle attività del mese" data-idratata={idratata ? "true" : "false"}>
        {righe.length === 0 ? (
          <div className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 p-[32px_20px] text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800/50">
            Nessuna attività registrata per questo mese.
          </div>
        ) : righeVisibili.length === 0 ? (
          <div className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 p-[32px_20px] text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800/50">
            Nessuna riga corrisponde ai filtri.{" "}
            <button type="button" className="cursor-pointer font-semibold text-rose-700 underline dark:text-rose-300" onClick={() => aggiornaFiltri(FILTRI_VUOTI)}>
              Azzera filtri
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                  {["Giorno", "Cliente", "Offerta", "Categoria", "Nota"].map((titolo) => (
                    <th key={titolo} className={`px-3.5 py-3 text-left ${CLASSE_ETICHETTA}`}>{titolo}</th>
                  ))}
                  <th className={`px-3.5 py-3 text-right ${CLASSE_ETICHETTA}`}>Ore</th>
                  <th className={`px-3.5 py-3 text-right ${CLASSE_ETICHETTA}`}>Rimborso</th>
                  {!solaLettura && <th className={`px-3.5 py-3 text-right ${CLASSE_ETICHETTA}`}>Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {righeVisibili.map((riga) => {
                  const { giorno, settimana } = giornoDellaRiga(riga.data);
                  const inConferma = rigaInConferma === riga.id;
                  const nonAbilitata = riga.offertaNonAbilitata && riga.offerta;
                  return (
                    <Fragment key={riga.id}>
                      <tr
                        data-testid="riga-elenco"
                        data-offerta-non-abilitata={nonAbilitata ? "true" : undefined}
                        className={`dark:border-zinc-800 ${nonAbilitata ? CLASSE_RIGA_OFFERTA_NON_ABILITATA : "border-b border-zinc-100"} ${inConferma ? "bg-rose-50 dark:bg-rose-950/40" : nonAbilitata ? "" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}
                      >
                        <td className="whitespace-nowrap px-3.5 py-3 align-top">
                          <span className="block font-semibold text-testo-principale">{giorno}</span>
                          <span className="block text-xs text-testo-metadati">{settimana}</span>
                        </td>
                        <td className="px-3.5 py-3 align-top font-semibold text-testo-principale">{riga.cliente.ragioneSociale}</td>
                        <td className="px-3.5 py-3 align-top">
                          {riga.offerta ? (
                            <>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                                  riga.offertaNonAbilitata
                                    ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "border-zinc-200 bg-zinc-50 text-testo-secondario dark:border-zinc-700 dark:bg-zinc-800"
                                }`}
                              >
                                {riga.offertaNonAbilitata && <IconaOffertaNonAbilitata className="h-[11px] w-[11px]" />}
                                {riga.offerta.codice}
                              </span>
                              <span className="mt-1 block text-xs text-testo-metadati">{riga.offerta.descrizione}</span>
                            </>
                          ) : (
                            <span className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {ETICHETTA_OFFERTA_DA_DEFINIRE}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 align-top"><BadgeCategoriaAttivita categoria={riga.categoria} /></td>
                        <td className="max-w-[280px] px-3.5 py-3 align-top text-testo-secondario">
                          {riga.nota
                            ? segmentiNota(riga.nota, filtri.nota).map((segmento, indice) =>
                                segmento.trovato ? (
                                  <mark key={indice} className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-700/60">{segmento.testo}</mark>
                                ) : (
                                  <span key={indice}>{segmento.testo}</span>
                                )
                              )
                            : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </td>
                        <td className="px-3.5 py-3 text-right align-top font-semibold tabular-nums text-testo-principale">{formattaNumeroOre(riga.ore)}</td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-right align-top tabular-nums text-testo-secondario">
                          {riga.rimborsoTrasfertaImporto ? formattaEuro(riga.rimborsoTrasfertaImporto) : "—"}
                        </td>
                        {!solaLettura && (
                          <td className="whitespace-nowrap px-3.5 py-2 text-right align-top">
                            {inConferma ? (
                              <span className="inline-flex items-center gap-2 text-sm font-medium text-rose-800 dark:text-rose-300">
                                Eliminare la riga?
                                <button type="button" className={`${CLASSE_PULSANTE} h-8`} onClick={() => setRigaInConferma(null)}>No</button>
                                <PulsanteAttesa
                                  type="button"
                                  attesaEsterna={rigaInEliminazione === riga.id}
                                  etichettaAttesa="Elimino…"
                                  onClick={() => void elimina(riga)}
                                  className="inline-flex h-8 cursor-pointer items-center rounded-[10px] bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                                >
                                  Elimina
                                </PulsanteAttesa>
                              </span>
                            ) : (
                              <span className="inline-flex gap-1">
                                <Link
                                  href={urlGiornata(riga.data, riga.id)}
                                  prefetch={false}
                                  aria-label={`Modifica riga del ${giorno}`}
                                  title="Modifica"
                                  className={`${CLASSE_PULSANTE} h-8 w-8 px-0`}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]" aria-hidden="true">
                                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                                  </svg>
                                </Link>
                                <button
                                  type="button"
                                  aria-label={`Elimina riga del ${giorno}`}
                                  title="Elimina"
                                  onClick={() => setRigaInConferma(riga.id)}
                                  className={`${CLASSE_PULSANTE} h-8 w-8 px-0 text-rose-600 dark:text-rose-400`}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]" aria-hidden="true">
                                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                      {nonAbilitata && (
                        <tr className={`border-b border-zinc-100 dark:border-zinc-800 ${CLASSE_RIGA_OFFERTA_NON_ABILITATA}`}>
                          <td colSpan={solaLettura ? 7 : 8} className="border-t border-dashed border-amber-300 px-3.5 py-2 dark:border-amber-700">
                            <AvvisoOffertaNonAbilitata
                              codiceOfferta={nonAbilitata.codice}
                              nomeCollaboratore={nomeCollaboratoreConsultato}
                              abilitazione={
                                collaboratoreConsultatoId && !solaLettura && nonAbilitata.attiva
                                  ? { collaboratoreId: collaboratoreConsultatoId, offertaId: nonAbilitata.id, onAbilitata: dopoAbilitazione }
                                  : null
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 font-semibold dark:bg-zinc-800/80">
                  <td colSpan={5} data-testid="totale-elenco" className="px-3.5 py-3 text-sm text-testo-metadati">
                    {righeVisibili.length} righe su {righe.length}
                    {filtriAttivi && " · totale filtrato"}
                  </td>
                  <td data-testid="totale-ore-elenco" className="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-testo-principale">{formattaNumeroOre(totaliVisibili.ore)} h</td>
                  <td data-testid="totale-rimborsi-elenco" className="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-testo-principale">{formattaEuro(totaliVisibili.rimborsi)}</td>
                  {!solaLettura && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
