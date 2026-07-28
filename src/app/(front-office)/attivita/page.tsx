import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { attivitaDelMese } from "@/lib/attivita";
import {
  tokenMeseCorrente,
  parseTokenMese,
  etichettaMese,
  costruisciGrigliaMese,
} from "@/domain/calendario";
import CalendarioMensile from "./calendario-mensile";
import StatoProfiloCollaboratore from "./stato-profilo-collaboratore";

function formattaDataISO(data: Date): string {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, "0");
  const giorno = String(data.getDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

export default async function AttivitaPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  const sessione = await verificaSessione();
  const profilo = await risolviProfiloCollaboratoreCorrente();

  if (profilo.stato !== "ATTIVO") {
    return (
      <StatoProfiloCollaboratore
        stato={profilo.stato}
        amministratore={sessione.ruolo === "AMMINISTRATORE"}
      />
    );
  }

  const params = await searchParams;

  // Token del mese: da query string o mese corrente
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const parsed = parseTokenMese(tokenRaw);
  const token = parsed ? tokenRaw : tokenMeseCorrente();

  // Navigazione: i token adiacenti sono calcolati lato client dal calendario
  const etichetta = etichettaMese(token);

  // Dati del mese
  const { perGiorno } = await attivitaDelMese(token);
  const griglia = costruisciGrigliaMese(token);

  // Conversione Map → plain object e Date → string per il passaggio al client component
  const sintesiPlain = Object.fromEntries(perGiorno);
  const grigliaPlain = griglia.map((cella) => ({
    ...cella,
    data: formattaDataISO(cella.data),
  }));

  return (
    <CalendarioMensile
      token={token}
      etichetta={etichetta}
      griglia={grigliaPlain}
      sintesi={sintesiPlain}
      oggi={new Date().toISOString()}
    />
  );
}
