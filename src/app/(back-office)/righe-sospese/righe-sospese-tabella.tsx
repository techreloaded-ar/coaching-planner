"use client";

import { useRouter } from "next/navigation";
import type { ElencoRigheSospese, RigaSospesaInElenco } from "@/lib/righe-sospese";
import {
  BarraElencoSelezionabile,
  CasellaSelezione,
  CasellaSelezioneTutti,
  ElencoSelezionabile,
  PaginazioneElenco,
  useIdratata,
  useSelezioneElenco,
} from "@/components";
import {
  DESCRIZIONE_MOTIVO_SOSPENSIONE,
  MOTIVI_SOSPENSIONE,
  STATI_RIGA_SOSPESA,
  parametriFiltroRigheSospese,
  type FiltroRigheSospese,
  type StatoRigaSospesa,
} from "@/domain/righe-sospese";
import { urlPosizioneElenco } from "@/lib/paginazione";
import { FUSO_GIORNATA } from "@/domain/calendario-google";
import { cambiaRisoluzioneRigheSospeseAction } from "./actions";

const PERCORSO_ELENCO = "/righe-sospese";

const ETICHETTE_STATO: Record<StatoRigaSospesa, string> = {
  aperte: "Aperte",
  risolte: "Risolte",
  tutte: "Tutte",
};

const COLONNE = [
  "Collaboratore",
  "Data",
  "Cliente",
  "Codice offerta",
  "Ore",
  "Tipologia fatturazione",
  "Motivo",
];

// Fuso esplicito: server e browser devono produrre lo stesso testo.
const formattatoreData = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: FUSO_GIORNATA });

function descriviRiga(riga: RigaSospesaInElenco): string {
  return `riga di ${riga.collaboratore ?? "—"} del ${riga.data ?? "—"} su ${riga.cliente ?? "—"}`;
}

// ── Componente ─────────────────────────────────────────────────

export default function RigheSospeseTabella({ elenco }: { elenco: ElencoRigheSospese }) {
  const { righe, filtro } = elenco;

  return (
    <ElencoSelezionabile
      elementi={righe}
      idElemento={(riga) => riga.id}
      nomeElemento={descriviRiga}
      nomi={{ singolare: "riga", plurale: "righe", femminile: true }}
      risoluzione={{
        risolta: (riga) => riga.risoltaIl !== null,
        azione: cambiaRisoluzioneRigheSospeseAction,
      }}
    >
      <section className="rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Toolbar: filtri, oppure azioni sulla selezione */}
        <BarraElencoSelezionabile>
          <FiltriRigheSospese filtro={filtro} />
        </BarraElencoSelezionabile>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label="Elenco righe sospese">
            <thead>
              <tr>
                <th className="w-[44px] px-4 py-[11px] text-left">
                  <CasellaSelezioneTutti />
                </th>
                {COLONNE.map((colonna) => (
                  <th
                    key={colonna}
                    className="whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati"
                  >
                    {colonna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 ? (
                <tr>
                  <td colSpan={COLONNE.length + 1} className="px-4 py-[34px] text-center text-sm text-testo-metadati">
                    Nessuna riga sospesa con i filtri selezionati.
                  </td>
                </tr>
              ) : (
                righe.map((riga) => <RigaSospesa key={riga.id} riga={riga} />)
              )}
            </tbody>
          </table>
        </div>
        <PaginazioneElenco
          percorso={PERCORSO_ELENCO}
          ricerca=""
          parametri={parametriFiltroRigheSospese(filtro)}
          {...elenco}
        />
      </section>
    </ElencoSelezionabile>
  );
}

// ── Filtri ─────────────────────────────────────────────────────

function FiltriRigheSospese({ filtro }: { filtro: FiltroRigheSospese }) {
  const router = useRouter();
  // Prima dell'idratazione un cambio di filtro non navigherebbe.
  const idratata = useIdratata();
  const vai = (nuovoFiltro: FiltroRigheSospese) =>
    router.push(
      urlPosizioneElenco(PERCORSO_ELENCO, { ricerca: "", pagina: 1 }, parametriFiltroRigheSospese(nuovoFiltro)),
      { scroll: false },
    );

  return (
    <>
      <div
        role="group"
        aria-label="Filtra per stato"
        className="flex gap-[2px] rounded-[9px] bg-zinc-100 p-[3px] dark:bg-zinc-800"
      >
        {STATI_RIGA_SOSPESA.map((stato) => (
          <button
            key={stato}
            type="button"
            onClick={() => vai({ ...filtro, stato })}
            disabled={!idratata}
            aria-pressed={filtro.stato === stato}
            className={`whitespace-nowrap cursor-pointer rounded-[7px] px-[11px] py-[5px] font-[inherit] text-sm font-medium transition ${
              filtro.stato === stato
                ? "bg-white text-testo-principale shadow-sm dark:bg-zinc-700"
                : "text-testo-metadati hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            {ETICHETTE_STATO[stato]}
          </button>
        ))}
      </div>
      <label className="ml-auto flex items-center gap-2 text-sm font-medium text-testo-metadati">
        Motivo
        <select
          value={filtro.motivo ?? ""}
          disabled={!idratata}
          onChange={(evento) =>
            vai({
              ...filtro,
              motivo: MOTIVI_SOSPENSIONE.find((motivo) => motivo === evento.target.value) ?? null,
            })
          }
          className="rounded-[9px] border border-zinc-200 bg-white px-[10px] py-[6px] font-[inherit] text-sm text-testo-secondario dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Tutti i motivi</option>
          {MOTIVI_SOSPENSIONE.map((motivo) => (
            <option key={motivo} value={motivo}>
              {DESCRIZIONE_MOTIVO_SOSPENSIONE[motivo]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

// ── Riga ───────────────────────────────────────────────────────

function RigaSospesa({ riga }: { riga: RigaSospesaInElenco }) {
  const { isSelezionato } = useSelezioneElenco();
  const valore = (testo: string | null) => testo ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>;

  return (
    <tr
      className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
        riga.risoltaIl ? "text-testo-metadati" : "text-testo-secondario"
      } ${isSelezionato(riga.id) ? "bg-indigo-50/60 dark:bg-indigo-500/10" : ""}`}
    >
      <td className="px-4 py-[13px] align-middle">
        <CasellaSelezione id={riga.id} nome={descriviRiga(riga)} />
      </td>
      <td className="px-4 py-[13px] align-middle">{valore(riga.collaboratore)}</td>
      <td className="whitespace-nowrap px-4 py-[13px] align-middle tabular-nums">{valore(riga.data)}</td>
      <td className="px-4 py-[13px] align-middle">{valore(riga.cliente)}</td>
      <td className="px-4 py-[13px] align-middle tabular-nums">{valore(riga.codiceOfferta)}</td>
      <td className="px-4 py-[13px] align-middle tabular-nums">{valore(riga.ore)}</td>
      <td className="px-4 py-[13px] align-middle">{valore(riga.tipologiaFatturazione)}</td>
      <td className="px-4 py-[13px] align-middle">
        <div className="flex flex-wrap items-center gap-[6px]">
          <span className="whitespace-nowrap rounded-full bg-amber-50 px-[9px] py-[3px] text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            {DESCRIZIONE_MOTIVO_SOSPENSIONE[riga.motivo]}
          </span>
          {riga.risoltaIl && (
            <span className="whitespace-nowrap rounded-full bg-emerald-50 px-[9px] py-[3px] text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Risolta il {formattatoreData.format(riga.risoltaIl)}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
