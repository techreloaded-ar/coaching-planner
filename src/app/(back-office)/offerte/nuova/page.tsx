import { richiediPermesso } from "@/lib/dal";
import { elencaClientiSelezionabili } from "@/lib/clienti";
import { leggiFiltriElencoOfferte, type ParametriElencoOfferte } from "@/lib/elenco-offerte";
import OffertaForm from "../../anagrafiche/clienti/[id]/offerte/offerta-form";

export default async function NuovaOffertaDaOffertePage({
  searchParams,
}: { searchParams: Promise<ParametriElencoOfferte> }) {
  await richiediPermesso("GESTIRE_OFFERTE");

  const clienti = await elencaClientiSelezionabili();

  return (
    <OffertaForm
      clienti={clienti.map((cliente) => ({
        id: cliente.id,
        ragioneSociale: cliente.ragioneSociale,
      }))}
      origine="offerte"
      filtriElenco={leggiFiltriElencoOfferte(await searchParams)}
    />
  );
}
