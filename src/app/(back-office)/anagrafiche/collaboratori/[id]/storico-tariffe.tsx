"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CLASSE_ELEMENTO_IN_ATTESA, IndicatoreSalvataggio } from "@/components";
import { AvvisiMutazioni, useMutazioniElenco } from "@/components/mutazioni-elenco";
import { descriviImportoTariffa } from "@/lib/formattazione";
import type { VoceStoricoTariffa } from "@/lib/collaboratori";
import {
  conVoceTariffa,
  messaggioMutazioneNonRiuscita,
  type InAttesa,
} from "@/lib/mutazioni-ottimistiche";
import { normalizzaTariffaGiornaliera } from "@/domain/anagrafiche/valida-collaboratore";
import {
  ETICHETTA_MODALITA_TARIFFA,
  MODALITA_TARIFFA,
  UNITA_TARIFFA,
  eModalitaTariffa,
  etichettaMeseTariffa,
  periodiDiValidita,
  tariffaValidaNelMese,
  validaVoceTariffa,
  type ModalitaTariffa,
} from "@/domain/tariffe";
import type { StatoAction } from "../actions";
import { eliminaTariffaCollaboratore, salvaTariffaCollaboratore } from "./tariffe-actions";

const statoIniziale: StatoAction = { errori: {} };

const classeIntestazione =
  "whitespace-nowrap px-4 py-[11px] text-left text-xs font-medium text-testo-metadati";
const classeAzioneRiga =
  "inline-flex items-center rounded-[8px] px-2 py-[5px] font-[inherit] text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10";

interface StoricoTariffeProps {
  collaboratoreId: string;
  voci: VoceStoricoTariffa[];
  /** Mese corrente YYYY-MM, calcolato sul server */
  meseCorrente: string;
}

/** Voce dello storico: una tariffa appena salvata resta in attesa fino alla conferma. */
type VoceInElenco = InAttesa<VoceStoricoTariffa>;

type MutazioneTariffe =
  | { tipo: "salva"; voce: VoceInElenco; idSostituito: string | null }
  | { tipo: "elimina"; tariffaId: string };

function applicaMutazioneTariffe(voci: VoceInElenco[], mutazione: MutazioneTariffe): VoceInElenco[] {
  if (mutazione.tipo === "elimina") {
    return voci.filter((voce) => voce.id !== mutazione.tariffaId);
  }
  return conVoceTariffa(voci, mutazione.voce, mutazione.idSostituito);
}

/** Campi di una voce che ha superato la validazione lato client. */
interface DatiTariffaValidi {
  validaDalMese: string;
  validaAlMese: string | null;
  modalita: ModalitaTariffa;
  importo: string;
}

/**
 * Modulo aperto: `voce` è la voce in modifica (`null` per l'inserimento);
 * `valori` ed `errori` ripropongono un invio rifiutato dal server.
 */
interface ModuloAperto {
  voce: VoceStoricoTariffa | null;
  valori?: Record<string, string>;
  errori?: Record<string, string>;
}

function valoriTestuali(datiForm: FormData): Record<string, string> {
  const valori: Record<string, string> = {};
  for (const [nomeCampo, valore] of datiForm.entries()) {
    if (typeof valore === "string") valori[nomeCampo] = valore;
  }
  return valori;
}

