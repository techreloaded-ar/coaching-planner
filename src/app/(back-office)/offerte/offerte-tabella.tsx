"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import type { VoceElencoOfferta } from "@/lib/offerte";
import {
  cambiaStatoOfferta,
  eliminaOfferta,
  type StatoEliminazioneOfferta,
} from "./actions";

const statoEliminazioneIniziale: StatoEliminazioneOfferta = {};

// ── Formattatori ────────────────────────────────────────────────

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatta un numero di giornate con al massimo un decimale, stile it-IT. */
function formattaGiornate(valore: number): string {
  return formattatoreGiornate.format(valore);
}

/** Iniziali della ragione sociale del cliente per l'avatar quadrato. */
function inizialiCliente(ragioneSociale: string): string {
  return ragioneSociale
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parola) => parola[0]?.toUpperCase() ?? "")
    .join("");
}

/** Un'offerta attiva è critica quando ha esaurito o superato il budget. */
function eCritica(offerta: VoceElencoOfferta): boolean {
  return offerta.attiva && offerta.residuo <= 0;
}

// ── Props ───────────────────────────────────────────────────────

interface OfferteTabellaProps {
  offerte: VoceElencoOfferta[];
}

// ── Componente ──────────────────────────────────────────────────

export default function OfferteTabella({ offerte }: OfferteTabellaProps) {
  const [filtro, setFiltro] = useState("");
  const [offertaDaEliminare, setOffertaDaEliminare] =
    useState<VoceElencoOfferta | null>(null);

  if (offerte.length === 0) {
    return <StatoVuoto />;
  }

  const filtroLower = filtro.trim().toLowerCase();
  const offerteFiltrate = offerte.filter(
    (offerta) =>
      !filtroLower ||
      offerta.clienteRagioneSociale.toLowerCase().includes(filtroLower) ||
      offerta.codice.toLowerCase().includes(filtroLower) ||
      offerta.descrizione.toLowerCase().includes(filtroLower),
  );

  const attive = offerteFiltrate.filter((o) => o.attiva).length;
  const nonAttive = offerteFiltrate.length - attive;
  const critiche = offerteFiltrate.filter(eCritica).length;

  return (
    <>
    <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Toolbar: ricerca + pill critiche + contatore riepilogo */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-[14px] dark:border-zinc-800">
        <label className="flex flex-1 items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 max-w-[360px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px] shrink-0" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.3-3.3" />
          </svg>
          <input
            type="search"
            placeholder="Cerca per cliente, codice o descrizione…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full border-0 bg-transparent font-[inherit] text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            aria-label="Cerca offerta"
          />
        </label>
        {critiche > 0 && (
          <span className="inline-flex items-center gap-[7px] rounded-full border border-red-200 bg-red-50 px-[12px] py-[5px] text-[12px] font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <span>
              <b className="tabular-nums">{critiche}</b> da presidiare
            </span>
          </span>
        )}
        <span className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
          {offerteFiltrate.length}{" "}
          {offerteFiltrate.length === 1 ? "offerta" : "offerte"} · {attive} attive ·{" "}
          {nonAttive} non attive
        </span>
      </div>

      {/* Tabella trasversale */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]" aria-label="Elenco offerte">
          <thead>
            <tr>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Offerta
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Cliente
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Tariffa giornaliera
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Giorni previsti
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Erogate
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Residuo
              </th>
              <th className="w-[120px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Stato
              </th>
              <th className="w-[220px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody>
            {offerteFiltrate.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-[34px] text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Nessuna offerta corrisponde alla ricerca.
                </td>
              </tr>
            ) : (
              offerteFiltrate.map((offerta) => (
                <RigaOfferta
                  key={offerta.offertaId}
                  offerta={offerta}
                  onElimina={() => setOffertaDaEliminare(offerta)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>

    <ModaleElimina
      offerta={offertaDaEliminare}
      onChiudi={() => setOffertaDaEliminare(null)}
    />
    </>
  );
}

// ── Riga ────────────────────────────────────────────────────────

function RigaOfferta({
  offerta,
  onElimina,
}: {
  offerta: VoceElencoOfferta;
  onElimina: () => void;
}) {
  const oltreBudget = offerta.residuo < 0;
  const esaurita = offerta.residuo === 0 && offerta.giorniPrevisti > 0;
  const critica = oltreBudget || esaurita;
  const percentuale =
    offerta.giorniPrevisti > 0
      ? Math.min((offerta.giornateErogate / offerta.giorniPrevisti) * 100, 100)
      : 0;

  const residuoTesto =
    (offerta.residuo < 0 ? "−" : "") + formattaGiornate(Math.abs(offerta.residuo));

  return (
    <tr
      className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
        !offerta.attiva ? "opacity-60" : ""
      }`}
    >
      {/* Offerta: badge codice + descrizione */}
      <td className="px-4 py-[13px] align-middle">
        <div className="flex min-w-0 flex-col gap-[5px] leading-[1.3]">
          <span className="inline-block w-fit rounded-[6px] border border-zinc-200 bg-white px-2 py-[2px] text-[11px] font-bold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {offerta.codice}
          </span>
          <span
            className="max-w-[340px] truncate text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100"
            title={offerta.descrizione}
          >
            {offerta.descrizione}
          </span>
        </div>
      </td>

      {/* Cliente */}
      <td className="px-4 py-[13px] align-middle">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300">
            {inizialiCliente(offerta.clienteRagioneSociale)}
          </span>
          <span
            className="truncate text-[13.5px] text-zinc-700 dark:text-zinc-200"
            title={offerta.clienteRagioneSociale}
          >
            {offerta.clienteRagioneSociale}
          </span>
        </div>
      </td>

      {/* Tariffa giornaliera */}
      <td className="px-4 py-[13px] text-right align-middle tabular-nums whitespace-nowrap font-semibold text-zinc-700 dark:text-zinc-200">
        {formattatoreEuro.format(Number(offerta.tariffaGiornaliera))}
      </td>

      {/* Giorni previsti */}
      <td className="px-4 py-[13px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-600 dark:text-zinc-300">
        {formattaGiornate(offerta.giorniPrevisti)}
        <span className="ml-[3px] text-[11.5px] text-zinc-400 dark:text-zinc-500">gg</span>
      </td>

      {/* Erogate + mini barra */}
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <div className="inline-flex flex-col items-end gap-[5px]">
          <span className="tabular-nums font-bold text-zinc-800 dark:text-zinc-100">
            {formattaGiornate(offerta.giornateErogate)}
            <span className="ml-[3px] text-[11.5px] font-semibold text-zinc-400 dark:text-zinc-500">
              gg
            </span>
          </span>
          <span
            className="relative h-[5px] w-[72px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700/50"
            role="img"
            aria-label={`Erogato ${Math.round(percentuale)}% del previsto`}
          >
            <span
              className={`absolute inset-y-0 left-0 rounded-full ${
                oltreBudget
                  ? "bg-[repeating-linear-gradient(45deg,theme(colors.red.500)_0_6px,theme(colors.red.700)_6px_12px)]"
                  : esaurita
                    ? "bg-red-500"
                    : "bg-indigo-500"
              }`}
              style={{ width: `${percentuale}%` }}
            />
          </span>
        </div>
      </td>

      {/* Residuo */}
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <div className="inline-flex flex-col items-end gap-[3px]">
          <span
            className={`tabular-nums font-bold ${
              critica ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {residuoTesto}
            <span className="ml-[3px] text-[11.5px] font-semibold opacity-70">gg</span>
          </span>
          {oltreBudget && (
            <span className="inline-flex items-center gap-[4px] text-[11px] font-bold text-red-600 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.2}>
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              Oltre budget
            </span>
          )}
          {esaurita && (
            <span className="inline-flex items-center gap-[4px] text-[11px] font-bold text-red-600 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              Esaurita
            </span>
          )}
        </div>
      </td>

      {/* Stato attiva/non attiva: interruttore + etichetta, coerente col mockup */}
      <td className="px-4 py-[13px] align-middle">
        <div className="flex items-center gap-[10px]">
          <form action={cambiaStatoOfferta} className="contents">
            <input type="hidden" name="id" value={offerta.offertaId} />
            <input type="hidden" name="attiva" value={offerta.attiva ? "false" : "true"} />
            <button
              type="submit"
              aria-label={offerta.attiva ? "Disattiva" : "Attiva"}
              aria-pressed={offerta.attiva}
              title={offerta.attiva ? "Disattiva offerta" : "Attiva offerta"}
              className={`relative inline-flex h-[21px] w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                offerta.attiva
                  ? "border-indigo-500 bg-indigo-500"
                  : "border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
              }`}
            >
              <span
                className={`absolute top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-150 ${
                  offerta.attiva ? "left-[17.5px]" : "left-[2.5px]"
                }`}
              />
            </button>
          </form>
          <span
            className={`text-[12.5px] font-semibold whitespace-nowrap ${
              offerta.attiva
                ? "text-zinc-600 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {offerta.attiva ? "Attiva" : "Non attiva"}
          </span>
        </div>
      </td>

      {/* Azioni: modifica, elimina */}
      <td className="px-4 py-[13px] text-right align-middle whitespace-nowrap">
        <div className="inline-flex items-center gap-[2px]">
          <Link
            href={`/offerte/${offerta.offertaId}`}
            className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
              <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
            </svg>
            Modifica
          </Link>

          <button
            type="button"
            onClick={onElimina}
            className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
              <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
            </svg>
            Elimina
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modale di eliminazione (due varianti) ──────────────────────

function ModaleElimina({
  offerta,
  onChiudi,
}: {
  offerta: VoceElencoOfferta | null;
  onChiudi: () => void;
}) {
  const [stato, azione] = useActionState(
    eliminaOfferta,
    statoEliminazioneIniziale,
  );

  const aperta = offerta !== null;
  const bloccata = offerta ? offerta.numeroRigheAttivita > 0 : false;
  const numeroRighe = offerta?.numeroRigheAttivita ?? 0;

  return (
    <div
      className={`fixed inset-0 z-[60] grid place-items-center bg-zinc-900/45 p-5 backdrop-blur-[3px] transition-opacity duration-[.18s] ${
        aperta ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modale-elimina-titolo"
      aria-hidden={!aperta}
      data-testid="modale-elimina-offerta"
      onClick={(e) => {
        if (e.target === e.currentTarget) onChiudi();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onChiudi();
      }}
    >
      <div
        className={`w-full max-w-[460px] rounded-[14px] border border-zinc-200 bg-white p-[22px] shadow-xl transition-transform duration-[.18s] dark:border-zinc-700 dark:bg-zinc-900 ${
          aperta ? "scale-100 translate-y-0" : "scale-[.98] translate-y-2"
        }`}
      >
        {offerta && (
          <>
            {/* Riquadro con l'offerta oggetto dell'azione */}
            <div className="mb-[18px] flex items-center gap-[11px] rounded-[11px] border border-zinc-200 bg-zinc-50 px-[13px] py-[10px] dark:border-zinc-700 dark:bg-zinc-800/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-zinc-200 bg-white text-[11px] font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300">
                {inizialiCliente(offerta.clienteRagioneSociale)}
              </span>
              <div className="min-w-0 leading-[1.35]">
                <span className="block text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
                  {offerta.codice}
                </span>
                <span
                  className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400"
                  title={`${offerta.clienteRagioneSociale} · ${offerta.descrizione}`}
                >
                  {offerta.clienteRagioneSociale} · {offerta.descrizione}
                </span>
              </div>
            </div>

            {bloccata ? (
              /* Variante bloccata: offerta con attività collegate */
              <>
                <div className="mb-[13px] flex h-10 w-10 items-center justify-center rounded-[12px] bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </div>
                <h3 id="modale-elimina-titolo" className="mb-[7px] text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
                  Non è possibile eliminare l&apos;offerta
                </h3>
                <p className="mb-[14px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
                  Questa offerta ha già delle attività registrate dai collaboratori:
                  eliminarla cancellerebbe dati di lavoro consuntivati. Per toglierla
                  dal lavoro in corso <b>disattivala</b> invece di eliminarla.
                </p>
                <div className="mb-[14px] flex items-start gap-[9px] rounded-[11px] border border-amber-200 bg-amber-50 px-[13px] py-[11px] text-[12.5px] leading-[1.5] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1px] h-[15px] w-[15px] shrink-0" strokeWidth={2}>
                    <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                    <path d="M8 13h8M8 17h5" />
                  </svg>
                  <span>
                    Blocco:{" "}
                    <b>
                      {numeroRighe}{" "}
                      {numeroRighe === 1
                        ? "riga di attività collegata"
                        : "righe di attività collegate"}
                    </b>
                    . Le attività vanno rimosse prima di poter eliminare l&apos;offerta.
                  </span>
                </div>
                {!offerta.attiva && (
                  <p className="mb-[14px] text-[13px] leading-[1.5] text-zinc-600 dark:text-zinc-400">
                    L&apos;offerta è già <b>non attiva</b>: non concorre più al lavoro
                    in corso.
                  </p>
                )}
                <div className="flex justify-end gap-[9px]">
                  <button
                    type="button"
                    onClick={onChiudi}
                    className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Chiudi
                  </button>
                  {offerta.attiva && (
                    <form action={cambiaStatoOfferta} onSubmit={onChiudi}>
                      <input type="hidden" name="id" value={offerta.offertaId} />
                      <input type="hidden" name="attiva" value="false" />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
                          <path d="M18.4 12A6.4 6.4 0 1 1 12 5.6M12 3v5l3.5-1" />
                        </svg>
                        Disattiva offerta
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              /* Variante conferma: offerta senza attività collegate */
              <>
                <div className="mb-[13px] flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
                    <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                  </svg>
                </div>
                <h3 id="modale-elimina-titolo" className="mb-[7px] text-[16.5px] font-bold text-zinc-800 dark:text-zinc-100">
                  Elimina questa offerta?
                </h3>
                <p className="mb-[18px] text-[13px] leading-[1.55] text-zinc-600 dark:text-zinc-400">
                  L&apos;offerta non ha righe di attività collegate e può essere
                  eliminata definitivamente. <b>L&apos;operazione non è reversibile.</b>
                </p>
                {stato.errore && (
                  <div className="mb-[14px] flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[11px] text-[12.5px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1px] h-[15px] w-[15px] shrink-0" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16h.01" />
                    </svg>
                    <span>{stato.errore}</span>
                  </div>
                )}
                <div className="flex justify-end gap-[9px]">
                  <button
                    type="button"
                    onClick={onChiudi}
                    className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Annulla
                  </button>
                  <form action={azione}>
                    <input type="hidden" name="id" value={offerta.offertaId} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-red-600 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-[.92]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
                        <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                      </svg>
                      Elimina offerta
                    </button>
                  </form>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Stato vuoto ─────────────────────────────────────────────────

function StatoVuoto() {
  return (
    <div className="rounded-[11px] border border-zinc-200 bg-white px-6 py-14 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
          <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        </svg>
      </div>
      <h3 className="mb-[7px] text-[16px] font-bold text-zinc-800 dark:text-zinc-100">
        Nessuna offerta presente
      </h3>
      <p className="mx-auto max-w-[440px] text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        Non risultano offerte per nessun cliente. Crea la prima offerta scegliendo
        il cliente e indicando codice, descrizione, tariffa giornaliera e giorni
        previsti.
      </p>
      <div className="mt-5">
        <Link
          href="/offerte/nuova"
          className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-[13.5px] font-semibold text-white no-underline shadow-sm transition hover:bg-indigo-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuova offerta
        </Link>
      </div>
    </div>
  );
}
