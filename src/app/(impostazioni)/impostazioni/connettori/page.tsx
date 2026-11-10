import { risolviProfiloCollaboratoreCorrente, verificaSessione } from "@/lib/dal";
import { calendarioCollegato } from "@/lib/proposte-calendario";
import CollegamentoCalendario from "./collegamento-calendario";

/**
 * Connettori esterni dell'utente collegato. Google Calendar è operativo solo
 * con un profilo collaboratore attivo; `?calendario=` porta l'esito del
 * ritorno dal consenso.
 */
export default async function ImpostazioniConnettoriPage({
  searchParams,
}: {
  searchParams: Promise<{ calendario?: string }>;
}) {
  const sessione = await verificaSessione();
  const [profilo, params] = await Promise.all([
    risolviProfiloCollaboratoreCorrente(sessione),
    searchParams,
  ]);
  const collegato =
    profilo.stato === "ATTIVO" ? await calendarioCollegato(profilo.collaboratore.id) : null;

  return (
    <section aria-labelledby="titolo-connettori" className="flex flex-col gap-3">
      <div>
        <h2 id="titolo-connettori" className="text-[15px] font-semibold text-testo-principale">
          Connettori
        </h2>
        <p className="text-sm text-testo-metadati">
          Collegamenti con servizi esterni.
        </p>
      </div>
      <CollegamentoCalendario
        collegato={collegato}
        esito={params.calendario}
        emailAccesso={sessione.email}
      />
    </section>
  );
}
