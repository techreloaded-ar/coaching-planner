import { risolviProfiloCollaboratoreCorrente, verificaSessione } from "@/lib/dal";
import { calendarioCollegato } from "@/lib/proposte-calendario";
import { temaPreferito } from "@/lib/tema-preferito";
import { SelettoreTema } from "@/components";
import CollegamentoCalendario from "./collegamento-calendario";

/**
 * Impostazioni personali dell'utente collegato: tema grafico e connettori
 * esterni. Il connettore Google Calendar è operativo solo con un profilo
 * collaboratore attivo; `?calendario=` porta l'esito del ritorno dal consenso.
 */
export default async function ImpostazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ calendario?: string }>;
}) {
  const sessione = await verificaSessione();
  const [tema, profilo, params] = await Promise.all([
    temaPreferito(),
    risolviProfiloCollaboratoreCorrente(sessione),
    searchParams,
  ]);
  const collegato =
    profilo.stato === "ATTIVO" ? await calendarioCollegato(profilo.collaboratore.id) : null;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-8 py-8 max-sm:px-4">
      <section aria-labelledby="titolo-tema" className="flex flex-col gap-3">
        <div>
          <h2 id="titolo-tema" className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
            Tema
          </h2>
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
            Aspetto dell&apos;interfaccia su questo browser. «Browser» segue l&apos;impostazione del sistema.
          </p>
        </div>
        <SelettoreTema temaIniziale={tema} />
      </section>

      <section aria-labelledby="titolo-connettori" className="flex flex-col gap-3">
        <div>
          <h2 id="titolo-connettori" className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
            Connettori
          </h2>
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
            Collegamenti con servizi esterni.
          </p>
        </div>
        <CollegamentoCalendario
          collegato={collegato}
          esito={params.calendario}
          emailAccesso={sessione.email}
        />
      </section>
    </div>
  );
}
