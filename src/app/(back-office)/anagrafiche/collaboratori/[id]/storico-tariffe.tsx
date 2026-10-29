"use client";

import { useActionState, useEffect, useState } from "react";
import { PulsanteAttesa, useValoriInviati } from "@/components";
import { formattaEuro } from "@/lib/formattazione";
import type { VoceStoricoTariffa } from "@/lib/collaboratori";
import {
  ETICHETTA_MODALITA_TARIFFA,
  MODALITA_TARIFFA,
  UNITA_TARIFFA,
  etichettaMeseTariffa,
  periodiDiValidita,
  tariffaValidaNelMese,
  type ModalitaTariffa,
} from "@/domain/tariffe";
import type { StatoAction } from "../actions";
import { eliminaTariffaCollaboratore, salvaTariffaCollaboratore } from "./tariffe-actions";

const statoIniziale: StatoAction = { errori: {} };

const classeIntestazione =
  "whitespace-nowrap px-4 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[.06em] text-zinc-400 dark:text-zinc-500";
const classeAzioneRiga =
  "inline-flex items-center rounded-[8px] px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10";

interface StoricoTariffeProps {
  collaboratoreId: string;
  voci: VoceStoricoTariffa[];
  /** Mese corrente YYYY-MM, calcolato sul server */
  meseCorrente: string;
}

/** Voce in modifica, `"nuova"` per l'inserimento, `null` a modulo chiuso. */
type VoceInModifica = VoceStoricoTariffa | "nuova" | null;

