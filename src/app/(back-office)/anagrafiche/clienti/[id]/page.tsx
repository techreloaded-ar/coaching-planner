import { richiediRuolo } from "@/lib/dal";
import { clientePerId } from "@/lib/clienti";
import { notFound } from "next/navigation";
import ClienteForm from "@/app/(back-office)/anagrafiche/clienti/cliente-form";

interface ModificaClientePageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaClientePage({ params }: ModificaClientePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const cliente = await clientePerId(id);

  if (!cliente) {
    notFound();
  }

  return <ClienteForm cliente={cliente} />;
}
