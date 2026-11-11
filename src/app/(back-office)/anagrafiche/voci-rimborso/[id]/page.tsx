import { notFound } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";
import { vocePerId } from "@/lib/voci-rimborso";
import VoceRimborsoForm from "../voce-rimborso-form";

interface ModificaVoceRimborsoPageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaVoceRimborsoPage({ params }: ModificaVoceRimborsoPageProps) {
  await richiediPermesso("GESTIRE_VOCI_RIMBORSO");

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
