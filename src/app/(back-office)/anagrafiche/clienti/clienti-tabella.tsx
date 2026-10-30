"use client";

import type { ElencoClientiPaginato } from "@/lib/clienti";
import {
  BarraElencoSelezionabile,
  CampiPosizioneElenco,
  CasellaSelezione,
  CasellaSelezioneTutti,
  ChipStato,
  ElencoSelezionabile,
  PaginazioneElenco,
  RicercaElenco,
  useSelezioneElenco,
} from "@/components";
import { cambiaStatoAction } from "./cambia-stato-action";

// ── Props ──────────────────────────────────────────────────────

interface ClientiTabellaProps {
  elenco: ElencoClientiPaginato;
  ricerca: string;
}

// ── Componente ─────────────────────────────────────────────────

export default function ClientiTabella({ elenco, ricerca }: ClientiTabellaProps) {
  const { clienti, attivi, disattivati, totaleElementi, paginaCorrente } = elenco;

  return (
    <ElencoSelezionabile
      elementi={clienti}
      idElemento={(cliente) => cliente.id}
      nomeElemento={(cliente) => cliente.ragioneSociale}
      nomi={{ singolare: "cliente", plurale: "clienti" }}
      azioni={[{ tipo: "modifica", href: (cliente) => `/anagrafiche/clienti/${cliente.id}/modifica` }]}
      stato={{
        attivo: (cliente) => cliente.attivo,
        azione: cambiaStatoAction,
        campiNascosti: <CampiPosizioneElenco ricerca={ricerca} pagina={paginaCorrente} />,
        descrizioneDisattivazione: () =>
          "I clienti disattivati restano nello storico ma non sono selezionabili per nuove attività e offerte. Potrai riattivarli in qualsiasi momento.",
      }}
    >
      <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Toolbar: ricerca e contatori, oppure azioni sulla selezione */}
        <BarraElencoSelezionabile>
          <RicercaElenco
            ricerca={ricerca}
            segnaposto="Cerca per ragione sociale, P.IVA o città…"
            etichetta="Cerca cliente"
            className="max-w-[320px]"
          />
          <span className="ml-auto text-[12.5px] font-medium text-zinc-400 dark:text-zinc-500">
            {totaleElementi} clienti · {attivi} attivi · {disattivati} disattivati
          </span>
        </BarraElencoSelezionabile>

        {/* Tabella */}
        <table className="w-full border-collapse text-[13.5px]" aria-label="Elenco clienti">
          <thead>
            <tr>
              <th className="w-[44px] px-4 py-[11px] text-left">
                <CasellaSelezioneTutti />
              </th>
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
            </tr>
          </thead>
          <tbody>
            {clienti.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-[34px] text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Nessun cliente corrisponde alla ricerca.
                </td>
              </tr>
            ) : (
              clienti.map((cliente) => (
                <RigaCliente key={cliente.id} cliente={cliente} />
              ))
            )}
          </tbody>
        </table>
        <PaginazioneElenco
          percorso="/anagrafiche/clienti"
          ricerca={ricerca}
          {...elenco}
        />
      </section>
    </ElencoSelezionabile>
  );
}

// ── Riga ───────────────────────────────────────────────────────

function RigaCliente({ cliente }: { cliente: ElencoClientiPaginato["clienti"][number] }) {
  const { isSelezionato } = useSelezioneElenco();
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
      className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
        !cliente.attivo ? "text-zinc-400 dark:text-zinc-500" : ""
      } ${isSelezionato(cliente.id) ? "bg-indigo-50/60 dark:bg-indigo-500/10" : ""}`}
    >
      <td className="px-4 py-[13px] align-middle">
        <CasellaSelezione id={cliente.id} nome={cliente.ragioneSociale} />
      </td>
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
        <ChipStato attivo={cliente.attivo} />
      </td>
    </tr>
  );
}
