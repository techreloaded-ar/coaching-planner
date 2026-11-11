import { verificaSessione } from "@/lib/dal";
import StrutturaApplicazione from "@/app/struttura-applicazione";

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Solo autenticazione: ogni pagina richiede il permesso della propria area;
  // la guardia d'ingresso al back office arriverà con US-110.
  const sessione = await verificaSessione();

  return (
    <StrutturaApplicazione sessione={sessione}>
      <main className="min-w-0 flex-1 bg-zinc-50 px-9 py-[30px] max-sm:px-4 max-sm:py-5 dark:bg-zinc-950">{children}</main>
    </StrutturaApplicazione>
  );
}
