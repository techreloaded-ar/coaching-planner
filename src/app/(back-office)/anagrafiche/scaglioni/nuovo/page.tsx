import { richiediRuolo } from "@/lib/dal";
import { elencaScaglioni } from "@/lib/scaglioni";
import ScaglioneForm from "../scaglione-form";

export default async function NuovoScaglionePage() {
  await richiediRuolo("AMMINISTRATORE");

  const scaglioni = await elencaScaglioni();

  return (
    <ScaglioneForm
      scaglioniEsistenti={scaglioni.map((scaglione) => ({
        id: scaglione.id,
        finoAKm: scaglione.finoAKm,
      }))}
    />
  );
}
