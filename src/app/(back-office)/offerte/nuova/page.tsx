import { richiediRuolo } from "@/lib/dal";
import { elencaClientiSelezionabili } from "@/lib/clienti";
import OffertaForm from "../../anagrafiche/clienti/[id]/offerte/offerta-form";

export default async function NuovaOffertaDaOffertePage() {
  await richiediRuolo("AMMINISTRATORE");

  const clienti = await elencaClientiSelezionabili();

  return (
    <OffertaForm
      clienti={clienti.map((cliente) => ({
        id: cliente.id,
        ragioneSociale: cliente.ragioneSociale,
      }))}
      origine="offerte"
    />
  );
}
