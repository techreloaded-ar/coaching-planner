"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PulsanteAttesa, useValoriInviati } from "@/components";
import {
  creaVoceRimborso,
  aggiornaVoceRimborso,
  type StatoActionVoceRimborso,
} from "./actions";

interface VoceRimborsoFormProps {
  voce?: {
    id: string;
    etichetta: string;
    importo: string;
  };
}

const statoIniziale: StatoActionVoceRimborso = { errori: {} };

export default function VoceRimborsoForm({ voce }: VoceRimborsoFormProps) {
  const inModifica = !!voce;
  const [stato, azione] = useActionState(
    inModifica ? aggiornaVoceRimborso : creaVoceRimborso,
    statoIniziale
  );

  // I campi restano non controllati: solo così quanto digitato prima
  // dell'idratazione sopravvive. I defaultValue sono ripopolati con i valori
  // dell'ultimo invio, che React 19 riapplica quando ripristina il form.
  const { azioneConMemoria, valoreIniziale } = useValoriInviati(azione);

  const haErrori = Object.keys(stato.errori).length > 0;

  return (
    <div>
      <Link
        href="/anagrafiche/voci-rimborso"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-zinc-600 no-underline transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[15px] w-[15px]" strokeWidth={2.2}>
          <path d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Torna alle voci di rimborso
      </Link>

      <div className="mb-[22px]">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-zinc-400 dark:text-zinc-500">
          Anagrafiche · Voci di rimborso trasferta
        </div>
        <h1 className="text-[23px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          {inModifica ? "Modifica voce di rimborso" : "Nuova voce di rimborso"}
        </h1>
        <p className="mt-[6px] max-w-[560px] text-[13px] text-zinc-400 dark:text-zinc-500">
          L&apos;etichetta descrive la voce di rimborso trasferta; l&apos;importo forfettario è il
          rimborso riconosciuto per ogni trasferta a cui la voce viene applicata.
        </p>
      </div>

      <form
        noValidate
        action={azioneConMemoria}
        className="max-w-[680px] rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        {inModifica && <input type="hidden" name="id" value={voce.id} />}

        <div className="px-7 pb-[10px] pt-[26px]">
          {haErrori && (
            <div className="mb-[18px] flex items-start gap-[9px] rounded-[11px] border border-red-200 bg-red-50 px-[13px] py-[11px] text-[13px] font-semibold leading-[1.45] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-[1.5px] h-[16px] w-[16px] shrink-0" strokeWidth={2}>
                <path d="M12 9v4.5M12 17h.01" />
                <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span>
                {stato.errori._form ??
                  "Controlla i campi evidenziati: alcuni dati mancano o non sono validi."}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-[18px] gap-y-0 max-[640px]:grid-cols-1">
            <div className="col-span-2 mt-0 flex items-center gap-[8px] border-b border-zinc-100 pb-3 pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[14px] w-[14px] text-indigo-500" strokeWidth={2}>
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
              </svg>
              Definizione della voce
            </div>

            <Campo
              label="Etichetta"
              name="etichetta"
              placeholder="Es. Rimborso trasferta breve"
              defaultValue={valoreIniziale("etichetta", voce?.etichetta ?? "")}
              errore={stato.errori.etichetta}
              obbligatorio
              hint="Testo libero, es. «Rimborso trasferta breve»"
            />

            <Campo
              label="Importo forfettario"
              name="importo"
              placeholder="Es. 28,00"
              defaultValue={valoreIniziale("importo", voce?.importo ?? "")}
              errore={stato.errori.importo}
              obbligatorio
              suffisso="€"
              hint="Importo in euro, accetta virgola o punto come separatore decimale"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-[10px] rounded-b-[11px] border-t border-zinc-200 bg-zinc-50 px-7 py-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <Link
            href="/anagrafiche/voci-rimborso"
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-zinc-600 shadow-sm no-underline transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Annulla
          </Link>
          <PulsanteAttesa
            etichettaAttesa={inModifica ? "Salvataggio…" : "Creazione…"}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-transparent bg-indigo-500 px-[15px] py-[9px] font-[inherit] text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {inModifica ? "Salva modifiche" : "Crea voce"}
          </PulsanteAttesa>
        </div>
      </form>
    </div>
  );
}

interface CampoProps {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  errore?: string;
  obbligatorio?: boolean;
  suffisso?: string;
  hint?: string;
}

function Campo({
  label,
  name,
  placeholder,
  defaultValue,
  errore,
  obbligatorio,
  suffisso,
  hint,
}: CampoProps) {
  return (
    <div className="mb-[18px] flex min-w-0 flex-col gap-[6px] text-left">
      <label htmlFor={name} className="text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400">
        {label} {obbligatorio && <span className="font-bold text-red-600 dark:text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`w-full rounded-[10px] border bg-white px-[13px] py-[10px] font-[inherit] text-[14px] text-zinc-800 outline-none transition placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 ${
            suffisso ? "pr-11" : ""
          } ${
            errore
              ? "border-red-600 shadow-[0_0_0_3px_rgb(239_68_68_/_0.08)] dark:shadow-[0_0_0_3px_rgb(239_68_68_/_0.1)]"
              : "border-zinc-200 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:focus:border-indigo-500/50"
          }`}
        />
        {suffisso && (
          <span className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-[13px] font-semibold text-zinc-400 dark:text-zinc-500">
            {suffisso}
          </span>
        )}
      </div>
      {errore && (
        <p className="m-0 inline-flex items-center gap-[5px] text-[12px] font-semibold text-red-600 dark:text-red-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[13px] w-[13px] shrink-0" strokeWidth={2.2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {errore}
        </p>
      )}
      {hint && <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">{hint}</span>}
    </div>
  );
}
