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
import { formattaEuro, formattaOre } from "@/lib/formattazione";

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
// Avviso di abilitazione mancante
// ═══════════════════════════════════════════════════════════════

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
      className={`flex items-start gap-2 rounded-[9px] border border-amber-200 bg-amber-50 p-[10px_13px] text-sm font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 ${className}`}
    >
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
      {/* ── Intestazione giornata ── */}
      <div className="mb-7">
        <div className="text-xs font-medium capitalize text-rose-800 dark:text-rose-300">
          {nomeGiorno(data)}
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold capitalize text-testo-principale">
          {dataEstesa(data)}
        </h1>
      </div>

      {/* ── Esito della duplicazione ── */}
      {esitoDuplicazione && (
        <div
          data-testid="esito-duplicazione"
          role="status"
          className="mb-7 flex items-start gap-[11px] rounded-[11px] border border-emerald-200 bg-emerald-50 p-[13px_16px] shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-px h-[18px] w-[18px] flex-none text-emerald-700 dark:text-emerald-400"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <div className="flex-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Riga replicata su {esitoDuplicazione.giorniCreati}{" "}
            {esitoDuplicazione.giorniCreati === 1 ? "giorno" : "giorni"}.
            <div className="mt-[5px] text-xs font-medium opacity-90">
              {esitoDuplicazione.giorni.map(dataEstesa).join(" · ")}
            </div>
          </div>
          <button
            type="button"
            aria-label="Chiudi l'esito"
            onClick={() => setEsitoDuplicazione(null)}
            className="flex-none rounded-md p-0.5 text-emerald-700 opacity-65 transition hover:opacity-100 dark:text-emerald-400"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              className="h-[15px] w-[15px]"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Riepilogo dinamico ── */}
      <div className="mb-7 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-xs font-medium text-testo-metadati">
            Righe registrate
          </div>
          <div className="mt-0.5 text-[22px] font-semibold tabular-nums text-rose-800 dark:text-rose-300">
            {riepilogo.nRighe}
          </div>
        </div>
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-xs font-medium text-testo-metadati">
            Ore totali
          </div>
          <div className="mt-0.5 text-[22px] font-semibold tabular-nums text-rose-800 dark:text-rose-300">
            {formattaOre(riepilogo.oreTotali)}
          </div>
        </div>
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-xs font-medium text-testo-metadati">
            Ore da fatturare ad Agile Reloaded
          </div>
          <div className="mt-0.5 text-[22px] font-semibold tabular-nums text-rose-800 dark:text-rose-300">
            {formattaOre(riepilogo.oreDaFatturare)}
          </div>
        </div>
        <div className="flex-1 min-w-[120px] rounded-[11px] border border-rose-200 bg-rose-50 p-[14px_16px] dark:border-rose-800 dark:bg-rose-950/40">
          <div className="text-xs font-medium text-testo-metadati">
            Totale rimborsi
          </div>
          <div
            data-testid="day-summary-rimborsi"
            className="mt-0.5 text-[22px] font-semibold tabular-nums text-rose-800 dark:text-rose-300"
          >
            {formattaEuro(riepilogo.totaleRimborsi)}
          </div>
        </div>
      </div>

      {/* ── Proposte dal calendario Google ── */}
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

      {/* ── Lista righe registrate ── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium text-testo-metadati">
          Attività della giornata
        </h2>

        {righe.length === 0 ? (
          <div className="rounded-[11px] border border-dashed border-zinc-200 bg-zinc-50 p-[28px_20px] text-center text-sm text-testo-metadati dark:border-zinc-700 dark:bg-zinc-800/50">
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
                data-testid="activity-row"
                data-offerta-non-abilitata={riga.offertaNonAbilitata ? "true" : undefined}
                className={`rounded-[11px] border p-[13px_15px] transition-shadow hover:shadow-sm ${
                  riga.offertaNonAbilitata
                    ? `border-amber-300 dark:border-amber-700 ${CLASSE_RIGA_OFFERTA_NON_ABILITATA}`
                    : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-testo-principale">
                      {riga.cliente.ragioneSociale}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {riga.offerta ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                            riga.offertaNonAbilitata
                              ? "border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-zinc-100 text-testo-secondario dark:bg-zinc-700"
                          }`}
                        >
                          {riga.offertaNonAbilitata && <IconaOffertaNonAbilitata className="h-[11px] w-[11px]" />}
                          {[riga.offerta.codice, riga.offerta.descrizione].filter(Boolean).join(" — ")}
                        </span>
                      ) : (
                        <span
                          data-testid="offerta-da-definire"
                          className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          {ETICHETTA_OFFERTA_DA_DEFINIRE}
                        </span>
                      )}
                    </div>
                    {riga.nota && (
                      <div className="mt-[7px] text-sm leading-relaxed text-testo-metadati">
                        {riga.nota}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-none items-center gap-2.5">
                    <BadgeCategoriaAttivita categoria={riga.categoria} />
                    <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-rose-800 dark:text-rose-300">
                      {formattaOre(riga.ore)}
                    </span>
                  </div>
                </div>

                {/* Rimborso trasferta fotografato (se presente) */}
                {riga.rimborsoTrasfertaEtichetta != null && (
                  <div className="mt-[8px] flex items-center gap-2 rounded-[7px] bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/30">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-[13px] w-[13px] text-amber-700 dark:text-amber-400"
                    >
                      <path d="M6 17h12l1.5-5.5A2 2 0 0 0 17.6 9H6.4a2 2 0 0 0-1.9 2.5L6 17Z" />
                      <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                    </svg>
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {riga.rimborsoTrasfertaEtichetta}
                    </span>
                    {riga.rimborsoTrasfertaImporto != null && (
                      <span className="ml-auto text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                        {formattaEuro(riga.rimborsoTrasfertaImporto)}
                      </span>
                    )}
                  </div>
                )}

                {riga.offertaNonAbilitata && riga.offerta && (
                  <div className="mt-[9px] border-t border-dashed border-amber-300 pt-2 dark:border-amber-700">
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
                <div className="mt-[10px] flex items-center gap-2 border-t border-zinc-100 pt-[10px] dark:border-zinc-700">
                  <PulsanteAttesa
                    type="button"
                    attesaEsterna={rigaInAttesaId === riga.id}
                    onClick={() => handleModifica(riga)}
                    className="inline-flex items-center gap-[5px] rounded-[8px] border border-zinc-200 bg-white px-2.5 py-1 text-sm font-medium text-testo-secondario transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
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
                  </PulsanteAttesa>
                  <PulsanteAttesa
                    type="button"
                    data-testid="duplica-riga"
                    attesaEsterna={rigaInAttesaId === riga.id}
                    onClick={() => {
                      setEsitoDuplicazione(null);
                      setRigaDaDuplicare(riga);
                    }}
                    className="inline-flex items-center gap-[5px] rounded-[8px] border border-rose-200 bg-white px-2.5 py-1 text-sm font-medium text-rose-700 transition hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:bg-zinc-800 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-[13px] w-[13px]"
                    >
                      <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" />
                      <path d="M15.5 5.5H5.8A2.3 2.3 0 0 0 3.5 7.8v9.7" />
                    </svg>
                    Duplica…
                  </PulsanteAttesa>
                  {riga.rimborsoTrasfertaEtichetta != null && (
                    <PulsanteAttesa
                      type="button"
                      attesaEsterna={rigaInAttesaId === riga.id}
                      onClick={() => handleRimuoviRimborso(riga.id)}
                      className="inline-flex items-center gap-[5px] rounded-[8px] border border-amber-200 bg-white px-2.5 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:bg-zinc-800 dark:text-amber-400 dark:hover:bg-amber-950 dark:hover:text-amber-300"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-[13px] w-[13px]"
                      >
                        <path d="M6 17h12l1.5-5.5A2 2 0 0 0 17.6 9H6.4a2 2 0 0 0-1.9 2.5L6 17Z" />
                        <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                      </svg>
                      Rimuovi rimborso
                    </PulsanteAttesa>
                  )}
                  <PulsanteAttesa
                    type="button"
                    attesaEsterna={rigaInAttesaId === riga.id}
                    onClick={() => handleElimina(riga.id)}
                    className="inline-flex items-center gap-[5px] rounded-[8px] border border-red-200 bg-white px-2.5 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
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
                  </PulsanteAttesa>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Form aggiunta / modifica ── */}
      {!solaLettura && (
      <section
        id="form-riga"
        className="rounded-[11px] border border-zinc-200 bg-white p-[18px_20px_22px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-[15px] text-sm font-semibold text-testo-metadati">
          {modificaId
            ? "Modifica riga"
            : eventoDaProposta
              ? "Nuova riga dalla proposta del calendario"
              : "Nuova riga attività"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-[15px]">
          {/* Cliente */}
          <div>
            {/* Senza select non c'è alcun controllo da etichettare: la voce
                "Cliente" resta visibile come intestazione, non come label */}
            {nessunClienteConOfferteAttive ? (
              <p className="mb-[5px] block text-xs font-medium text-testo-secondario">
                Cliente <span className="text-rose-600 dark:text-rose-400">*</span>
              </p>
            ) : (
              <label
                htmlFor="cliente"
                className="mb-[5px] block text-xs font-medium text-testo-secondario"
              >
                Cliente <span className="text-rose-600 dark:text-rose-400">*</span>
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
                className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-sm text-testo-principale shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800"
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
            <div className="mb-[5px] flex items-center justify-between gap-3">
              <label
                htmlFor="offerta"
                className="block text-xs font-medium text-testo-secondario"
              >
                Offerta <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              {avanzamentoOffertaSelezionata && (
                <span className="text-[12.5px]">
                  <IndicatoreGiorniErogati avanzamento={avanzamentoOffertaSelezionata} inRiga />
                </span>
              )}
            </div>
            <select
              id="offerta"
              value={offertaId}
              onChange={(e) => setOffertaId(e.target.value)}
              disabled={!clienteId || offerteLoading}
              className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-sm text-testo-principale shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:disabled:bg-zinc-800/50"
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
                className="mt-1 text-xs font-medium text-red-600 dark:text-red-400"
              >
                {erroreOfferte}
              </p>
            )}
          </div>

          {/* Ore */}
          <div>
            <label
              htmlFor="ore"
              className="mb-[5px] block text-xs font-medium text-testo-secondario"
            >
              Ore <span className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <input
              id="ore"
              type="text"
              inputMode="decimal"
              placeholder="es. 8 o 3,5"
              value={ore}
              onChange={(e) => handleCambioOre(e.target.value)}
              className={`w-full rounded-[8px] border bg-white px-3 py-2 text-sm text-testo-principale shadow-sm transition focus:outline-none focus:ring-1 ${
                erroreOre
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-800"
                  : "border-zinc-200 focus:border-rose-500 focus:ring-rose-500 dark:border-zinc-700"
              } dark:bg-zinc-800 dark:text-zinc-200`}
            />
            {erroreOre && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {erroreOre}
              </p>
            )}
          </div>

          {/* Rimborso trasferta */}
          <div>
            <label
              htmlFor="voceRimborsoTrasferta"
              className="mb-[5px] block text-xs font-medium text-testo-secondario"
            >
              Rimborso trasferta <span className="text-testo-metadati font-normal">(opzionale)</span>
            </label>
            <select
              id="voceRimborsoTrasferta"
              data-testid="voce-rimborso-trasferta"
              value={selezioneRimborso}
              onChange={(e) => setSelezioneRimborso(e.target.value)}
              className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-sm text-testo-principale shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800"
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
                className="mt-1 text-xs font-medium text-testo-metadati"
              >
                Rimborso attuale: {rigaInModifica.rimborsoTrasfertaEtichetta}
                {rigaInModifica.rimborsoTrasfertaImporto != null &&
                  ` — ${formattaEuro(rigaInModifica.rimborsoTrasfertaImporto)}`}
              </p>
            )}
            {voceRimborsoSelezionata && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-[7px] bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-[13px] w-[13px] text-amber-700 dark:text-amber-400"
                >
                  <path d="M6 17h12l1.5-5.5A2 2 0 0 0 17.6 9H6.4a2 2 0 0 0-1.9 2.5L6 17Z" />
                  <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                </svg>
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {voceRimborsoSelezionata.etichetta}
                </span>
                <span className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                  {formattaEuro(voceRimborsoSelezionata.importo)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-[18px]">
            {/* Categoria: la didascalia spiega solo la voce selezionata */}
            <div className="w-full sm:w-[260px]">
              <label
                htmlFor="categoria"
                className="mb-[5px] block text-xs font-medium text-testo-secondario"
              >
                Categoria
              </label>
              <select
                id="categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaAttivita)}
                aria-describedby="significato-categoria"
                className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-sm text-testo-principale shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {CATEGORIE_ATTIVITA.map((opzione) => (
                  <option key={opzione} value={opzione}>
                    {DESCRIZIONE_CATEGORIA_ATTIVITA[opzione].etichetta}
                  </option>
                ))}
              </select>
              <p
                id="significato-categoria"
                className="mt-[5px] text-xs leading-snug text-testo-metadati"
              >
                {DESCRIZIONE_CATEGORIA_ATTIVITA[categoria].significato}
              </p>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="nota"
                className="mb-[5px] block text-xs font-medium text-testo-secondario"
              >
                Nota
              </label>
              <textarea
                id="nota"
                rows={2}
                placeholder="Nota descrittiva (opzionale)"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className="w-full rounded-[8px] border border-zinc-200 bg-white px-3 py-2 text-sm text-testo-principale shadow-sm transition focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>

          {/* Errore submit */}
          {erroreSubmit && (
            <div className="flex items-start gap-2 rounded-[9px] border border-red-200 bg-red-50 p-[10px_13px] text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
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
            <PulsanteAttesa
              type="submit"
              attesaEsterna={salvataggioInCorso || isPending}
              etichettaAttesa="Salvataggio…"
              disabled={offerteLoading || nessunClienteConOfferteAttive}
              className="inline-flex items-center gap-[7px] rounded-[10px] bg-rose-600 px-[18px] py-[9px] text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700"
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
            </PulsanteAttesa>

            {(modificaId || eventoDaProposta) && (
              <button
                type="button"
                onClick={handleAnnulla}
                className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-[18px] py-[9px] text-sm font-medium text-testo-secondario shadow-sm transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
              >
                Annulla
              </button>
            )}
          </div>
        </form>
      </section>
      )}

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
