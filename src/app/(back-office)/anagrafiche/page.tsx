import { richiediRuolo } from "@/lib/dal";

export default async function AnagrafichePage() {
  await richiediRuolo("AMMINISTRATORE");

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <h1 className="text-2xl font-bold">Anagrafiche</h1>
      <p className="text-zinc-500 mt-2">
        Gestione clienti, offerte e collaboratori — in arrivo
      </p>
    </div>
  );
}
