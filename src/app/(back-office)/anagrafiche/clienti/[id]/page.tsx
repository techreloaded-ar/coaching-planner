import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { clientePerId } from "@/lib/clienti";
import { elencaOffertePerCliente } from "@/lib/offerte";

interface DettaglioClientePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ esito?: string }>;
}

function formattaEuro(importo: { toString(): string } | string | number): string {
  const valore = typeof importo === "number" ? importo : Number(importo.toString());

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valore);
}

export default async function DettaglioClientePage({
  params,
  searchParams,
}: DettaglioClientePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const cliente = await clientePerId(id);

  if (!cliente) {
    notFound();
  }

  const offerte = await elencaOffertePerCliente(cliente.id);
  const { esito } = await searchParams;

  const sede = [
    cliente.indirizzo,
    [cliente.cap, cliente.citta, cliente.provincia ? `(${cliente.provincia})` : ""]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const messaggioEsito =
    esito === "offerta-creata"
      ? "Offerta creata correttamente"
      : esito === "offerta-salvata"
        ? "Modifiche all'offerta salvate"
        : null;

  return (
    <div>
      <Link
        href="/anagrafiche/clienti"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Torna all&apos;elenco clienti
      </Link>

      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[14px]">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-indigo-500 text-[15px] font-bold text-white">
            {cliente.ragioneSociale
              .split(/\s+/)
              .map((parte) => parte[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
              Anagrafiche · Clienti
            </div>
            <h1 className="flex flex-wrap items-center gap-[10px] text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              {cliente.ragioneSociale}
              {cliente.attivo ? (
                <span className="inline-flex items-center gap-[5px] rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Attivo
                </span>
              ) : (
                <span className="inline-flex items-center gap-[5px] rounded-full border border-zinc-200 bg-zinc-100 px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  <span className="h-[6px] w-[6px] rounded-full bg-current" />
                  Disattivato
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="mt-1 flex shrink-0 items-center gap-[10px]">
          <Link
            href={`/anagrafiche/clienti/${cliente.id}/modifica`}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] text-[13.5px] font-semibold text-zinc-600 shadow-sm no-underline transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
            </svg>
            Modifica dati cliente
          </Link>
        </div>
      </div>

      {messaggioEsito && (
        <div className="mb-[18px] flex max-w-[840px] items-start gap-[9px] rounded-[11px] border border-emerald-200 bg-emerald-50 px-[13px] py-[11px] text-[13px] font-semibold leading-[1.45] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1.5px] h-[16px] w-[16px] shrink-0" strokeWidth={2}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{messaggioEsito}</span>
        </div>
      )}

      <section className="mb-[22px] rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-[18px] py-[15px] dark:border-zinc-800">
          <span className="inline-flex items-center gap-[9px] text-[15px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] text-indigo-500" strokeWidth={2}>
              <path d="M3 21V8.5L9 4l6 4.5V21" />
              <path d="M15 21h6V11l-6-3" />
            </svg>
            Dati anagrafici
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-[22px] gap-y-[14px] px-[22px] py-5">
          <Dato label="Partita IVA" valore={cliente.partitaIva} />
          <Dato label="Codice fiscale" valore={cliente.codiceFiscale} />
          <Dato label="Sede legale" valore={sede} />
          <Dato label="PEC" valore={cliente.pec} />
          <Dato label="Codice SDI" valore={cliente.codiceDestinatario} />
        </div>
      </section>

      <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-[18px] py-[15px] dark:border-zinc-800">
          <span className="inline-flex items-center gap-[9px] text-[15px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[17px] w-[17px] text-indigo-500" strokeWidth={2}>
              <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="M14 3v6h6M8 13h8M8 17h5" />
            </svg>
            Offerte
          </span>
          <span className="text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            {offerte.length === 1 ? "1 offerta" : `${offerte.length} offerte`}
          </span>
          <span className="ml-auto">
            <Link
              href={`/anagrafiche/clienti/${cliente.id}/offerte/nuova`}
              className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[10px] py-[6px] text-[12.5px] font-semibold text-white shadow-sm no-underline transition hover:bg-indigo-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuova offerta
            </Link>
          </span>
        </div>

        {offerte.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={1.9}>
                <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                <path d="M14 3v6h6M8 13h8M8 17h5" />
              </svg>
            </div>
            <b className="mb-1 block text-[14px] text-zinc-800 dark:text-zinc-100">
              Nessuna offerta per questo cliente
            </b>
            <p className="m-0 text-[12.5px] text-zinc-400 dark:text-zinc-500">
              Crea la prima offerta con codice, descrizione, tariffa giornaliera e giorni previsti.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]" aria-label="Offerte del cliente">
            <thead>
              <tr>
                <th className="px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Codice
                </th>
                <th className="px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Descrizione
                </th>
                <th className="px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Tariffa giornaliera
                </th>
                <th className="px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  Giorni previsti
                </th>
                <th className="w-[110px] px-4 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {offerte.map((offerta) => (
                <tr key={offerta.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-[13px] align-middle">
                    <span className="rounded-[7px] border border-zinc-200 bg-zinc-100 px-2 py-1 font-mono text-[12px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {offerta.codice}
                    </span>
                  </td>
                  <td className="max-w-[420px] truncate px-4 py-[13px] align-middle text-zinc-800 dark:text-zinc-100" title={offerta.descrizione}>
                    {offerta.descrizione}
                  </td>
                  <td className="px-4 py-[13px] text-right align-middle font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                    {formattaEuro(offerta.tariffaGiornaliera)}
                  </td>
                  <td className="px-4 py-[13px] text-right align-middle tabular-nums text-zinc-800 dark:text-zinc-100">
                    {offerta.giorniPrevisti}
                  </td>
                  <td className="px-4 py-[13px] text-right align-middle">
                    <Link
                      href={`/anagrafiche/clienti/${cliente.id}/offerte/${offerta.id}`}
                      className="inline-flex items-center gap-[5px] rounded-[8px] px-2 py-[5px] text-[12.5px] font-semibold text-zinc-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px]" strokeWidth={2}>
                        <path d="M16.5 3.7a2.2 2.2 0 0 1 3.1 3.1L7.5 18.9 3 20l1.1-4.5L16.5 3.7Z" />
                      </svg>
                      Modifica
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-[22px] flex items-start gap-[11px] rounded-[11px] border border-indigo-200 bg-indigo-50 p-[15px] text-[13px] text-zinc-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-zinc-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[2px] h-[16px] w-[16px] shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.6h.01" />
        </svg>
        <span>
          <b className="text-indigo-600 dark:text-indigo-400">Nota US-008</b> — le offerte si gestiscono dal
          dettaglio cliente: qui puoi consultare l&apos;elenco e aprire la creazione o modifica dell&apos;offerta.
        </span>
      </div>
    </div>
  );
}

function Dato({ label, valore }: { label: string; valore?: string | null }) {
  return (
    <div className="min-w-0 leading-[1.35]">
      <div className="mb-[3px] text-[10.5px] font-bold uppercase tracking-[.07em] text-zinc-400 dark:text-zinc-500">
        {label}
      </div>
      <div
        className={`truncate text-[13.5px] ${
          valore
            ? "font-semibold text-zinc-800 dark:text-zinc-100"
            : "font-medium text-zinc-400 dark:text-zinc-500"
        }`}
        title={valore ?? ""}
      >
        {valore || "Non indicato"}
      </div>
    </div>
  );
}
