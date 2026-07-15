import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { offertaPerId } from "@/lib/offerte";
import OffertaForm from "../../anagrafiche/clienti/[id]/offerte/offerta-form";

interface ModificaOffertaDaOffertePageProps {
  params: Promise<{ offertaId: string }>;
}

export default async function ModificaOffertaDaOffertePage({
  params,
}: ModificaOffertaDaOffertePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { offertaId } = await params;
  const offerta = await offertaPerId(offertaId);

  if (!offerta) {
    notFound();
  }

  return (
    <OffertaForm
      cliente={{
        id: offerta.cliente.id,
        ragioneSociale: offerta.cliente.ragioneSociale,
        attivo: offerta.cliente.attivo,
      }}
      offerta={{
        id: offerta.id,
        codice: offerta.codice,
        descrizione: offerta.descrizione,
        tariffaGiornaliera: offerta.tariffaGiornaliera.toString().replace(".", ","),
        giorniPrevisti: offerta.giorniPrevisti,
      }}
      origine="offerte"
    />
  );
}
