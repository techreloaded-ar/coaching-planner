import { notFound, redirect } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { collaboratorePerId } from "@/lib/collaboratori";

export default async function CollaboratorePrecedente({ params }: { params: Promise<{ id: string }> }) {
  await richiediRuolo("AMMINISTRATORE");
  const { id } = await params;
  const collaboratore = await collaboratorePerId(id);
  if (!collaboratore) notFound();
  redirect(`/anagrafiche/persone/${encodeURIComponent(collaboratore.userId)}?sezione=attivita`);
}
