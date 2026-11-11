import { richiediPermesso } from "@/lib/dal";
import VoceRimborsoForm from "../voce-rimborso-form";

export default async function NuovaVoceRimborsoPage() {
  await richiediPermesso("GESTIRE_VOCI_RIMBORSO");

  return <VoceRimborsoForm />;
}
