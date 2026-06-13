import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { offertaPerId } from "@/lib/offerte";
import OffertaForm from "../offerta-form";

interface ModificaOffertaPageProps {
  params: Promise<{ id: string; offertaId: string }>;
}

export default async function ModificaOffertaPage({
  params,
}: ModificaOffertaPageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id, offertaId } = await params;
  const offerta = await offertaPerId(offertaId);

  if (!offerta || offerta.clienteId !== id) {
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
    />
  );
}