export default function StoricoTariffe({ collaboratoreId, voci, meseCorrente }: StoricoTariffeProps) {
  const [inModifica, setInModifica] = useState<VoceInModifica>(null);
  const [statoElimina, elimina] = useActionState(eliminaTariffaCollaboratore, statoIniziale);

  const inVigore = tariffaValidaNelMese(voci, meseCorrente);
  const periodi = periodiDiValidita(voci);
  const piuVecchia = voci.at(-1);

  return (
    <section aria-labelledby="titolo-storico-tariffe" className="mb-[22px]">
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titolo-storico-tariffe" className="text-[17px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Storico tariffe
          </h2>
          <p className="mt-[1px] text-[12.5px] text-zinc-400 dark:text-zinc-500">
            Ogni tariffa vale dal mese indicato fino alla successiva
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInModifica("nuova")}
          className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[14px] py-[9px] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuova tariffa
        </button>
      </div>

      <div className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full border-collapse text-[13.5px]" aria-label="Storico tariffe">
          <thead>
            <tr>
              <th className={classeIntestazione}>Valida dal mese</th>
              <th className={classeIntestazione}>Modalità</th>
              <th className={`${classeIntestazione} text-right`}>Importo</th>
              <th className={classeIntestazione}>Periodo</th>
              <th className={classeIntestazione}><span className="sr-only">Azioni</span></th>
            </tr>
          </thead>
          <tbody>
            {voci.map((voce) => (
              <tr
                key={voce.id}
                className={`border-t border-zinc-100 dark:border-zinc-800 ${voce === inVigore ? "bg-indigo-50/40 dark:bg-indigo-500/5" : ""}`}
              >
                <td className="px-4 py-[12px] align-middle font-semibold text-zinc-800 dark:text-zinc-100">
                  {etichettaMeseTariffa(voce.validaDalMese)}
                  {voce === inVigore && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-[8px] py-[2px] text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      in vigore
                    </span>
                  )}
                </td>
                <td className="px-4 py-[12px] align-middle">
                  <BadgeModalita modalita={voce.modalita} />
                </td>
                <td className="px-4 py-[12px] text-right align-middle tabular-nums whitespace-nowrap text-zinc-800 dark:text-zinc-100">
                  {formattaEuro(voce.importo)} {UNITA_TARIFFA[voce.modalita]}
                </td>
                <td className="px-4 py-[12px] align-middle text-zinc-500 dark:text-zinc-400">{periodi.get(voce)}</td>
                <td className="px-4 py-[12px] text-right align-middle whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setInModifica(voce)}
                    className={classeAzioneRiga}
                    aria-label={`Modifica tariffa da ${etichettaMeseTariffa(voce.validaDalMese)}`}
                  >
                    Modifica
                  </button>
                  {voce !== piuVecchia && (
                    <form action={elimina} className="inline">
                      <input type="hidden" name="collaboratoreId" value={collaboratoreId} />
                      <input type="hidden" name="tariffaId" value={voce.id} />
                      <PulsanteAttesa
                        className="inline-flex items-center rounded-[8px] px-2 py-[5px] font-[inherit] text-[12.5px] font-semibold text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        aria-label={`Elimina tariffa da ${etichettaMeseTariffa(voce.validaDalMese)}`}
                      >
                        Elimina
                      </PulsanteAttesa>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {statoElimina.errori._form && (
          <p role="alert" className="border-t border-zinc-100 px-4 py-3 text-[13px] text-red-600 dark:border-zinc-800 dark:text-red-400">
            {statoElimina.errori._form}
          </p>
        )}

        {inModifica !== null && (
          <ModuloTariffa
            // Una nuova istanza per ogni voce: valori e stato ripartono puliti.
            key={inModifica === "nuova" ? "nuova" : inModifica.id}
            collaboratoreId={collaboratoreId}
            voce={inModifica === "nuova" ? null : inModifica}
            meseCorrente={meseCorrente}
            onChiudi={() => setInModifica(null)}
          />
        )}
      </div>
    </section>
  );
}

function BadgeModalita({ modalita }: { modalita: ModalitaTariffa }) {
  const colori =
    modalita === "FISSO_MENSILE"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap ${colori}`}>
      {ETICHETTA_MODALITA_TARIFFA[modalita]}
    </span>
  );
}

function ModuloTariffa({
  collaboratoreId,
  voce,
  meseCorrente,
  onChiudi,
}: {
  collaboratoreId: string;
  voce: VoceStoricoTariffa | null;
  meseCorrente: string;
  onChiudi: () => void;
}) {
  const [stato, salva] = useActionState(salvaTariffaCollaboratore, statoIniziale);
  const [modalita, setModalita] = useState<ModalitaTariffa>(voce?.modalita ?? "GIORNALIERA");
  // React 19 azzera i campi non controllati a ogni invio: dopo un errore si
  // ripropongono i valori appena inviati.
  const { azioneConMemoria, valoreIniziale } = useValoriInviati(salva);

  useEffect(() => {
    if (stato.successo) onChiudi();
  }, [stato, onChiudi]);

  const classeCampo =
    "w-full rounded-[9px] border border-zinc-200 bg-white px-3 py-[8px] text-[13.5px] text-zinc-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-indigo-500/20";
  const classeEtichetta = "mb-1 block text-[12px] font-semibold text-zinc-500 dark:text-zinc-400";

  return (
    <form
      action={azioneConMemoria}
      aria-label={voce ? "Modifica tariffa" : "Nuova tariffa"}
      className="border-t border-indigo-200 bg-indigo-50/60 px-4 py-4 dark:border-indigo-500/20 dark:bg-indigo-500/5"
    >
      <input type="hidden" name="collaboratoreId" value={collaboratoreId} />
      {voce && <input type="hidden" name="tariffaId" value={voce.id} />}

      <div className="grid gap-3 md:grid-cols-[170px_auto_180px_auto] md:items-start">
        <div>
          <label htmlFor="tariffa-valida-dal-mese" className={classeEtichetta}>Valida dal mese</label>
          <input
            id="tariffa-valida-dal-mese"
            type="month"
            name="validaDalMese"
            required
            defaultValue={valoreIniziale("validaDalMese", voce?.validaDalMese ?? meseCorrente)}
            aria-invalid={Boolean(stato.errori.validaDalMese)}
            aria-describedby="tariffa-valida-dal-mese-errore"
            className={classeCampo}
          />
          <ErroreCampo id="tariffa-valida-dal-mese-errore" messaggio={stato.errori.validaDalMese} />
        </div>

        <fieldset>
          <legend className={classeEtichetta}>Modalità</legend>
          <div className="inline-flex overflow-hidden rounded-[9px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {MODALITA_TARIFFA.map((valore) => (
              <label
                key={valore}
                className={`cursor-pointer px-3 py-[8px] text-[13px] font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300 ${
                  modalita === valore ? "bg-indigo-500 text-white" : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="modalita"
                  value={valore}
                  checked={modalita === valore}
                  onChange={() => setModalita(valore)}
                  className="sr-only"
                />
                {ETICHETTA_MODALITA_TARIFFA[valore]}
              </label>
            ))}
          </div>
          <ErroreCampo id="tariffa-modalita-errore" messaggio={stato.errori.modalita} />
        </fieldset>

        <div>
          <label htmlFor="tariffa-importo" className={classeEtichetta}>
            Importo (€ {UNITA_TARIFFA[modalita]})
          </label>
          <input
            id="tariffa-importo"
            name="importo"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Es. 450,00"
            required
            defaultValue={valoreIniziale("importo", voce ? voce.importo.replace(".", ",") : "")}
            aria-invalid={Boolean(stato.errori.importo)}
            aria-describedby="tariffa-importo-errore"
            className={classeCampo}
          />
          <ErroreCampo id="tariffa-importo-errore" messaggio={stato.errori.importo} />
        </div>

        <div className="flex gap-2 md:mt-[22px]">
          <PulsanteAttesa className="rounded-[9px] bg-indigo-500 px-4 py-[8px] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600">
            Salva tariffa
          </PulsanteAttesa>
          <button
            type="button"
            onClick={onChiudi}
            className="rounded-[9px] border border-zinc-200 bg-white px-4 py-[8px] text-[13.5px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Annulla
          </button>
        </div>
      </div>

      <ErroreCampo id="tariffa-errore" messaggio={stato.errori._form} />

      <p className="mt-3 text-[12px] text-zinc-500 dark:text-zinc-400">
        Una sola tariffa per mese. Inserire o modificare una tariffa di un mese passato ricalcola
        riepiloghi e marginalità di quei mesi.
      </p>
    </form>
  );
}

function ErroreCampo({ id, messaggio }: { id: string; messaggio?: string }) {
  if (!messaggio) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-[12.5px] font-medium text-red-600 dark:text-red-400">
      {messaggio}
    </p>
  );
}
