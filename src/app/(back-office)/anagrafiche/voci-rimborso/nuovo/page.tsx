import { richiediRuolo } from "@/lib/dal";
import VoceRimborsoForm from "../voce-rimborso-form";

export default async function NuovaVoceRimborsoPage() {
  await richiediRuolo("AMMINISTRATORE");

  return <VoceRimborsoForm />;
}
