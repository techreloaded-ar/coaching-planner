import { richiediPermesso } from "@/lib/dal";
import PersonaForm from "../persona-form";

export default async function NuovaPersonaPage() {
  await richiediPermesso("GESTIRE_UTENTI");
  return <PersonaForm />;
}
