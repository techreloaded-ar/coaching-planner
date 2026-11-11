import Link from "next/link";
import { richiediPermesso } from "@/lib/dal";
import { elencaClientiPaginati } from "@/lib/clienti";
import { leggiPosizioneElenco } from "@/lib/paginazione";
import { leggiFiltroStatoCliente } from "@/domain/anagrafiche/stato-cliente";
import ClientiTabella from "./clienti-tabella";

interface ClientiPageProps {
  searchParams: Promise<{
    q?: string | string[];
    pagina?: string | string[];
    stato?: string | string[];
  }>;
}

export default async function ClientiPage({ searchParams }: ClientiPageProps) {
  await richiediPermesso("GESTIRE_CLIENTI");
  const parametri = await searchParams;
  const { ricerca, pagina } = leggiPosizioneElenco(parametri);
  const stati = leggiFiltroStatoCliente(parametri.stato);
  const elenco = await elencaClientiPaginati({ ricerca, pagina, stati });

  return (
    <div>
      {/* Intestazione view */}
      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-medium text-testo-metadati">
            Anagrafiche
          </div>
          <h1 className="text-[23px] font-semibold tracking-tight text-testo-principale">
            Clienti
          </h1>
          <p className="mt-[6px] max-w-[560px] text-sm text-testo-metadati">
            Un cliente è attivo quando ha almeno un&apos;offerta attiva e nuovo quando non ha ancora offerte.
          </p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-[10px]">
          <Link
            href="/anagrafiche/clienti/nuovo"
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-indigo-500 px-[15px] py-[9px] text-sm font-medium text-white shadow-sm no-underline transition hover:bg-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-[16px] w-[16px]" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuovo cliente
          </Link>
        </div>
      </div>

      {/* Tabella clienti */}
      <ClientiTabella elenco={elenco} ricerca={ricerca} />


    </div>
  );
}