export default function StoricoTariffe({ collaboratoreId, voci, meseCorrente }: StoricoTariffeProps) {
  const [modulo, setModulo] = useState<ModuloAperto | null>(null);
  const {
    elenco: vociInElenco,
    salvataggioInCorso,
    muta,
    avvisi,
    chiudiAvviso,
  } = useMutazioniElenco<VoceInElenco[], MutazioneTariffe>(voci, applicaMutazioneTariffe);

  // Un salvataggio rifiutato riapre il proprio modulo solo se nel frattempo
  // l'utente non ne ha aperto un altro: altrimenti l'esito diventa un avviso.
  const moduloAperto = useRef(false);
  useEffect(() => {
    moduloAperto.current = modulo !== null;
  }, [modulo]);
  const ultimaProvvisoria = useRef(0);

  const inVigore = tariffaValidaNelMese(vociInElenco, meseCorrente);
  const periodi = periodiDiValidita(vociInElenco);
  const piuVecchia = vociInElenco.at(-1);

  function salva(datiForm: FormData, voce: VoceStoricoTariffa | null, dati: DatiTariffaValidi) {
    ultimaProvvisoria.current += 1;
    const provvisoria: VoceInElenco = {
      // La modifica resta sulla riga della voce; una nuova voce ha una chiave
      // temporanea finché il server non le assegna l'id.
      id: voce?.id ?? `provvisoria-${ultimaProvvisoria.current}`,
      validaDalMese: dati.validaDalMese,
      validaAlMese: dati.validaAlMese,
      modalita: dati.modalita,
      importo: normalizzaTariffaGiornaliera(dati.importo)?.valore ?? dati.importo,
      inAttesa: true,
    };
    const valori = valoriTestuali(datiForm);
    const operazione = `Il salvataggio della tariffa da ${etichettaMeseTariffa(dati.validaDalMese)} non è riuscito`;

    setModulo(null);
    muta(
      { tipo: "salva", voce: provvisoria, idSostituito: voce?.id ?? null },
      () => salvaTariffaCollaboratore(statoIniziale, datiForm),
      {
        operazione,
        alRifiuto: (esito) => {
          if (moduloAperto.current) return false;
          const errori =
            Object.keys(esito.errori).length > 0
              ? esito.errori
              : { _form: messaggioMutazioneNonRiuscita(operazione, esito.motivo) };
          setModulo({ voce, valori, errori });
          return true;
        },
      },
    );
  }

  function elimina(voce: VoceStoricoTariffa) {
    const datiForm = new FormData();
    datiForm.set("collaboratoreId", collaboratoreId);
    datiForm.set("tariffaId", voce.id);
    muta(
      { tipo: "elimina", tariffaId: voce.id },
      () => eliminaTariffaCollaboratore(statoIniziale, datiForm),
      {
        operazione: `L'eliminazione della tariffa da ${etichettaMeseTariffa(voce.validaDalMese)} non è riuscita`,
      },
    );
  }

  return (
    <section
      aria-labelledby="titolo-storico-tariffe"
      aria-busy={salvataggioInCorso}
      className="mb-[22px]"
    >
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titolo-storico-tariffe" className="text-[17px] font-semibold tracking-tight text-testo-principale">
            Storico tariffe
          </h2>
          <p className="mt-[1px] text-sm text-testo-metadati">
            Ogni tariffa vale dal mese indicato fino alla successiva
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModulo({ voce: null })}
          className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[14px] py-[9px] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuova tariffa
        </button>
      </div>

      <AvvisiMutazioni avvisi={avvisi} onChiudi={chiudiAvviso} className="mb-[14px]" />

      <div className="overflow-hidden rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full border-collapse text-sm" aria-label="Storico tariffe">
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
            {vociInElenco.map((voce) => (
              <tr
                key={voce.id}
                className={`border-t border-zinc-100 dark:border-zinc-800 ${voce === inVigore ? "bg-indigo-50/40 dark:bg-indigo-500/5" : ""} ${
                  voce.inAttesa ? CLASSE_ELEMENTO_IN_ATTESA : ""
                }`}
              >
                <td className="px-4 py-[12px] align-middle font-semibold text-testo-principale">
                  {etichettaMeseTariffa(voce.validaDalMese)}
                  {voce === inVigore && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-[8px] py-[2px] text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      in vigore
                    </span>
                  )}
                </td>
                <td className="px-4 py-[12px] align-middle">
                  <BadgeModalita modalita={voce.modalita} />
                </td>
                <td className="px-4 py-[12px] text-right align-middle tabular-nums whitespace-nowrap text-testo-principale">
                  {descriviImportoTariffa(voce.modalita, voce.importo)}
                </td>
                <td className="px-4 py-[12px] align-middle text-testo-metadati">{periodi.get(voce)}</td>
                <td className="px-4 py-[12px] text-right align-middle whitespace-nowrap">
                  {voce.inAttesa ? (
                    // In attesa di conferma: nessuna azione, solo lo stato del salvataggio.
                    <IndicatoreSalvataggio />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setModulo({ voce })}
                        className={classeAzioneRiga}
                        aria-label={`Modifica tariffa da ${etichettaMeseTariffa(voce.validaDalMese)}`}
                      >
                        Modifica
                      </button>
                      {voce !== piuVecchia && (
                        <button
                          type="button"
                          onClick={() => elimina(voce)}
                          className="inline-flex items-center rounded-[8px] px-2 py-[5px] font-[inherit] text-sm font-medium text-testo-secondario transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          aria-label={`Elimina tariffa da ${etichettaMeseTariffa(voce.validaDalMese)}`}
                        >
                          Elimina
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {modulo !== null && (
          <ModuloTariffa
            // Una nuova istanza per ogni voce: valori e stato ripartono puliti.
            key={modulo.voce?.id ?? "nuova"}
            voce={modulo.voce}
            valoriIniziali={modulo.valori}
            erroriIniziali={modulo.errori}
            collaboratoreId={collaboratoreId}
            meseCorrente={meseCorrente}
            onSalva={salva}
            onChiudi={() => setModulo(null)}
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
      : modalita === "PERCENTUALE"
        ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
        : "bg-zinc-100 text-testo-secondario dark:bg-zinc-800";
  return (
    <span className={`rounded-full px-[9px] py-[3px] text-xs font-medium whitespace-nowrap ${colori}`}>
      {ETICHETTA_MODALITA_TARIFFA[modalita]}
    </span>
  );
}

function campo(datiForm: FormData, nome: string): string {
  return ((datiForm.get(nome) as string | null) ?? "").trim();
}

function ModuloTariffa({
  collaboratoreId,
  voce,
  valoriIniziali,
  erroriIniziali,
  meseCorrente,
  onSalva,
  onChiudi,
}: {
  collaboratoreId: string;
  voce: VoceStoricoTariffa | null;
  valoriIniziali?: Record<string, string>;
  erroriIniziali?: Record<string, string>;
  meseCorrente: string;
  onSalva: (datiForm: FormData, voce: VoceStoricoTariffa | null, dati: DatiTariffaValidi) => void;
  onChiudi: () => void;
}) {
  const [errori, setErrori] = useState<Record<string, string>>(erroriIniziali ?? {});
  const [modalita, setModalita] = useState<ModalitaTariffa>(() => {
    const riproposta = valoriIniziali?.modalita;
    return riproposta && eModalitaTariffa(riproposta) ? riproposta : voce?.modalita ?? "GIORNALIERA";
  });

  function valoreIniziale(nomeCampo: string, valoreOriginale: string): string {
    return valoriIniziali?.[nomeCampo] ?? valoreOriginale;
  }

  // Validazione lato client (validaVoceTariffa è pura): i campi errati tengono
  // il modulo aperto; un invio valido chiude il modulo e mostra subito la
  // tariffa al suo posto, in attesa della conferma del server.
  function invia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datiForm = new FormData(evento.currentTarget);
    const dati = {
      validaDalMese: campo(datiForm, "validaDalMese"),
      validaAlMese: campo(datiForm, "validaAlMese") || null,
      modalita: campo(datiForm, "modalita"),
      importo: campo(datiForm, "importo"),
    };
    const erroriCampi = validaVoceTariffa(dati);
    if (Object.keys(erroriCampi).length > 0 || !eModalitaTariffa(dati.modalita)) {
      setErrori(erroriCampi);
      return;
    }
    onSalva(datiForm, voce, { ...dati, modalita: dati.modalita });
  }

  const classeCampo =
    "w-full rounded-[9px] border border-zinc-200 bg-white px-3 py-[8px] text-sm text-testo-principale outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-indigo-500/20";
  const classeEtichetta = "mb-1 block text-xs font-medium text-testo-metadati";

  return (
    <form
      onSubmit={invia}
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
            aria-invalid={Boolean(errori.validaDalMese)}
            aria-describedby="tariffa-valida-dal-mese-errore"
            className={classeCampo}
          />
          <ErroreCampo id="tariffa-valida-dal-mese-errore" messaggio={errori.validaDalMese} />
          <label htmlFor="tariffa-valida-al-mese" className={classeEtichetta}>Valida fino al mese (facoltativo)</label>
          <input id="tariffa-valida-al-mese" type="month" name="validaAlMese"
            defaultValue={valoreIniziale("validaAlMese", voce?.validaAlMese ?? "")}
            aria-invalid={Boolean(errori.validaAlMese)}
            aria-describedby="tariffa-valida-al-mese-errore" className={classeCampo} />
          <ErroreCampo id="tariffa-valida-al-mese-errore" messaggio={errori.validaAlMese} />
        </div>

        <fieldset>
          <legend className={classeEtichetta}>Modalità</legend>
          <div className="inline-flex overflow-hidden rounded-[9px] border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {MODALITA_TARIFFA.map((valore) => (
              <label
                key={valore}
                className={`cursor-pointer px-3 py-[8px] text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300 ${
                  modalita === valore ? "bg-indigo-500 text-white" : "text-testo-secondario"
                }`}
              >
                <input
                  type="radio"
                  name="modalita"
                  value={valore}
                  defaultChecked={modalita === valore}
                  onChange={() => setModalita(valore)}
                  className="sr-only"
                />
                {ETICHETTA_MODALITA_TARIFFA[valore]}
              </label>
            ))}
          </div>
          <ErroreCampo id="tariffa-modalita-errore" messaggio={errori.modalita} />
        </fieldset>

        <div>
          <label htmlFor="tariffa-importo" className={classeEtichetta}>
            {modalita === "PERCENTUALE"
              ? "Percentuale trattenuta (%)"
              : `Importo (€ ${UNITA_TARIFFA[modalita]})`}
          </label>
          <input
            id="tariffa-importo"
            name="importo"
            inputMode="decimal"
            autoComplete="off"
            placeholder={modalita === "PERCENTUALE" ? "Es. 20" : "Es. 450,00"}
            required
            defaultValue={valoreIniziale("importo", voce ? voce.importo.replace(".", ",") : "")}
            aria-invalid={Boolean(errori.importo)}
            aria-describedby="tariffa-importo-errore"
            className={classeCampo}
          />
          <ErroreCampo id="tariffa-importo-errore" messaggio={errori.importo} />
        </div>

        <div className="flex gap-2 md:mt-[22px]">
          <button
            type="submit"
            className="rounded-[9px] bg-indigo-500 px-4 py-[8px] text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600"
          >
            Salva tariffa
          </button>
          <button
            type="button"
            onClick={onChiudi}
            className="rounded-[9px] border border-zinc-200 bg-white px-4 py-[8px] text-sm font-medium text-testo-secondario transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Annulla
          </button>
        </div>
      </div>

      <ErroreCampo id="tariffa-errore" messaggio={errori._form} />

      <p className="mt-3 text-xs text-testo-metadati">
        Una sola tariffa per mese. Inserire o modificare una tariffa di un mese passato ricalcola
        riepiloghi e marginalità di quei mesi.
      </p>
    </form>
  );
}

function ErroreCampo({ id, messaggio }: { id: string; messaggio?: string }) {
  if (!messaggio) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
      {messaggio}
    </p>
  );
}
