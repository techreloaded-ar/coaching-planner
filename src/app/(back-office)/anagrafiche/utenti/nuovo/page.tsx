import UtenteForm from "@/app/(back-office)/anagrafiche/utenti/utente-form";
import { richiediRuolo } from "@/lib/dal";

export default async function NuovoUtentePage() {
  await richiediRuolo("AMMINISTRATORE");

  return <UtenteForm />;
}
