import { richiediPermesso } from "@/lib/dal";
import ClienteForm from "@/app/(back-office)/anagrafiche/clienti/cliente-form";

export default async function NuovoClientePage() {
  await richiediPermesso("GESTIRE_CLIENTI");

  return <ClienteForm />;
}
