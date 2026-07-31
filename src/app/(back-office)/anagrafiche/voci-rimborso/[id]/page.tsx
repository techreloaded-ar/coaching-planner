import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { vocePerId } from "@/lib/voci-rimborso";
import VoceRimborsoForm from "../voce-rimborso-form";

interface ModificaVoceRimborsoPageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaVoceRimborsoPage({ params }: ModificaVoceRimborsoPageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const voce = await vocePerId(id);

  if (!voce) {
    notFound();
  }

  return (
    <VoceRimborsoForm
      voce={{
        id: voce.id,
        etichetta: voce.etichetta,
        importo: voce.importo.toString().replace(".", ","),
      }}
    />
  );
}
