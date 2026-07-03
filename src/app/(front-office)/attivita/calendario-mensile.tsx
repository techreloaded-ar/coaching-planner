"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { SintesiGiorno } from "@/lib/attivita";

// ── Tipi client (dopo serializzazione RSC → Client) ─────────────

/** Cella giorno dopo serializzazione (Date → string) */
interface CellaGiornoClient {
  data: string;
  fuoriMese: boolean;
  isWeekend: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Formatta una data in YYYY-MM-DD. Supporta Date e stringa ISO. */
function formattaDataISO(data: Date | string): string {
  const d = typeof data === "string" ? new Date(data) : data;
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

/** Verifica se due date sono lo stesso giorno. Supporta stringhe ISO e Date. */
function stessoGiorno(a: Date | string, b: Date | string): boolean {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

interface CalendarioMensileProps {
  token: string;
  tokenPrecedente: string;
  tokenSuccessivo: string;
  etichetta: string;
  /** Griglia del mese (Date → string dopo serializzazione) */
  griglia: CellaGiornoClient[];
  /** Sintesi per giorno indicizzata per data YYYY-MM-DD */
  sintesi: Record<string, SintesiGiorno>;
  /** Data corrente in formato ISO string */
  oggi: string;
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

export default function CalendarioMensile({
  token,
  tokenPrecedente,
  tokenSuccessivo,
  etichetta,
  griglia,
  sintesi,
  oggi,
}: CalendarioMensileProps) {
  const oggiDate = new Date(oggi);

  // Totale mese
  const totaleRighe = useMemo(() => {
    let r = 0;
    for (const s of Object.values(sintesi)) r += s.righe;
    return r;
  }, [sintesi]);

  const totaleOre = useMemo(() => {
    let o = 0;
    for (const s of Object.values(sintesi)) o += s.oreTotali;
    return o;
  }, [sintesi]);

  // Giorni della settimana
  const giorniSettimana = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7">
      {/* ── Barra navigazione mese ── */}
      <div className="mb-[18px] flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/attivita?mese=${tokenPrecedente}`}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Mese precedente"
            title="Mese precedente"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[18px] w-[18px]"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>

          <div className="min-w-[188px] text-center text-[19px] font-bold capitalize -tracking-[0.02em] text-zinc-800 dark:text-zinc-100">
            {etichetta}
          </div>

          <Link
            href={`/attivita?mese=${tokenSuccessivo}`}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
            aria-label="Mese successivo"
            title="Mese successivo"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              className="h-[18px] w-[18px]"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/attivita"
            className="ml-1 inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
            Mese corrente
          </Link>

          <Link
            href={`/attivita/riepilogo?mese=${token}`}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            Riepilogo mese
          </Link>
        </div>

        <div className="flex-1" />

        {/* Riepilogo mese */}
        {totaleRighe > 0 && (
          <div className="inline-flex items-center gap-[9px] rounded-full border border-rose-200 bg-rose-50 px-[13px] py-1.5 text-[12.5px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[15px] w-[15px]"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <b className="tabular-nums">{totaleRighe} righe</b>
            <span className="block h-[13px] w-px bg-rose-200 dark:bg-rose-800" />
            <b className="tabular-nums">{totaleOre.toFixed(1)} h</b>
          </div>
        )}
      </div>

      {/* ── Griglia calendario ── */}
      <section
        className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Calendario mensile delle attività"
      >
        {/* Intestazione giorni settimana */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
          {giorniSettimana.map((nome, i) => (
            <div
              key={nome}
              className={`px-3 py-[11px] text-left text-[11px] font-bold uppercase tracking-[0.07em] ${
                i >= 5
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {nome}
            </div>
          ))}
        </div>

        {/* Corpo griglia */}
        <div className="grid grid-cols-7 auto-rows-[minmax(116px,auto)]">
          {griglia.map((cella, idx) => {
            const cellaData = new Date(cella.data);
            const key = formattaDataISO(cellaData);
            const haAttivita = key in sintesi;
            const isToday = stessoGiorno(cellaData, oggiDate);
            const isLastRow = idx >= griglia.length - 7;

            const classiGiorno = [
              "relative flex flex-col items-start gap-[7px] p-[9px_10px_10px] min-w-0 w-full transition-colors",
              (idx + 1) % 7 !== 0 ? "border-r border-zinc-100 dark:border-zinc-800" : "",
              !isLastRow ? "border-b border-zinc-100 dark:border-zinc-800" : "",
              cella.fuoriMese ? "bg-zinc-50 dark:bg-zinc-800/50" : "",
              !cella.fuoriMese && cella.isWeekend && !haAttivita
                ? "bg-zinc-50/45 dark:bg-zinc-800/30"
                : "",
              haAttivita
                ? "bg-rose-50 dark:bg-rose-950/40 cursor-pointer hover:bg-rose-100/70 dark:hover:bg-rose-950/60"
                : "",
              isToday
                ? "shadow-[inset_0_0_0_2px] shadow-rose-600 dark:shadow-rose-400"
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            const contenuto = (
              <>
                {haAttivita && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-rose-600 dark:bg-rose-400" />
                )}
                <span
                  className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums ${
                    cella.fuoriMese
                      ? "text-zinc-400/65 dark:text-zinc-500/65"
                      : isToday
                        ? "bg-rose-600 text-white dark:bg-rose-400 dark:text-white"
                        : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {cellaData.getDate()}
                </span>
                {haAttivita && (
                  <div className="mt-auto flex flex-col gap-[5px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-[7px] py-[3px] text-[11px] font-bold tabular-nums text-rose-800 dark:border-rose-800 dark:bg-zinc-800 dark:text-rose-300">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.4}
                          className="h-[11px] w-[11px]"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        {sintesi[key].righe}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-rose-600 px-[7px] py-[3px] text-[11px] font-bold tabular-nums text-white dark:bg-rose-400 dark:text-zinc-900">
                        {sintesi[key].oreTotali.toFixed(1)} h
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sintesi[key].codici.slice(0, 2).map((codice) => (
                        <span
                          key={codice}
                          className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-bold tracking-[0.02em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {codice}
                        </span>
                      ))}
                      {sintesi[key].codici.length > 2 && (
                        <span className="px-0.5 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                          +{sintesi[key].codici.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            );

            if (haAttivita) {
              return (
                <Link
                  key={key}
                  href={`/attivita/${key}?mese=${token}`}
                  className={classiGiorno}
                  style={{ textDecoration: "none" }}
                >
                  {contenuto}
                </Link>
              );
            }

            return (
              <div key={key} className={classiGiorno}>
                {contenuto}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Legenda ── */}
      <div className="mt-4 flex flex-wrap items-center gap-[14px]">
        <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="h-[11px] w-[11px] rounded-[4px] border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40" />
          Giorno con attività registrate
        </span>
        <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="h-[11px] w-[11px] rounded-[4px] bg-rose-600 dark:bg-rose-400" />
          Oggi
        </span>
        <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="h-[11px] w-[11px] rounded-[4px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800" />
          Nessuna attività
        </span>
        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          Clicca un giorno con attività per inserire o modificare le righe
        </span>
      </div>
    </div>
  );
}
