import { richiediRuolo } from "@/lib/dal";
import { collaboratorePerId } from "@/lib/collaboratori";
import { notFound } from "next/navigation";
import CollaboratoreForm from "@/app/(back-office)/anagrafiche/collaboratori/collaboratore-form";

interface ModificaCollaboratorePageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaCollaboratorePage({ params }: ModificaCollaboratorePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const collaboratore = await collaboratorePerId(id);

  if (!collaboratore) {
    notFound();
  }

  return (
    <CollaboratoreForm
      collaboratore={{
        ...collaboratore,
        tariffaGiornaliera: collaboratore.tariffaGiornaliera.toString(),
      }}
    />
  );
}
