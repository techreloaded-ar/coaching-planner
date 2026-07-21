import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { collaboratorePerId, storicoAttivitaCollaboratore } from "@/lib/collaboratori";
import { raggruppaAttivitaPerMese, type RigaStoricoAttivita } from "@/domain/consuntivi";
import { etichettaMese } from "@/domain/calendario";

// ── Utilità ────────────────────────────────────────────────────

/** Formatta una Date in stringa YYYY-MM-DD in ora locale. */
function formattaDataISO(data: Date): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const g = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

function formattaEuro(valore: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(valore);
}

const formattaNumero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

const GIORNI_SETTIMANA = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;

/** Giorno del mese e giorno della settimana da una data YYYY-MM-DD. */
function etichettaGiorno(dataISO: string): { giorno: number; settimana: string } {
  const [anno, mese, giorno] = dataISO.split("-").map(Number);
  const data = new Date(anno, mese - 1, giorno);
  return { giorno, settimana: GIORNI_SETTIMANA[data.getDay()] };
}

// ── Pagina ─────────────────────────────────────────────────────

interface DettaglioCollaboratorePageProps {
  params: Promise<{ id: string }>;
}

export default async function DettaglioCollaboratorePage({ params }: DettaglioCollaboratorePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const collaboratore = await collaboratorePerId(id);

  if (!collaboratore) {
    notFound();
  }

  const storico = await storicoAttivitaCollaboratore(id);

  const righe: RigaStoricoAttivita[] = storico.map((riga) => ({
    id: riga.id,
    data: formattaDataISO(riga.data),
    clienteRagioneSociale: riga.cliente.ragioneSociale,
    offertaCodice: riga.offerta.codice,
    offertaDescrizione: riga.offerta.descrizione,
    ore: Number(riga.ore),
    fatturabile: riga.fatturabile,
    nota: riga.nota,
  }));

  const mesi = raggruppaAttivitaPerMese(righe);

  const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;
  const iniziali = `${collaboratore.nome[0] ?? ""}${collaboratore.cognome[0] ?? ""}`.toUpperCase();

  return (
    <div>
      <Link
        href="/anagrafiche/collaboratori"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Collaboratori
      </Link>

      {/* Intestazione profilo */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[14px]">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-indigo-500 text-[15px] font-bold text-white">
            {iniziali}
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
              Anagrafiche · Collaboratori
            </div>
            <h1 className="flex flex-wrap items-center gap-[10px] text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              {nomeCompleto}
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
            </h1>
            <div className="mt-[4px] inline-flex items-center gap-[7px] text-[13px] text-zinc-500 dark:text-zinc-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] shrink-0 text-zinc-400 dark:text-zinc-500" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              {collaboratore.utente.email}
            </div>
          </div>
        </div>

        <div className="mt-1 shrink-0 rounded-[11px] border border-zinc-200 bg-white px-[16px] py-[10px] shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[10.5px] font-bold uppercase tracking-[.07em] text-zinc-400 dark:text-zinc-500">
            Tariffa giornaliera
          </div>
          <div className="mt-[2px] text-[16px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
            {formattaEuro(Number(collaboratore.tariffaGiornaliera))}
          </div>
        </div>
      </div>

      {/* Storico attività per mese */}
      {mesi.length === 0 ? (
        <section className="rounded-[11px] border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={1.9}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <p className="m-0 text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-100">
            Nessuna attività registrata per questo collaboratore.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-[22px]">
          {mesi.map((mese) => (
            <section
              key={mese.token}
              className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-[18px] py-[15px] dark:border-zinc-800">
                <span className="inline-flex items-center gap-[9px] text-[15px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] text-indigo-500" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {etichettaMese(mese.token)}
                </span>
                <span className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
                  {formattaNumero.format(mese.oreTotali)} ore · {formattaNumero.format(mese.giornateTotali)} giornate
                </span>
              </div>

              <table className="w-full border-collapse text-[13.5px]" aria-label={`Attività di ${etichettaMese(mese.token)}`}>
                <thead>
                  <tr>
                    <th className="w-[90px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                      Giorno
                    </th>
                    <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                      Cliente
                    </th>
                    <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                      Offerta
                    </th>
                    <th className="w-[90px] whitespace-nowrap px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                      Ore
                    </th>
                    <th className="w-[150px] whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                      Fatturabilità
                    </th>
                    <th className="whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mese.righe.map((riga) => {
                    const { giorno, settimana } = etichettaGiorno(riga.data);
                    return (
                      <tr
                        key={riga.id}
                        className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-4 py-[13px] align-middle whitespace-nowrap">
                          <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{giorno}</span>{" "}
                          <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">{settimana}</span>
                        </td>
                        <td className="px-4 py-[13px] align-middle font-semibold text-zinc-800 dark:text-zinc-100">
                          {riga.clienteRagioneSociale}
                        </td>
                        <td className="px-4 py-[13px] align-middle">
                          <span className="block text-[12px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {riga.offertaCodice}
                          </span>
                          <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                            {riga.offertaDescrizione}
                          </span>
                        </td>
                        <td className="px-4 py-[13px] text-right align-middle tabular-nums font-semibold text-zinc-800 dark:text-zinc-100">
                          {formattaNumero.format(riga.ore)}
                        </td>
                        <td className="px-4 py-[13px] align-middle">
                          {riga.fatturabile ? (
                            <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2.4}>
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              Fatturabile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[12px] w-[12px]" strokeWidth={2}>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M5.6 5.6l12.8 12.8" />
                              </svg>
                              Non fatturabile
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-[13px] align-middle text-[12.5px] text-zinc-500 dark:text-zinc-400">
                          {riga.nota ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
