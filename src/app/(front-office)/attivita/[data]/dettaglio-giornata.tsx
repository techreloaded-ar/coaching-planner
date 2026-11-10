"use client";

import { useState, useCallback, useEffect, useMemo, useTransition, useRef, type ReactNode } from "react";
import {
  creaRiga,
  modificaRiga,
  eliminaRiga,
  rimuoviRimborsoTrasferta,
} from "@/lib/actions/righe-attivita";
import {
  AvvisoOffertaNonAbilitata,
  BadgeCategoriaAttivita,
  CLASSE_RIGA_OFFERTA_NON_ABILITATA,
  IconaOffertaNonAbilitata,
  IndicatoreGiorniErogati,
  PulsanteAttesa,
} from "@/components";
import {
  CATEGORIA_ATTIVITA_PREDEFINITA,
  CATEGORIE_ATTIVITA,
  DESCRIZIONE_CATEGORIA_ATTIVITA,
  eNumeroDecimale,
  ETICHETTA_OFFERTA_DA_DEFINIRE,
  fatturataDalCollaboratore,
  haPiuDiDueDecimali,
  MESSAGGIO_ORE_TROPPI_DECIMALI,
  sommaOre,
  type CategoriaAttivita,
} from "@/domain/types";
import { SelettoreDuplicazione } from "./selettore-duplicazione";
import { SezioneProposteCalendario, useProposteCalendario } from "./proposte-calendario";
import type {
  RigaAttivitaClient,
  PropostaCalendarioClient,
  ClienteSelect,
  ClienteSelezionabile,
  VoceRimborsoTrasfertaSelezionabile,
} from "@/lib/attivita-contract";
import {
  ErroreSessioneAttivita,
  useCacheCalendario,
  useCacheGiornate,
  useCollaboratoreConsultato,
  useLetturaOfferteCliente,
  type ApiOfferteCliente,
  type OffertaAttivaCliente,
} from "../attivita-cache-provider";
import { formattaEuro, formattaNumeroOre, formattaOre } from "@/lib/formattazione";

// ── Tipi ────────────────────────────────────────────────────────

type OffertaSelect = OffertaAttivaCliente;

/** Etichetta di un'offerta nella tendina: codice e descrizione. */
function etichettaOfferta(offerta: OffertaSelect): string {
  return [offerta.codice, offerta.descrizione].filter(Boolean).join(" — ");
}

interface DettaglioGiornataProps {
  /** Data in formato YYYY-MM-DD della giornata mostrata */
  data: string;
  /** Righe già registrate per la giornata mostrata */
  righe: RigaAttivitaClient[];
  /** Tutti i clienti per la select, con i consigliati marcati */
  clienti: ClienteSelezionabile[];
  /** Voci di rimborso trasferta selezionabili nel form */
  vociRimborso: VoceRimborsoTrasfertaSelezionabile[];
  /** Il collaboratore ha collegato il calendario Google: mostra le proposte */
  calendarioCollegato?: boolean;
  /** Foglio di un collaboratore disattivato: righe visibili, nessuna modifica. */
  solaLettura?: boolean;
  /** Nome del collaboratore il cui foglio è consultato da un amministratore, `null` sul proprio foglio. */
  nomeCollaboratoreConsultato?: string | null;
  /** Riga da aprire subito nel form di modifica, se è tra le righe del giorno. */
  rigaDaAprireInModifica?: string | null;
  /** Notifica che la riga richiesta è stata aperta (o non c'è): non va riaperta. */
  onRigaApertaInModifica?: () => void;
  /**
   * Notifica all'isola che una riga della giornata è stata creata, modificata
   * o eliminata, così le cache della scheda possano rileggere il dato.
   *
   * Riceve il giorno **visualizzato**, che dopo un cambio giorno client può
   * differire da quello dell'ultimo payload prodotto dal server, ed
   * eventualmente gli altri giorni toccati da una mutazione multi-giorno
   * (la duplicazione di una riga su più giornate).
   */
  onMutazioneCompletata: (
    giorno: string,
    giorniAggiuntivi?: readonly string[]
  ) => void | Promise<void>;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Valore della tendina che significa "non toccare il rimborso già fotografato
 * sulla riga": distinto sia da "" (rimuovi il rimborso) sia dall'id di una voce
 * (rifotografa quella voce). Con questo valore il campo non viene nemmeno
 * inviato nel FormData, così `modificaRiga` lascia la riga com'è.
 */
const SELEZIONE_RIMBORSO_INVARIATO = "invariato";

/**
 * Legge le offerte attive di un cliente dal confine HTTP dell'area
 * attività, per il cascade select cliente → offerta.
 *
 * È una `fetch` e non una Server Action deliberatamente: la risposta di una
 * Server Action riconcilia l'albero RSC del router con l'URL corrente e, dopo
 * un cambio giorno scritto con la History API, quella riconciliazione rimonta
 * la pagina azzerando il form in compilazione. Una lettura HTTP non tocca
 * l'albero del router.
 *
 * Quando la scheda ha il provider delle letture attività — il caso normale
 * dentro l'isola — la lettura passa di lì, così una sessione decaduta finisce
 * nel canale di sessione della scheda e produce la navigazione completa
 * promessa dall'area, invece di una tendina che si svuota in silenzio. Il
 * percorso diretto resta per il caso senza provider.
 */
async function leggiOffertePerCliente(
  clienteId: string,
  letturaCondivisa: ApiOfferteCliente | null
): Promise<OffertaSelect[]> {
  if (letturaCondivisa) {
    return letturaCondivisa.leggi(clienteId);
  }

  const risposta = await fetch(
    `/api/attivita/offerte-cliente?cliente=${encodeURIComponent(clienteId)}`,
    { headers: { Accept: "application/json" }, credentials: "same-origin" }
  );

  if (!risposta.ok) {
    throw new Error(`Lettura delle offerte non riuscita (HTTP ${risposta.status})`);
  }

  const dati = (await risposta.json()) as { offerte: OffertaSelect[] };
  return dati.offerte;
}

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
  if (isNaN(Number(normalizzato)) || !eNumeroDecimale(normalizzato)) return "Valore non valido";
  if (Number(normalizzato) <= 0) return "Inserisci un numero maggiore di zero";
  if (Number(normalizzato) > 24) return "Non può superare 24 ore";
  if (haPiuDiDueDecimali(normalizzato)) return MESSAGGIO_ORE_TROPPI_DECIMALI;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Classi condivise, icone e avviso di abilitazione mancante
// ═══════════════════════════════════════════════════════════════

// Classi condivise del form e delle azioni di riga: controlli alti 40px; le
// azioni di riga scendono a 32px solo da sm, dove non serve l'area touch.
const CLASSE_ETICHETTA = "mb-1.5 block text-[13px] font-medium text-testo-secondario";
const CLASSE_ETICHETTA_DETTAGLIO = "mb-1 block text-xs font-medium text-testo-secondario";
const CLASSE_OBBLIGATORIO = "text-rose-700 dark:text-rose-400";
const CLASSE_CAMPO =
  "block h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-testo-principale transition-colors focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-900";
const CLASSE_AZIONE_RIGA =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-testo-secondario transition-colors hover:bg-zinc-50 hover:text-testo-principale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:h-8 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

function IconaInfo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="mt-0.5 h-4 w-4 flex-none"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6h.01" />
    </svg>
  );
}

