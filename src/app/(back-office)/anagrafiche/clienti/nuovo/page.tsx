import { richiediRuolo } from "@/lib/dal";
import ClienteForm from "@/app/(back-office)/anagrafiche/clienti/cliente-form";

export default async function NuovoClientePage() {
  await richiediRuolo("AMMINISTRATORE");

  return <ClienteForm />;
}
