import { richiediRuolo } from "@/lib/dal";
import CollaboratoreForm from "@/app/(back-office)/anagrafiche/collaboratori/collaboratore-form";

export default async function NuovoCollaboratorePage() {
  await richiediRuolo("AMMINISTRATORE");

  return <CollaboratoreForm />;
}
