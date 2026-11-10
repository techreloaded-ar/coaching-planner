import { richiediRuolo } from "@/lib/dal";
import PersonaForm from "../persona-form";

export default async function NuovaPersonaPage() {
  await richiediRuolo("AMMINISTRATORE");
  return <PersonaForm />;
}
