"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creaRiga,
  modificaRiga,
  eliminaRiga,
  fetchOffertePerCliente,
} from "@/lib/actions/righe-attivita";
import type { RigaAttivitaClient, ClienteSelect } from "./page";

// ── Tipi ────────────────────────────────────────────────────────

interface OffertaSelect {
  id: string;
  codice: string;
  descrizione: string;
}

interface DettaglioGiornataProps {
  /** Data in formato YYYY-MM-DD */
  data: string;
  /** Righe già registrate per la giornata */
  righeIniziali: RigaAttivitaClient[];
  /** Clienti attivi per la select */
  clienti: ClienteSelect[];
  /** Token mese YYYY-MM per il link di ritorno (null se non disponibile) */
  meseToken: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────

function nomeGiorno(dataStr: string): string {
  const [a, m, g] = dataStr.split("-").map(Number);
  return new Date(a, m - 1, g).toLocaleDateString("it-IT", {
    weekday: "long",
  });
}

function dataEstesa(dataStr: string): string {
  const [a, m, g] = dataStr.split("-").map(Number);
  return new Date(a, m - 1, g).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Validazione locale rapida per feedback inline */
function validaOreLocale(input: string): string | null {
  const normalizzato = input.trim().replace(",", ".");
  if (normalizzato === "") return "Inserisci un valore";
  if (isNaN(Number(normalizzato))) return "Valore non valido";
  if (Number(normalizzato) <= 0) return "Inserisci un numero maggiore di zero";
  if (Number(normalizzato) > 24) return "Non può superare 24 ore";
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

export default function DettaglioGiornata({
  data,
  righeIniziali,
  clienti,
  meseToken,
}: DettaglioGiornataProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Stato righe ────────────────────────────────────────────
  const [righe, setRighe] = useState<RigaAttivitaClient[]>(righeIniziali);

  // ── Stato form ─────────────────────────────────────────────
  const [clienteId, setClienteId] = useState("");
  const [offertaId, setOffertaId] = useState("");
  const [ore, setOre] = useState("");
  const [erroreOre, setErroreOre] = useState<string | null>(null);
  const [fatturabile, setFatturabile] = useState(true);
  const [nota, setNota] = useState("");
  const [erroreSubmit, setErroreSubmit] = useState<string | null>(null);

  // Modalità modifica
  const [modificaId, setModificaId] = useState<string | null>(null);

  // Cascade select: offerte del cliente selezionato
  const [offerte, setOfferte] = useState<OffertaSelect[]>([]);
  const [offerteLoading, setOfferteLoading] = useState(false);

  // ── Riepilogo ──────────────────────────────────────────────

  const riepilogo = useMemo(() => {
    const nRighe = righe.length;
    const oreTotali = righe.reduce((s, r) => s + r.ore, 0);
    const oreFatturabili = righe
      .filter((r) => r.fatturabile)
      .reduce((s, r) => s + r.ore, 0);
    return { nRighe, oreTotali, oreFatturabili };
  }, [righe]);

  // ── Cascade select cliente → offerte ───────────────────────

  const handleCambioCliente = useCallback(
    async (nuovoClienteId: string) => {
      setClienteId(nuovoClienteId);
      setOffertaId("");
      setOfferte([]);

      if (!nuovoClienteId) return;

      setOfferteLoading(true);
      try {
        const result = await fetchOffertePerCliente(nuovoClienteId);
        if (result.success && result.data) {
          setOfferte(result.data);
        }
      } catch {
        // ignora
      } finally {
        setOfferteLoading(false);
      }
    },
    []
  );

  // ── Validazione ore inline ─────────────────────────────────

  const handleCambioOre = useCallback((valore: string) => {
    setOre(valore);
    if (valore.trim() === "") {
      setErroreOre(null);
      return;
    }
    const err = validaOreLocale(valore);
    setErroreOre(err);
  }, []);

  // ── Submit form ────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErroreSubmit(null);

      if (!clienteId || !offertaId || !ore) {
        setErroreSubmit("Compila tutti i campi obbligatori");
        return;
      }

      // Validazione ore server-side
      const err = validaOreLocale(ore);
      if (err) {
        setErroreOre(err);
        return;
      }

      const fd = new FormData();
      fd.append("clienteId", clienteId);
      fd.append("offertaId", offertaId);
      fd.append("ore", ore.replace(",", "."));
      fd.append("data", data);
      if (nota) fd.append("nota", nota);
      if (fatturabile) fd.append("fatturabile", "on");

      if (modificaId) {
        fd.append("rigaId", modificaId);
        const result = await modificaRiga(fd);
        if (!result.success) {
          setErroreSubmit(result.error ?? "Errore nella modifica");
          return;
        }
      } else {
        const result = await creaRiga(fd);
        if (!result.success) {
          setErroreSubmit(result.error ?? "Errore nella creazione");
          return;
        }
      }

      // Refresh della pagina per aggiornare dati server
      startTransition(() => {
        router.refresh();
      });

      // Reset form
      setClienteId("");
      setOffertaId("");
      setOre("");
      setErroreOre(null);
      setFatturabile(true);
      setNota("");
      setModificaId(null);
      setOfferte([]);
      setErroreSubmit(null);
    },
    [clienteId, offertaId, ore, nota, fatturabile, data, modificaId, router]
  );

  // ── Modifica riga ──────────────────────────────────────────

  const handleModifica = useCallback(
    async (riga: RigaAttivitaClient) => {
      setModificaId(riga.id);
      setClienteId(riga.cliente.id);
      setFatturabile(riga.fatturabile);
      setOre(riga.ore.toString().replace(".", ","));
      setNota(riga.nota ?? "");
      setErroreOre(null);
      setErroreSubmit(null);

      // Carica le offerte di quel cliente
      setOfferteLoading(true);
      try {
        const result = await fetchOffertePerCliente(riga.cliente.id);
        if (result.success && result.data) {
          setOfferte(result.data);
          setOffertaId(riga.offerta.id);
        }
      } catch {
        // ignora
      } finally {
        setOfferteLoading(false);
      }

      // Scroll al form
      document.getElementById("form-riga")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    []
  );

  // ── Annulla modifica ───────────────────────────────────────

  const handleAnnulla = useCallback(() => {
    setModificaId(null);
    setClienteId("");
    setOffertaId("");
    setOre("");
    setErroreOre(null);
    setFatturabile(true);
    setNota("");
    setOfferte([]);
    setErroreSubmit(null);
  }, []);

  // ── Elimina riga ───────────────────────────────────────────

  const handleElimina = useCallback(
    async (rigaId: string) => {
      if (!confirm("Eliminare questa riga attività?")) return;

      const result = await eliminaRiga(rigaId);
      if (result.success) {
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [router]
  );

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-7">
      {/* ── Intestazione giornata ── */}
      <div className="mb-7">
        <div className="text-xs font-semibold capitalize text-rose-800 dark:text-rose-300">
          {nomeGiorno(data)}
        </div>
        <h1 className="mt-0.5 text-2xl font-bold capitalize text-zinc-800 dark:text-zinc-100">
          {dataEstesa(data)}
        </h1>
      </div>

      {/* ── Riepilogo dinamico ── */}
      <div className="mb-7 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
            Righe registrate
          </div>
          <div className="mt-0.5 text-[22px] font-bold tabular-nums text-rose-800 dark:text-rose-300">
            {riepilogo.nRighe}
          </div>
        </div>
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
            Ore totali
          </div>
          <div className="mt-0.5 text-[22px] font-bold tabular-nums text-rose-800 dark:text-rose-300">
            {riepilogo.oreTotali.toFixed(1)} h
          </div>
        </div>
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
            Ore fatturabili
          </div>
          <div className="mt-0.5 text-[22px] font-bold tabular-nums text-rose-800 dark:text-rose-300">
            {riepilogo.oreFatturabili.toFixed(1)} h
          </div>
        </div>
      </div>

      {/* ── Lista righe registrate ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400 dark:text-zinc-500">
          Attività della giornata
        </h2>

        {righe.length === 0 ? (
          <div className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 p-[28px_20px] text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="mx-auto mb-2.5 h-[32px] w-[32px] opacity-40"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Nessuna attività registrata per questa giornata.
            <br />
            Usa il form qui sotto per aggiungerne una.
          </div>
        ) : (
          <div className="space-y-2.5">
            {righe.map((riga) => (
              <div
                key={riga.id}
                className="rounded-[11px] border border-zinc-200 bg-white p-[13px_15px] transition-shadow hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">
                      {riga.cliente.ragioneSociale}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.02em] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                        {riga.offerta.codice}
                      </span>
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.02em] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                        {riga.offerta.descrizione}
                      </span>
                    </div>
                    {riga.nota && (
                      <div className="mt-[7px] text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {riga.nota}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-none items-center gap-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-[9px] py-[3px] text-[10px] font-bold ${
                        riga.fatturabile
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {riga.fatturabile ? "Fatt." : "Non fatt."}
                    </span>
                    <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-rose-800 dark:text-rose-300">
                      {riga.ore.toFixed(1)} h
                    </span>
                  </div>
                </div>

                {/* Pulsanti azione */}
                <div className="mt-[10px] flex items-center gap-2 border-t border-zinc-100 pt-[10px] dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => handleModifica(riga)}
                    className="inline-flex items-center gap-[5px] rounded-[8px] border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-[13px] w-[13px]"
                    >
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => handleElimina(riga.id)}
                    className="inline-flex items-center gap-[5px] rounded-[8px] border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-[13px] w-[13px]"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Form aggiunta / modifica ── */}
      <section
        id="form-riga"
        className="rounded-[11px] border border-zinc-200 bg-white p-[18px_20px_22px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-[15px] text-[13px] font-bold uppercase tracking-[0.04em] text-zinc-500 dark:text-zinc-400">
          {modificaId ? "Modifica riga" : "Nuova riga attività"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-[15px]">
          {/* Cliente */}
          <div>
            <label
              htmlFor="cliente"
              className="mb-[5px] block text-[12px] font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Cliente <span className="text-rose-600">*</span>
            </label>
            <select
              id="cliente"
              value={clienteId}
              onChange={(e) => handleCambioCliente(e.target.value)}
              className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-[13.5px] text-zinc-800 shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="">Seleziona un cliente</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ragioneSociale}
                </option>
              ))}
            </select>
          </div>

          {/* Offerta */}
          <div>
            <label
              htmlFor="offerta"
              className="mb-[5px] block text-[12px] font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Offerta <span className="text-rose-600">*</span>
            </label>
            <select
              id="offerta"
              value={offertaId}
              onChange={(e) => setOffertaId(e.target.value)}
              disabled={!clienteId || offerteLoading}
              className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-[13.5px] text-zinc-800 shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:disabled:bg-zinc-800/50"
            >
              <option value="">
                {offerteLoading
                  ? "Caricamento offerte..."
                  : !clienteId
                    ? "Seleziona prima un cliente"
                    : offerte.length === 0
                      ? "Nessuna offerta attiva"
                      : "Seleziona un'offerta"}
              </option>
              {offerte.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codice} — {o.descrizione}
                </option>
              ))}
            </select>
          </div>

          {/* Ore */}
          <div>
            <label
              htmlFor="ore"
              className="mb-[5px] block text-[12px] font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Ore <span className="text-rose-600">*</span>
            </label>
            <input
              id="ore"
              type="text"
              inputMode="decimal"
              placeholder="es. 8 o 3,5"
              value={ore}
              onChange={(e) => handleCambioOre(e.target.value)}
              className={`w-full rounded-[8px] border bg-white px-3 py-2 text-[13.5px] text-zinc-800 shadow-sm transition focus:outline-none focus:ring-1 ${
                erroreOre
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-800"
                  : "border-zinc-200 focus:border-rose-500 focus:ring-rose-500 dark:border-zinc-700"
              } dark:bg-zinc-800 dark:text-zinc-200`}
            />
            {erroreOre && (
              <p className="mt-1 text-[11.5px] font-medium text-red-600 dark:text-red-400">
                {erroreOre}
              </p>
            )}
          </div>

          {/* Fatturabile + Nota */}
          <div className="flex flex-wrap gap-[18px]">
            <label className="inline-flex items-center gap-2.5 rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-[13px] font-semibold text-zinc-700 transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={fatturabile}
                onChange={(e) => setFatturabile(e.target.checked)}
                className="h-[15px] w-[15px] rounded-[4px] border-zinc-300 text-rose-600 focus:ring-rose-500 dark:border-zinc-600 dark:bg-zinc-700"
              />
              Fatturabile
            </label>

            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="nota"
                className="mb-[5px] block text-[12px] font-semibold text-zinc-600 dark:text-zinc-400"
              >
                Nota
              </label>
              <textarea
                id="nota"
                rows={2}
                placeholder="Nota descrittiva (opzionale)"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-[13.5px] text-zinc-800 shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Errore submit */}
          {erroreSubmit && (
            <div className="flex items-start gap-2 rounded-[9px] border border-red-200 bg-red-50 p-[10px_13px] text-[12.5px] font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="mt-px h-[14px] w-[14px] flex-none"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 7.6h.01" />
              </svg>
              {erroreSubmit}
            </div>
          )}

          {/* Pulsanti */}
          <div className="flex items-center gap-3 pt-0.5">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-[7px] rounded-[10px] bg-rose-600 px-[18px] py-[9px] text-[13.5px] font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className="h-[15px] w-[15px]"
              >
                {modificaId ? (
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                ) : (
                  <path d="M12 5v14M5 12h14" />
                )}
              </svg>
              {modificaId ? "Salva modifiche" : "Aggiungi riga"}
            </button>

            {modificaId && (
              <button
                type="button"
                onClick={handleAnnulla}
                className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[18px] py-[9px] text-[13.5px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
              >
                Annulla
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
