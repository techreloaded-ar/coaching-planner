import { notFound } from "next/navigation";
import { richiediRuolo } from "@/lib/dal";
import { elencaScaglioni, scaglionePerId } from "@/lib/scaglioni";
import ScaglioneForm from "../scaglione-form";

interface ModificaScaglionePageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaScaglionePage({ params }: ModificaScaglionePageProps) {
  await richiediRuolo("AMMINISTRATORE");

  const { id } = await params;
  const [scaglione, scaglioni] = await Promise.all([
    scaglionePerId(id),
    elencaScaglioni(),
  ]);

  if (!scaglione) {
    notFound();
  }

  return (
    <ScaglioneForm
      scaglioniEsistenti={scaglioni.map((s) => ({ id: s.id, finoAKm: s.finoAKm }))}
      scaglione={{
        id: scaglione.id,
        finoAKm: scaglione.finoAKm,
        importo: scaglione.importo.toString().replace(".", ","),
      }}
    />
  );
}
