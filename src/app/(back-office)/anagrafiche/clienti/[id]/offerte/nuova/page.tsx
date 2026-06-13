import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { clientePerId } from "@/lib/clienti";
import OffertaForm from "../offerta-form";

interface NuovaOffertaPageProps {
  params: Promise<{ id: string }>;
}

export default async function NuovaOffertaPage({ params }: NuovaOffertaPageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const cliente = await clientePerId(id);

  if (!cliente) {
    notFound();
  }

  return (
    <OffertaForm
      cliente={{
        id: cliente.id,
        ragioneSociale: cliente.ragioneSociale,
        attivo: cliente.attivo,
      }}
    />
  );
}
