import { redirect } from "next/navigation";
import { risolviProfiloCollaboratoreCorrente, verificaSessione } from "@/lib/dal";
import { PARAMETRO_ESITO_CALENDARIO, PARAMETRO_IMPOSTAZIONI } from "../parametri";

/**
 * Le Impostazioni sono una modale, non una pagina: `/impostazioni/...` (link
 * diretti e ritorno dal consenso Google con `?calendario=`) riporta alla
 * pagina di partenza dell'utente chiedendo di aprire la modale sulla categoria.
 * Si parte dalle attività con un profilo collaboratore utilizzabile, dalla
 * console per l'amministratore senza profilo collaboratore attivo.
 */
export default async function ImpostazioniPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoria?: string[] }>;
  searchParams: Promise<{ calendario?: string }>;
}) {
  const sessione = await verificaSessione();
  const [profilo, { categoria }, { calendario }] = await Promise.all([
    risolviProfiloCollaboratoreCorrente(sessione),
    params,
    searchParams,
  ]);
  const partenza =
    sessione.ruolo === "COLLABORATORE" || profilo.stato === "ATTIVO" ? "/attivita" : "/anagrafiche/clienti";

  const query = new URLSearchParams({
    [PARAMETRO_IMPOSTAZIONI]: categoria?.[0] === "connettori" ? "connettori" : "tema",
  });
  if (typeof calendario === "string") query.set(PARAMETRO_ESITO_CALENDARIO, calendario);
  redirect(`${partenza}?${query}`);
}
