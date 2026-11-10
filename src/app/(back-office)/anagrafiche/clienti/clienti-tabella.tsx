"use client";

import { useRouter } from "next/navigation";
import type { ElencoClientiPaginato } from "@/lib/clienti";
import {
  BarraElencoSelezionabile,
  CasellaSelezione,
  CasellaSelezioneTutti,
  ChipStatoCliente,
  ElencoSelezionabile,
  PaginazioneElenco,
  RicercaElenco,
  useSelezioneElenco,
} from "@/components";
import {
  TIPI_STATO_CLIENTE,
  parametriFiltroStatoCliente,
  type TipoStatoCliente,
} from "@/domain/anagrafiche/stato-cliente";
import { urlPosizioneElenco } from "@/lib/paginazione";

const PERCORSO_ELENCO = "/anagrafiche/clienti";

const ETICHETTE_FILTRO: Record<TipoStatoCliente, string> = {
  ATTIVO: "Attivi",
  NUOVO: "Nuovi",
  NON_ATTIVO: "Non attivi",
};

// ── Props ──────────────────────────────────────────────────────

interface ClientiTabellaProps {
  elenco: ElencoClientiPaginato;
  ricerca: string;
}

// ── Componente ─────────────────────────────────────────────────

export default function ClientiTabella({ elenco, ricerca }: ClientiTabellaProps) {
  const { clienti, statiSelezionati } = elenco;
  const parametriFiltro = parametriFiltroStatoCliente(statiSelezionati);

  return (
    <ElencoSelezionabile
      elementi={clienti}
      idElemento={(cliente) => cliente.id}
      nomeElemento={(cliente) => cliente.ragioneSociale}
      nomi={{ singolare: "cliente", plurale: "clienti" }}
      azioni={[{ tipo: "modifica", href: (cliente) => `/anagrafiche/clienti/${cliente.id}/modifica` }]}
    >
      <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Toolbar: ricerca e quick filter per stato, oppure azioni sulla selezione */}
        <BarraElencoSelezionabile>
          <RicercaElenco
            ricerca={ricerca}
            segnaposto="Cerca per ragione sociale, P.IVA o città…"
            etichetta="Cerca cliente"
            className="max-w-[320px]"
            parametri={parametriFiltro}
          />
          <FiltroStatoClienti elenco={elenco} ricerca={ricerca} />
        </BarraElencoSelezionabile>

        {/* Tabella */}
        <table className="w-full border-collapse text-sm" aria-label="Elenco clienti">
          <thead>
            <tr>
              <th className="w-[44px] px-4 py-[11px] text-left">
                <CasellaSelezioneTutti />
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                Ragione sociale
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                P.IVA
              </th>
              <th className="whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                Città
              </th>
              <th className="w-[130px] whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati">
                Offerte
              </th>
            </tr>
          </thead>
          <tbody>
            {clienti.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-[34px] text-center text-sm text-testo-metadati">
                  {ricerca
                    ? "Nessun cliente corrisponde alla ricerca."
                    : "Nessun cliente negli stati selezionati."}
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
          percorso={PERCORSO_ELENCO}
          ricerca={ricerca}
          parametri={parametriFiltro}
          {...elenco}
        />
      </section>
    </ElencoSelezionabile>
  );
}

// ── Quick filter ───────────────────────────────────────────────

/**
 * Opzioni attivabili singolarmente, ognuna con il numero di clienti di quello
 * stato nell'insieme cercato. Deselezionarle tutte riporta ai predefiniti.
 * Con una ricerca i risultati includono tutti gli stati.
 */
function FiltroStatoClienti({ elenco, ricerca }: { elenco: ElencoClientiPaginato; ricerca: string }) {
  const { statiSelezionati, conteggiPerStato } = elenco;
  const router = useRouter();

  return (
    <div className="ml-auto flex flex-wrap items-center gap-3">
      {ricerca && (
        <span className="text-xs text-testo-metadati">
          La ricerca include tutti gli stati
        </span>
      )}
      <div
        role="group"
        aria-label="Filtra per stato"
        className="flex gap-[2px] rounded-[9px] bg-zinc-100 p-[3px] dark:bg-zinc-800"
      >
        {TIPI_STATO_CLIENTE.map((tipo) => {
          const selezionato = statiSelezionati.includes(tipo);
          const nuoviStati = selezionato
            ? statiSelezionati.filter((stato) => stato !== tipo)
            : [...statiSelezionati, tipo];
          return (
            <button
              key={tipo}
              type="button"
              onClick={() =>
                router.push(
                  urlPosizioneElenco(
                    PERCORSO_ELENCO,
                    { ricerca, pagina: 1 },
                    parametriFiltroStatoCliente(nuoviStati),
                  ),
                  { scroll: false },
                )
              }
              aria-pressed={selezionato}
              className={`whitespace-nowrap cursor-pointer rounded-[7px] px-[11px] py-[5px] font-[inherit] text-sm font-medium transition ${
                selezionato
                  ? "bg-white text-testo-principale shadow-sm dark:bg-zinc-700"
                  : "text-testo-metadati hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {ETICHETTE_FILTRO[tipo]}
              <span className="ml-[5px] font-medium text-testo-metadati tabular-nums">
                {conteggiPerStato[tipo]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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

  const nonAttivo = cliente.stato.tipo === "NON_ATTIVO";

  return (
    <tr
      className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
        nonAttivo ? "text-testo-metadati" : ""
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
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-xs font-medium ${
              cliente.stato.tipo === "ATTIVO"
                ? "bg-indigo-500 text-white"
                : cliente.stato.tipo === "NUOVO"
                  ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                  : "border border-zinc-200 bg-zinc-100 text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800"
            }`}
          >
            {iniziali}
          </div>
          <div className="min-w-0 leading-[1.3]">
            <b
              className={`block overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium ${
                nonAttivo
                  ? "text-testo-metadati"
                  : "text-testo-principale"
              }`}
            >
              {cliente.ragioneSociale}
            </b>
            <span className="text-xs text-testo-metadati">
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
        <ChipStatoCliente stato={cliente.stato} />
      </td>
    </tr>
  );
}
