import UtenteForm from "@/app/(back-office)/anagrafiche/utenti/utente-form";
import { richiediRuolo } from "@/lib/dal";
import { utentePerId } from "@/lib/utenti";
import { notFound } from "next/navigation";

interface ModificaUtentePageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaUtentePage({
  params,
}: ModificaUtentePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const utente = await utentePerId(id);

  if (!utente) {
    notFound();
  }

  return <UtenteForm utente={utente} />;
}
