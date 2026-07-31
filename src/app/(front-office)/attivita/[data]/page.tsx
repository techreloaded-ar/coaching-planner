import { redirect } from "next/navigation";
import Link from "next/link";
import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import {
  righeDelGiorno,
  clientiAttiviPerSelezione,
  vociRimborsoTrasfertaPerSelezione,
} from "@/lib/attivita";
import { parseDataGiorno } from "@/domain/calendario";
import DettaglioGiornata from "./dettaglio-giornata";
import StatoProfiloCollaboratore from "../stato-profilo-collaboratore";

// ── Tipi serializzati ───────────────────────────────────────────

/** Riga attività dopo serializzazione (Date → string, Decimal → number) */
export interface RigaAttivitaClient {
  id: string;
  data: string;
  ore: number;
  nota: string | null;
  fatturabile: boolean;
  rimborsoTrasfertaEtichetta: string | null;
  rimborsoTrasfertaImporto: string | null;
  offerta: {
    id: string;
    codice: string;
    descrizione: string;
  };
  cliente: {
    id: string;
    ragioneSociale: string;
  };
}

/** Cliente per la select */
export interface ClienteSelect {
  id: string;
  ragioneSociale: string;
}

/** Voce di rimborso trasferta selezionabile nel form riga attività */
export interface VoceRimborsoTrasfertaSelezionabile {
  id: string;
  etichetta: string;
  importo: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Formatta una data in YYYY-MM-DD senza dipendere dal timezone */
function formattaDataISO(data: Date): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const g = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

// ═══════════════════════════════════════════════════════════════
// Pagina
// ═══════════════════════════════════════════════════════════════

export default async function DettaglioGiornataPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string }>;
  searchParams: Promise<{ mese?: string }>;
}) {
  const sessione = await verificaSessione();
  const profilo = await risolviProfiloCollaboratoreCorrente();

  if (profilo.stato !== "ATTIVO") {
    return (
      <StatoProfiloCollaboratore
        stato={profilo.stato}
        amministratore={sessione.ruolo === "AMMINISTRATORE"}
      />
    );
  }

  const { data: dataStr } = await params;
  const { mese: meseToken } = await searchParams;

  // Validazione data
  if (!parseDataGiorno(dataStr)) {
    redirect("/attivita");
  }

  // Carica dati in parallelo
  const [righe, clienti, vociRimborso] = await Promise.all([
    righeDelGiorno(dataStr),
    clientiAttiviPerSelezione(),
    vociRimborsoTrasfertaPerSelezione(),
  ]);

  // Serializza per il client component
  const righeClient: RigaAttivitaClient[] = righe.map((r) => ({
    id: r.id,
    data: formattaDataISO(r.data),
    ore: Number(r.ore),
    nota: r.nota,
    fatturabile: r.fatturabile,
    rimborsoTrasfertaEtichetta: r.rimborsoTrasfertaEtichetta,
    rimborsoTrasfertaImporto: r.rimborsoTrasfertaImporto?.toString() ?? null,
    offerta: {
      id: r.offerta.id,
      codice: r.offerta.codice,
      descrizione: r.offerta.descrizione,
    },
    cliente: {
      id: r.cliente.id,
      ragioneSociale: r.cliente.ragioneSociale,
    },
  }));

  const clientiSelect: ClienteSelect[] = clienti;

  // Link di ritorno: preserva il token mese se disponibile
  const ritornoHref = meseToken ? `/attivita?mese=${meseToken}` : "/attivita";

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link
          href={ritornoHref}
          className="inline-flex items-center gap-[7px] rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750 dark:hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-[15px] w-[15px]"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Torna al calendario
        </Link>
      </div>

      <DettaglioGiornata
        key={dataStr}
        data={dataStr}
        righeIniziali={righeClient}
        clienti={clientiSelect}
        vociRimborso={vociRimborso}
        meseToken={meseToken}
      />
    </>
  );
}
