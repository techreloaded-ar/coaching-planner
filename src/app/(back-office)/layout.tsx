import { richiediAccessoBackOffice } from "@/lib/dal";
import StrutturaApplicazione from "@/app/struttura-applicazione";

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ingresso: almeno un permesso di back office; ogni pagina richiede poi il permesso della propria area.
  const sessione = await richiediAccessoBackOffice();

  return (
    <StrutturaApplicazione sessione={sessione}>
      <main className="min-w-0 flex-1 bg-zinc-50 px-9 py-[30px] max-sm:px-4 max-sm:py-5 dark:bg-zinc-950">{children}</main>
    </StrutturaApplicazione>
  );
}