function IconaRimborso() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className="h-3.5 w-3.5 flex-none text-testo-metadati"
    >
      <path d="M6 17h12l1.5-5.5A2 2 0 0 0 17.6 9H6.4a2 2 0 0 0-1.9 2.5L6 17Z" />
      <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </svg>
  );
}

/**
 * Box di avviso: nessun cliente con offerte attive, oppure offerta
 * selezionata su cui il collaboratore non è abilitato (non bloccante).
 */
function AvvisoAbilitazioneMancante({
  testId,
  className = "",
  children,
}: {
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${className}`}
    >
      <IconaInfo />
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

export default function DettaglioGiornata({
  data,
  righe,
  clienti,
  vociRimborso,
  calendarioCollegato = false,
  solaLettura = false,
  nomeCollaboratoreConsultato = null,
  rigaDaAprireInModifica = null,
  onRigaApertaInModifica,
  onMutazioneCompletata,
}: DettaglioGiornataProps) {
  const [isPending, startTransition] = useTransition();
  // Foglio di un altro collaboratore aperto da un amministratore: le Server
  // Action lo ricevono e ne verificano l'autorizzazione.
  const collaboratoreConsultatoId = useCollaboratoreConsultato();
  const cacheCalendario = useCacheCalendario();
  const cacheGiornate = useCacheGiornate();

  /**
   * Notifica la mutazione all'isola, che possiede le cache della scheda.
   *
   * La transizione tiene l'attesa continua dal click fino ai dati aggiornati a
   * schermo: l'isola aggiorna la vista dentro questo scope.
   */
  const invalidaDopoMutazione = useCallback(
    (giorniAggiuntivi?: readonly string[]) => {
      startTransition(async () => {
        await onMutazioneCompletata(data, giorniAggiuntivi);
      });
    },
    [data, onMutazioneCompletata]
  );

  // L'abilitazione cambia il giallo di tutte le righe dell'offerta, in ogni
  // mese e giornata già in cache: si svuotano e si rilegge il giorno mostrato.
  const dopoAbilitazione = () => {
    cacheCalendario?.clear();
    cacheGiornate?.clear();
    invalidaDopoMutazione();
  };

  // ── Stato form ─────────────────────────────────────────────
  const [clienteId, setClienteId] = useState("");
  const [offertaId, setOffertaId] = useState("");
  const [ore, setOre] = useState("");
  const [erroreOre, setErroreOre] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaAttivita>(
    CATEGORIA_ATTIVITA_PREDEFINITA,
  );
  const [nota, setNota] = useState("");
  const [erroreSubmit, setErroreSubmit] = useState<string | null>(null);

  // Attesa del salvataggio: copre l'intera chiamata alla server action, mentre
  // `isPending` copre la successiva rilettura della giornata fatta dall'isola.
  // Insieme rendono l'attesa continua dal click fino ai dati aggiornati a
  // schermo.
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  // Riga su cui è in corso un'azione (modifica, eliminazione, rimozione
  // trasferta): ne disabilita i pulsanti così da escludere i doppi click.
  const [rigaInAttesaId, setRigaInAttesaId] = useState<string | null>(null);

  // Selezione della voce di rimborso: "" = nessun rimborso, l'id di una voce
  // = rimborso da fotografare, SELEZIONE_RIMBORSO_INVARIATO = lascia intatto
  // quello già fotografato sulla riga in modifica.
  const [selezioneRimborso, setSelezioneRimborso] = useState("");

  // Modalità modifica
  const [modificaId, setModificaId] = useState<string | null>(null);

  // Proposte dal calendario e proposta aperta nel form ("Modifica" su una
  // proposta): al salvataggio la riga creata marca l'evento come gestito.
  const proposteCalendario = useProposteCalendario(data, calendarioCollegato);
  const rimuoviProposta = proposteCalendario.rimuovi;
  const [eventoDaProposta, setEventoDaProposta] = useState<string | null>(null);

  // Riga per cui è aperto il selettore di duplicazione: `null` = pannello chiuso.
  const [rigaDaDuplicare, setRigaDaDuplicare] =
    useState<RigaAttivitaClient | null>(null);

  // Esito dell'ultima duplicazione riuscita, mostrato nel banner sopra
  // l'elenco delle righe finché il collaboratore non lo chiude (o finché il
  // cambio giorno non rimonta il componente).
  const [esitoDuplicazione, setEsitoDuplicazione] = useState<{
    giorniCreati: number;
    giorni: string[];
  } | null>(null);

  // Cascade select: offerte del cliente selezionato
  const [offerte, setOfferte] = useState<OffertaSelect[]>([]);
  const [offerteLoading, setOfferteLoading] = useState(false);
  // Una risposta di una modifica annullata o di un cliente precedente non
  // deve sovrascrivere il form corrente, né terminarne il caricamento.
  const revisioneLetturaOfferte = useRef(0);
  // Lettura delle offerte non riuscita: l'elenco vuoto non basta a spiegarlo.
  const [erroreOfferte, setErroreOfferte] = useState<string | null>(null);
  const letturaOfferteCliente = useLetturaOfferteCliente();

  // Cliente della riga storica aperta in modifica: resta selezionabile anche
  // se il collaboratore non è più abilitato su alcuna sua offerta (US-049 AC-3)
  const [clienteRigaInModifica, setClienteRigaInModifica] =
    useState<ClienteSelect | null>(null);

  // ── Riepilogo ──────────────────────────────────────────────

  const riepilogo = useMemo(() => {
    const nRighe = righe.length;
    const oreTotali = sommaOre(...righe.map((r) => r.ore));
    const oreDaFatturare = sommaOre(
      ...righe
        .filter((r) => fatturataDalCollaboratore(r.categoria))
        .map((r) => r.ore),
    );
    const totaleRimborsi = righe.reduce((s, r) => {
      if (r.rimborsoTrasfertaImporto == null) return s;
      const importo = parseFloat(r.rimborsoTrasfertaImporto);
      return s + (isNaN(importo) ? 0 : importo);
    }, 0);
    return { nRighe, oreTotali, oreDaFatturare, totaleRimborsi };
  }, [righe]);

  const avanzamentoOffertaSelezionata = offerte.find(
    (offerta) => offerta.id === offertaId
  )?.avanzamento;

  // ── Offerta selezionata non abilitata ──────────────────────

  // Avviso non bloccante: il collaboratore può registrare ore su un'offerta
  // attiva a cui non è abilitato. L'offerta storica di una riga in modifica,
  // non più attiva, non ha il flag e non mostra l'avviso.
  const offertaSelezionataNonAbilitata =
    offerte.find((offerta) => offerta.id === offertaId)?.abilitata === false;

  // Gruppi della tendina offerta: abilitate, non abilitate e, in modifica,
  // l'eventuale offerta storica non più attiva della riga.
  const offerteRaggruppate = useMemo(
    () => ({
      abilitate: offerte.filter((o) => o.abilitata === true),
      nonAbilitate: offerte.filter((o) => o.abilitata === false),
      storiche: offerte.filter((o) => o.abilitata === undefined),
    }),
    [offerte]
  );

  // ── Clienti selezionabili e assenza di clienti con offerte attive ─

  // La select elenca i clienti con almeno un'offerta attiva, in due gruppi: i
  // consigliati (con offerte abilitate per il collaboratore) e gli altri. In
  // modifica, il cliente della riga storica viene aggiunto agli altri se
  // assente dall'elenco, così da restare visibile e selezionato.
  const clientiSelezionabili = useMemo(() => {
    const elenco =
      !clienteRigaInModifica ||
      clienti.some((c) => c.id === clienteRigaInModifica.id)
        ? clienti
        : [...clienti, { ...clienteRigaInModifica, consigliato: false }];
    return {
      consigliati: elenco.filter((c) => c.consigliato),
      altri: elenco.filter((c) => !c.consigliato),
    };
  }, [clienti, clienteRigaInModifica]);

  // Nessun cliente con offerte attive in modalità "Nuova riga": al posto della
  // select compare un messaggio esplicito e il salvataggio non è disponibile
  const nessunClienteConOfferteAttive = clienti.length === 0 && modificaId === null;

  // ── Preview della voce di rimborso selezionata ─────────────

  const voceRimborsoSelezionata = useMemo(() => {
    if (selezioneRimborso === "" || selezioneRimborso === SELEZIONE_RIMBORSO_INVARIATO) {
      return null;
    }
    return vociRimborso.find((voce) => voce.id === selezioneRimborso) ?? null;
  }, [selezioneRimborso, vociRimborso]);

  // Riga aperta in modifica: serve a mostrare il rimborso già fotografato
  // accanto alla tendina, senza che il select lo rappresenti come opzione.
  const rigaInModifica = useMemo(
    () => (modificaId ? righe.find((r) => r.id === modificaId) ?? null : null),
    [modificaId, righe]
  );

  // ── Cascade select cliente → offerte ───────────────────────

  const handleCambioCliente = useCallback(
    async (nuovoClienteId: string) => {
      const revisioneRichiesta = ++revisioneLetturaOfferte.current;
      setRigaInAttesaId(null);
      setClienteId(nuovoClienteId);
      setOffertaId("");
      setOfferte([]);
      setErroreOfferte(null);

      if (!nuovoClienteId) {
        setOfferteLoading(false);
        return;
      }

      setOfferteLoading(true);
      try {
        const offerteCaricate = await leggiOffertePerCliente(nuovoClienteId, letturaOfferteCliente);
        if (revisioneRichiesta !== revisioneLetturaOfferte.current) return;
        setOfferte(offerteCaricate);
      } catch (causa) {
        if (revisioneRichiesta !== revisioneLetturaOfferte.current) return;
        // La sessione decaduta è già stata riconosciuta dal canale di sessione
        // della scheda, che porta a una navigazione completa: qui non c'è nulla
        // da mostrare, la pagina sta per essere abbandonata.
        if (causa instanceof ErroreSessioneAttivita) return;

        // Ogni altro errore va detto: un elenco vuoto significherebbe
        // «nessuna offerta abilitata», che è un'informazione diversa.
        setErroreOfferte(
          "Non è stato possibile caricare le offerte di questo cliente."
        );
      } finally {
        if (revisioneRichiesta === revisioneLetturaOfferte.current) {
          setOfferteLoading(false);
        }
      }
    },
    [letturaOfferteCliente]
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

      if (!clienteId || !ore) {
        setErroreSubmit("Compila tutti i campi obbligatori");
        return;
      }

      // L'offerta è obbligatoria (vincolo applicativo, verificato anche dal server).
      if (!offertaId) {
        setErroreSubmit("L'offerta è obbligatoria");
        return;
      }

      // Validazione ore server-side
      const err = validaOreLocale(ore);
      if (err) {
        setErroreOre(err);
        return;
      }

      const fd = new FormData();
      if (collaboratoreConsultatoId) {
        fd.append("collaboratoreConsultatoId", collaboratoreConsultatoId);
      }
      fd.append("clienteId", clienteId);
      fd.append("offertaId", offertaId);
      fd.append("ore", ore.replace(",", "."));
      fd.append("data", data);
      if (nota) fd.append("nota", nota);
      fd.append("categoria", categoria);
      // Il campo viene omesso quando la tendina è su "invariato": è l'assenza
      // stessa del campo a dire a `modificaRiga` di non rifotografare nulla.
      if (selezioneRimborso !== SELEZIONE_RIMBORSO_INVARIATO) {
        fd.append("voceRimborsoTrasfertaId", selezioneRimborso);
      }

      // Il `finally` chiude l'attesa anche quando l'action rifiuta la riga: il
      // messaggio di errore compare con i campi ancora compilati e il pulsante
      // di nuovo abilitato per un secondo tentativo.
      setSalvataggioInCorso(true);
      try {
        if (modificaId) {
          fd.append("rigaId", modificaId);
          const result = await modificaRiga(fd);
          if (!result.success) {
            setErroreSubmit(result.error ?? "Errore nella modifica");
            return;
          }
        } else {
          if (eventoDaProposta) fd.append("eventoCalendarioId", eventoDaProposta);
          const result = await creaRiga(fd);
          if (!result.success) {
            setErroreSubmit(result.error ?? "Errore nella creazione");
            return;
          }
        }
      } finally {
        setSalvataggioInCorso(false);
      }

      // Aggiorna i dati server e invalida il mese nella cache del calendario
      invalidaDopoMutazione();
      if (!modificaId && eventoDaProposta) {
        rimuoviProposta(eventoDaProposta);
      }

      // Reset form
      setEventoDaProposta(null);
      setClienteId("");
      setOffertaId("");
      setOre("");
      setErroreOre(null);
      setCategoria(CATEGORIA_ATTIVITA_PREDEFINITA);
      setNota("");
      setSelezioneRimborso("");
      setModificaId(null);
      setOfferte([]);
      setErroreSubmit(null);
      setClienteRigaInModifica(null);
    },
    [clienteId, offertaId, ore, nota, categoria, selezioneRimborso, data, modificaId, invalidaDopoMutazione, eventoDaProposta, rimuoviProposta, collaboratoreConsultatoId]
  );

  // ── Modifica riga ──────────────────────────────────────────

  const handleModifica = useCallback(
    async (riga: RigaAttivitaClient) => {
      const revisioneRichiesta = ++revisioneLetturaOfferte.current;
      setEventoDaProposta(null);
      setModificaId(riga.id);
      setClienteId(riga.cliente.id);
      setOffertaId("");
      setOfferte([]);
      setClienteRigaInModifica({
        id: riga.cliente.id,
        ragioneSociale: riga.cliente.ragioneSociale,
      });
      setCategoria(riga.categoria);
      setOre(riga.ore.toString().replace(".", ","));
      setNota(riga.nota ?? "");
      setSelezioneRimborso(SELEZIONE_RIMBORSO_INVARIATO);
      setErroreOre(null);
      setErroreSubmit(null);
      setErroreOfferte(null);

      // Carica le offerte di quel cliente
      setRigaInAttesaId(riga.id);
      setOfferteLoading(true);
      try {
        const offerteCaricate = await leggiOffertePerCliente(
          riga.cliente.id,
          letturaOfferteCliente
        );
        if (revisioneRichiesta !== revisioneLetturaOfferte.current) return;
        const offertaRiga = riga.offerta;
        setOfferte(
          !offertaRiga || offerteCaricate.some((o) => o.id === offertaRiga.id)
            ? offerteCaricate
            : [...offerteCaricate, offertaRiga]
        );
        setOffertaId(offertaRiga?.id ?? "");
      } catch (causa) {
        if (revisioneRichiesta !== revisioneLetturaOfferte.current) return;
        // Sessione decaduta: la navigazione completa è già in corso.
        if (causa instanceof ErroreSessioneAttivita) return;

        // La riga resta modificabile con la propria offerta storica, ma
        // l'elenco è incompleto e l'utente deve saperlo.
        setOfferte(riga.offerta ? [riga.offerta] : []);
        setOffertaId(riga.offerta?.id ?? "");
        setErroreOfferte(
          "Non è stato possibile caricare le offerte di questo cliente."
        );
      } finally {
        if (revisioneRichiesta === revisioneLetturaOfferte.current) {
          setOfferteLoading(false);
          setRigaInAttesaId(null);
        }
      }

      // Scroll al form
      document.getElementById("form-riga")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [letturaOfferteCliente]
  );

  // Apertura diretta in modifica dal link «Modifica» dell'Elenco attività.
  // Differita a un timer: `handleModifica` imposta lo stato del form, cosa che
  // il corpo di un effect non deve fare in modo sincrono.
  useEffect(() => {
    if (!rigaDaAprireInModifica) return;
    const riga = righe.find((r) => r.id === rigaDaAprireInModifica);
    const apertura = setTimeout(() => {
      onRigaApertaInModifica?.();
      if (riga && !solaLettura) void handleModifica(riga);
    });
    return () => clearTimeout(apertura);
  }, [rigaDaAprireInModifica, onRigaApertaInModifica, righe, solaLettura, handleModifica]);

  // ── Modifica di una proposta dal calendario ────────────────
  //
  // Apre il form in modalità "nuova riga" precompilato con la proposta: ore,
  // nota (titolo dell'evento), categoria predefinita e, se associati, cliente e offerta.

  const handleModificaProposta = useCallback(
    async (proposta: PropostaCalendarioClient) => {
      const revisioneRichiesta = ++revisioneLetturaOfferte.current;
      setRigaInAttesaId(null);
      setOfferteLoading(false);
      setModificaId(null);
      setEventoDaProposta(proposta.eventoId);
      setClienteId(proposta.cliente?.id ?? "");
      setClienteRigaInModifica(null);
      setOffertaId("");
      setOfferte([]);
      setOre(proposta.ore.toString().replace(".", ","));
      setNota(proposta.titolo);
      setCategoria(CATEGORIA_ATTIVITA_PREDEFINITA);
      setSelezioneRimborso("");
      setErroreOre(null);
      setErroreSubmit(null);
      setErroreOfferte(null);

      document.getElementById("form-riga")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      if (!proposta.cliente) return;

      setOfferteLoading(true);
      try {
        const offerteCaricate = await leggiOffertePerCliente(
          proposta.cliente.id,
          letturaOfferteCliente
        );
        if (revisioneRichiesta !== revisioneLetturaOfferte.current) return;
        setOfferte(offerteCaricate);
        if (proposta.offerta && offerteCaricate.some((o) => o.id === proposta.offerta!.id)) {
          setOffertaId(proposta.offerta.id);
        }
      } catch (causa) {
        if (revisioneRichiesta !== revisioneLetturaOfferte.current) return;
        if (causa instanceof ErroreSessioneAttivita) return;
        setErroreOfferte(
          "Non è stato possibile caricare le offerte di questo cliente."
        );
      } finally {
        if (revisioneRichiesta === revisioneLetturaOfferte.current) {
          setOfferteLoading(false);
        }
      }
    },
    [letturaOfferteCliente]
  );

  // ── Annulla modifica ───────────────────────────────────────

  const handleAnnulla = useCallback(() => {
    revisioneLetturaOfferte.current += 1;
    setOfferteLoading(false);
    setRigaInAttesaId(null);
    setEventoDaProposta(null);
    setModificaId(null);
    setClienteId("");
    setOffertaId("");
    setOre("");
    setErroreOre(null);
    setCategoria(CATEGORIA_ATTIVITA_PREDEFINITA);
    setNota("");
    setSelezioneRimborso("");
    setOfferte([]);
    setErroreSubmit(null);
    setErroreOfferte(null);
    setClienteRigaInModifica(null);
  }, []);

  // ── Reset dello stato al cambio giorno ───────────────────────
  //
  // Il reset di un'eventuale modifica in corso quando cambia il giorno
  // visualizzato (altrimenti un submit successivo aggiornerebbe silenziosamente
  // una riga del giorno precedente, dato che `modificaRiga` non valida
  // l'appartenenza della riga al giorno visualizzato) è delegato al remount
  // del componente: `isola-giornata.tsx` passa `key={giornoVisualizzato}` a
  // `<DettaglioGiornata>`, così React azzera tutto lo stato locale
  // (equivalente a `handleAnnulla`) ad ogni cambio giorno, senza richiamare
  // setState in modo sincrono dentro un effect (vietato da
  // `react-hooks/set-state-in-effect`).

  // ── Elimina riga ───────────────────────────────────────────

  const handleElimina = useCallback(
    async (rigaId: string) => {
      if (!confirm("Eliminare questa riga attività?")) return;

      setRigaInAttesaId(rigaId);
      try {
        const result = await eliminaRiga(rigaId, collaboratoreConsultatoId);
        if (result.success) {
          invalidaDopoMutazione();
        }
      } finally {
        setRigaInAttesaId(null);
      }
    },
    [collaboratoreConsultatoId, invalidaDopoMutazione]
  );

  // ── Rimuovi rimborso ───────────────────────────────────────

  const handleRimuoviRimborso = useCallback(
    async (rigaId: string) => {
      if (!confirm("Rimuovere il rimborso da questa riga?")) return;

      setRigaInAttesaId(rigaId);
      try {
        const result = await rimuoviRimborsoTrasferta(
          rigaId,
          collaboratoreConsultatoId
        );
        if (result.success) {
          invalidaDopoMutazione();
        }
      } finally {
        setRigaInAttesaId(null);
      }
    },
    [collaboratoreConsultatoId, invalidaDopoMutazione]
  );

  // ── Duplicazione su più giorni ─────────────────────────────

  /**
   * Chiude il selettore, mostra l'esito e — soprattutto — porta i giorni di
   * destinazione fino all'isola: `invalidaDopoMutazione` li inoltra come
   * `giorniAggiuntivi`, ed è da lì che discende l'invalidazione anche dei mesi
   * diversi da quello della giornata visualizzata.
   */
  const gestisciDuplicazione = useCallback(
    (giorniDestinazione: string[], giorniCreati: number) => {
      setRigaDaDuplicare(null);
      setEsitoDuplicazione({ giorniCreati, giorni: giorniDestinazione });
      invalidaDopoMutazione(giorniDestinazione);
    },
    [invalidaDopoMutazione]
  );

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════

  return (
    <>
      {/* ── Intestazione giornata e sintesi compatta ── */}
      <div>
        <div className="text-[13px] capitalize text-testo-metadati">
          {nomeGiorno(data)}
        </div>
        <h1 className="mt-0.5 text-2xl font-medium tracking-tight text-testo-principale sm:text-[28px] sm:leading-[34px]">
          {dataEstesa(data)}
        </h1>
        {/* Sintesi senza le etichette del riepilogo dettagliato: le cifre non
            si ripetono come testo identico (es. «4,5 h») fuori dal riepilogo. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-testo-secondario">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("attivita-della-giornata")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="-mx-1 rounded-md px-1 underline decoration-zinc-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-rose-600 max-lg:min-h-10 lg:cursor-default lg:no-underline dark:decoration-zinc-600"
          >
            <span className="font-medium tabular-nums text-testo-principale">
              {riepilogo.nRighe}
            </span>{" "}
            attività
          </button>
          <span aria-hidden="true" className="text-testo-metadati">·</span>
          <span>
            <span className="font-medium tabular-nums text-testo-principale">
              {formattaNumeroOre(riepilogo.oreTotali)}
            </span>{" "}
            h in totale
          </span>
          <span aria-hidden="true" className="text-testo-metadati">·</span>
          <span>
            <span className="font-medium tabular-nums text-testo-principale">
              {formattaEuro(riepilogo.totaleRimborsi)}
            </span>{" "}
            di rimborsi
          </span>
        </p>
      </div>

      {/* ── Esito della duplicazione ── */}
      {esitoDuplicazione && (
        <div
          data-testid="esito-duplicazione"
          role="status"
          className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 flex-none text-emerald-700 dark:text-emerald-400"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <div className="flex-1 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Riga replicata su {esitoDuplicazione.giorniCreati}{" "}
            {esitoDuplicazione.giorniCreati === 1 ? "giorno" : "giorni"}.
            <div className="mt-1 text-xs font-normal">
              {esitoDuplicazione.giorni.map(dataEstesa).join(" · ")}
            </div>
          </div>
          <button
            type="button"
            aria-label="Chiudi l'esito"
            onClick={() => setEsitoDuplicazione(null)}
            className="-m-2 flex h-10 w-10 flex-none items-center justify-center rounded-lg text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-rose-600 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Area operativa: form a sinistra, attività a destra ── */}
      <div
        className={`mt-6 grid items-start gap-6 ${
          solaLettura ? "" : "lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]"
        }`}
      >
        {/* ── Form aggiunta / modifica, con le proposte del calendario ── */}
        {!solaLettura && (
          <section
            id="form-riga"
            aria-labelledby="titolo-form-riga"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <SezioneProposteCalendario
              data={data}
              stato={proposteCalendario.stato}
              proposte={proposteCalendario.proposte.filter(
                (p) => p.eventoId !== eventoDaProposta
              )}
              onPropostaGestita={rimuoviProposta}
              onRigaCreata={invalidaDopoMutazione}
              onModifica={handleModificaProposta}
            />

            {/* Intestazione: in modifica (o da proposta) diventa una barra con
                l'azione per annullare, così la modalità non passa inosservata. */}
            {modificaId || eventoDaProposta ? (
              <div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 sm:px-5 dark:border-rose-500/30 dark:bg-rose-500/10">
                <div className="min-w-0">
                  <h2
                    id="titolo-form-riga"
                    className="text-[15px] font-medium text-rose-800 dark:text-rose-300"
                  >
                    {modificaId
                      ? "Modifica riga"
                      : "Nuova riga dalla proposta del calendario"}
                  </h2>
                  {rigaInModifica && (
                    <p className="mt-0.5 truncate text-xs text-testo-secondario">
                      {rigaInModifica.cliente.ragioneSociale} ·{" "}
                      <span className="tabular-nums">{formattaOre(rigaInModifica.ore)}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAnnulla}
                  className="inline-flex h-10 flex-none items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-testo-secondario transition-colors hover:bg-zinc-50 hover:text-testo-principale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:h-9 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Annulla
                </button>
              </div>
            ) : (
              <h2
                id="titolo-form-riga"
                className="px-4 pt-4 text-[15px] font-medium text-testo-principale sm:px-5 sm:pt-5"
              >
                Nuova riga attività
              </h2>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
              {/* Cliente */}
              <div>
                {/* Senza select non c'è alcun controllo da etichettare: la voce
                    "Cliente" resta visibile come intestazione, non come label */}
                {nessunClienteConOfferteAttive ? (
                  <p className={CLASSE_ETICHETTA}>
                    Cliente <span className={CLASSE_OBBLIGATORIO}>*</span>
                  </p>
                ) : (
                  <label htmlFor="cliente" className={CLASSE_ETICHETTA}>
                    Cliente <span className={CLASSE_OBBLIGATORIO}>*</span>
                  </label>
                )}
                {nessunClienteConOfferteAttive ? (
                  <AvvisoAbilitazioneMancante testId="nessun-cliente-con-offerte-attive">
                    Non ci sono clienti con offerte attive. Contatta un
                    amministratore per attivare un&apos;offerta sul cliente su cui
                    registrare attività.
                  </AvvisoAbilitazioneMancante>
                ) : (
                  <select
                    id="cliente"
                    value={clienteId}
                    onChange={(e) => handleCambioCliente(e.target.value)}
                    className={CLASSE_CAMPO}
                  >
                    <option value="">Seleziona un cliente</option>
                    {clientiSelezionabili.consigliati.length > 0 && (
                      <optgroup label="Consigliati">
                        {clientiSelezionabili.consigliati.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.ragioneSociale}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {clientiSelezionabili.altri.length > 0 && (
                      <optgroup label="Altri clienti">
                        {clientiSelezionabili.altri.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.ragioneSociale}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Offerta: accanto all'etichetta l'avanzamento in giornate, come
                  nell'anagrafica offerte. Solo un'indicazione: non blocca nulla. */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="offerta" className={CLASSE_ETICHETTA}>
                    Offerta <span className={CLASSE_OBBLIGATORIO}>*</span>
                  </label>
                  {avanzamentoOffertaSelezionata && (
                    <span className="mb-1.5 text-xs">
                      <IndicatoreGiorniErogati avanzamento={avanzamentoOffertaSelezionata} inRiga />
                    </span>
                  )}
                </div>
                <select
                  id="offerta"
                  value={offertaId}
                  onChange={(e) => setOffertaId(e.target.value)}
                  disabled={!clienteId || offerteLoading}
                  className={`${CLASSE_CAMPO} disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-testo-metadati dark:disabled:bg-zinc-800/50`}
                >
                  {/* Segnaposto non selezionabile: l'offerta è obbligatoria. */}
                  <option value="" disabled>
                    {offerteLoading
                      ? "Caricamento offerte..."
                      : !clienteId
                        ? "Seleziona prima un cliente"
                        : "Seleziona un'offerta"}
                  </option>
                  {offerteRaggruppate.storiche.map((o) => (
                    <option key={o.id} value={o.id}>
                      {etichettaOfferta(o)}
                    </option>
                  ))}
                  {offerteRaggruppate.abilitate.length > 0 && (
                    <optgroup label="Offerte abilitate">
                      {offerteRaggruppate.abilitate.map((o) => (
                        <option key={o.id} value={o.id}>
                          {etichettaOfferta(o)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {offerteRaggruppate.nonAbilitate.length > 0 && (
                    <optgroup label="Offerte non abilitate">
                      {offerteRaggruppate.nonAbilitate.map((o) => (
                        <option key={o.id} value={o.id}>
                          {etichettaOfferta(o)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {offertaSelezionataNonAbilitata && (
                  <AvvisoAbilitazioneMancante
                    testId="offerta-non-abilitata"
                    className="mt-2"
                  >
                    Stai aggiungendo ore su un&apos;offerta a cui non sei abilitato.
                    Richiedi l&apos;abilitazione.
                  </AvvisoAbilitazioneMancante>
                )}
                {erroreOfferte && (
                  <p
                    role="alert"
                    data-testid="errore-offerte-cliente"
                    className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                  >
                    {erroreOfferte}
                  </p>
                )}
              </div>

              {/* Ore */}
              <div>
                <label htmlFor="ore" className={CLASSE_ETICHETTA}>
                  Ore <span className={CLASSE_OBBLIGATORIO}>*</span>
                </label>
                <input
                  id="ore"
                  type="text"
                  inputMode="decimal"
                  placeholder="es. 8 o 3,5"
                  value={ore}
                  onChange={(e) => handleCambioOre(e.target.value)}
                  aria-invalid={erroreOre ? true : undefined}
                  aria-describedby={erroreOre ? "errore-ore" : undefined}
                  className={`h-10 w-36 rounded-lg border bg-white px-3 text-base tabular-nums text-testo-principale transition-colors placeholder:text-sm placeholder:text-testo-metadati focus:outline-none focus:ring-1 dark:bg-zinc-900 ${
                    erroreOre
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-500/50"
                      : "border-zinc-200 focus:border-rose-500 focus:ring-rose-500 dark:border-zinc-700"
                  }`}
                />
                {erroreOre && (
                  <p
                    id="errore-ore"
                    className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                  >
                    {erroreOre}
                  </p>
                )}
              </div>

              {/* Dettagli subordinati: categoria (con il suo significato),
                  rimborso e nota. */}
              <fieldset className="space-y-3 rounded-[10px] bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-800/50">
                <legend className="float-left mb-1 w-full text-xs text-testo-metadati">
                  Dettagli
                </legend>

                {/* Categoria: la didascalia spiega solo la voce selezionata */}
                <div className="clear-both">
                  <label htmlFor="categoria" className={CLASSE_ETICHETTA_DETTAGLIO}>
                    Categoria
                  </label>
                  <select
                    id="categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as CategoriaAttivita)}
                    aria-describedby="significato-categoria"
                    className={CLASSE_CAMPO}
                  >
                    {CATEGORIE_ATTIVITA.map((opzione) => (
                      <option key={opzione} value={opzione}>
                        {DESCRIZIONE_CATEGORIA_ATTIVITA[opzione].etichetta}
                      </option>
                    ))}
                  </select>
                  <p
                    id="significato-categoria"
                    className="mt-1.5 text-xs leading-4 text-testo-metadati"
                  >
                    {DESCRIZIONE_CATEGORIA_ATTIVITA[categoria].significato}
                  </p>
                </div>

                {/* Rimborso trasferta */}
                <div>
                  <label
                    htmlFor="voceRimborsoTrasferta"
                    className={CLASSE_ETICHETTA_DETTAGLIO}
                  >
                    Rimborso trasferta <span className="font-normal text-testo-metadati">(opzionale)</span>
                  </label>
                  <select
                    id="voceRimborsoTrasferta"
                    data-testid="voce-rimborso-trasferta"
                    value={selezioneRimborso}
                    onChange={(e) => setSelezioneRimborso(e.target.value)}
                    className={CLASSE_CAMPO}
                  >
                    {modificaId && (
                      <option value={SELEZIONE_RIMBORSO_INVARIATO}>
                        Non modificare il rimborso attuale
                      </option>
                    )}
                    <option value="">Nessun rimborso</option>
                    {vociRimborso.map((voce) => (
                      <option key={voce.id} value={voce.id}>
                        {voce.etichetta}
                      </option>
                    ))}
                  </select>
                  {modificaId && rigaInModifica?.rimborsoTrasfertaEtichetta != null && (
                    <p
                      data-testid="rimborso-attuale"
                      className="mt-1.5 text-xs text-testo-metadati"
                    >
                      Rimborso attuale: {rigaInModifica.rimborsoTrasfertaEtichetta}
                      {rigaInModifica.rimborsoTrasfertaImporto != null &&
                        ` — ${formattaEuro(rigaInModifica.rimborsoTrasfertaImporto)}`}
                    </p>
                  )}
                  {voceRimborsoSelezionata && (
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-testo-secondario">
                      <IconaRimborso />
                      {voceRimborsoSelezionata.etichetta}
                      <span className="font-medium tabular-nums text-testo-principale">
                        {formattaEuro(voceRimborsoSelezionata.importo)}
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="nota" className={CLASSE_ETICHETTA_DETTAGLIO}>
                    Nota
                  </label>
                  <textarea
                    id="nota"
                    rows={2}
                    placeholder="Nota descrittiva (opzionale)"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-testo-principale transition-colors placeholder:text-testo-metadati focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </fieldset>

              {/* Errore submit */}
              {erroreSubmit && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <IconaInfo />
                  {erroreSubmit}
                </div>
              )}

              <PulsanteAttesa
                type="submit"
                attesaEsterna={salvataggioInCorso || isPending}
                etichettaAttesa="Salvataggio…"
                disabled={offerteLoading || nessunClienteConOfferteAttive}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:h-10"
              >
                {!modificaId && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    className="h-4 w-4"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                {modificaId ? "Salva modifiche" : "Aggiungi riga"}
              </PulsanteAttesa>
            </form>
          </section>
        )}

        {/* ── Attività registrate ── */}
        <section
          id="attivita-della-giornata"
          aria-labelledby="titolo-attivita-della-giornata"
          className="min-w-0 scroll-mt-24"
        >
          <h2
            id="titolo-attivita-della-giornata"
            className="mb-3 text-[15px] font-medium text-testo-principale"
          >
            Attività della giornata
          </h2>

          {righe.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-8 text-center text-sm text-testo-metadati dark:border-zinc-700">
              Nessuna attività registrata per questa giornata.
              {!solaLettura && (
                <>
                  <br />
                  Usa il form di inserimento per aggiungerne una.
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {righe.map((riga) => {
                const inModifica = riga.id === modificaId;
                return (
                  <div
                    key={riga.id}
                    data-testid="activity-row"
                    data-offerta-non-abilitata={riga.offertaNonAbilitata ? "true" : undefined}
                    aria-current={inModifica ? "true" : undefined}
                    className={`px-4 py-4 sm:px-5 ${
                      riga.offertaNonAbilitata
                        ? CLASSE_RIGA_OFFERTA_NON_ABILITATA
                        : inModifica
                          ? "bg-rose-50 shadow-[inset_3px_0_0] shadow-rose-600 dark:bg-rose-500/10 dark:shadow-rose-400"
                          : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-medium text-testo-principale">
                          {riga.cliente.ragioneSociale}
                          {inModifica && (
                            <span className="ml-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                              In modifica
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[13px] text-testo-secondario [overflow-wrap:anywhere]">
                          {riga.offerta ? (
                            riga.offertaNonAbilitata ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                <IconaOffertaNonAbilitata className="h-[11px] w-[11px]" />
                                {[riga.offerta.codice, riga.offerta.descrizione].filter(Boolean).join(" — ")}
                              </span>
                            ) : (
                              [riga.offerta.codice, riga.offerta.descrizione].filter(Boolean).join(" — ")
                            )
                          ) : (
                            <span
                              data-testid="offerta-da-definire"
                              className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            >
                              {ETICHETTA_OFFERTA_DA_DEFINIRE}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-lg font-medium leading-6 tabular-nums text-testo-principale">
                        {formattaOre(riga.ore)}
                      </span>
                    </div>

                    {riga.nota && (
                      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-testo-secondario [overflow-wrap:anywhere]">
                        {riga.nota}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <BadgeCategoriaAttivita categoria={riga.categoria} />
                      {/* Rimborso trasferta fotografato (se presente) */}
                      {riga.rimborsoTrasfertaEtichetta != null && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-testo-metadati">
                          <IconaRimborso />
                          {riga.rimborsoTrasfertaEtichetta}
                          {riga.rimborsoTrasfertaImporto != null && (
                            <span className="font-medium tabular-nums text-testo-secondario">
                              {formattaEuro(riga.rimborsoTrasfertaImporto)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {riga.offertaNonAbilitata && riga.offerta && (
                      <div className="mt-3 border-t border-dashed border-amber-300 pt-2 dark:border-amber-700">
                        <AvvisoOffertaNonAbilitata
                          codiceOfferta={riga.offerta.codice}
                          nomeCollaboratore={nomeCollaboratoreConsultato}
                          abilitazione={
                            collaboratoreConsultatoId && !solaLettura && riga.offerta.attiva
                              ? { collaboratoreId: collaboratoreConsultatoId, offertaId: riga.offerta.id, onAbilitata: dopoAbilitazione }
                              : null
                          }
                        />
                      </div>
                    )}

                    {/* Pulsanti azione */}
                    {!solaLettura && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <PulsanteAttesa
                          type="button"
                          attesaEsterna={rigaInAttesaId === riga.id}
                          onClick={() => handleModifica(riga)}
                          className={CLASSE_AZIONE_RIGA}
                        >
                          Modifica
                        </PulsanteAttesa>
                        <PulsanteAttesa
                          type="button"
                          data-testid="duplica-riga"
                          attesaEsterna={rigaInAttesaId === riga.id}
                          onClick={() => {
                            setEsitoDuplicazione(null);
                            setRigaDaDuplicare(riga);
                          }}
                          className={CLASSE_AZIONE_RIGA}
                        >
                          Duplica…
                        </PulsanteAttesa>
                        {riga.rimborsoTrasfertaEtichetta != null && (
                          <PulsanteAttesa
                            type="button"
                            attesaEsterna={rigaInAttesaId === riga.id}
                            onClick={() => handleRimuoviRimborso(riga.id)}
                            className={CLASSE_AZIONE_RIGA}
                          >
                            Rimuovi rimborso
                          </PulsanteAttesa>
                        )}
                        <PulsanteAttesa
                          type="button"
                          attesaEsterna={rigaInAttesaId === riga.id}
                          onClick={() => handleElimina(riga.id)}
                          className={`${CLASSE_AZIONE_RIGA} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`}
                        >
                          Elimina
                        </PulsanteAttesa>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Riepilogo dettagliato, secondario ── */}
      <section aria-labelledby="titolo-riepilogo-giornata" className="mt-8">
        <h2
          id="titolo-riepilogo-giornata"
          className="mb-2 text-[13px] font-medium text-testo-metadati"
        >
          Riepilogo della giornata
        </h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
          {[
            { etichetta: "Righe registrate", valore: String(riepilogo.nRighe) },
            { etichetta: "Ore totali", valore: formattaOre(riepilogo.oreTotali) },
            {
              etichetta: "Ore da fatturare ad Agile Reloaded",
              valore: formattaOre(riepilogo.oreDaFatturare),
            },
            {
              etichetta: "Totale rimborsi",
              valore: formattaEuro(riepilogo.totaleRimborsi),
              testId: "day-summary-rimborsi",
            },
          ].map(({ etichetta, valore, testId }) => (
            <div key={etichetta} className="bg-white px-4 py-3 dark:bg-zinc-900">
              <dt className="text-xs text-testo-metadati">{etichetta}</dt>
              <dd
                data-testid={testId}
                className="mt-0.5 text-[15px] font-medium tabular-nums text-testo-principale"
              >
                {valore}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Selettore di duplicazione su più giorni ── */}
      {rigaDaDuplicare && (
        <SelettoreDuplicazione
          riga={rigaDaDuplicare}
          giornoOrigine={data}
          collaboratoreConsultatoId={collaboratoreConsultatoId}
          onChiudi={() => setRigaDaDuplicare(null)}
          onDuplicata={gestisciDuplicazione}
        />
      )}
    </>
  );
}
