import { richiediRuolo } from "@/lib/dal";
import { attivitaDelMese } from "@/lib/attivita";
import {
  tokenMeseCorrente,
  parseTokenMese,
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
  costruisciGrigliaMese,
} from "@/domain/calendario";
import CalendarioMensile from "./calendario-mensile";

export default async function AttivitaPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  await richiediRuolo("COLLABORATORE");

  const params = await searchParams;

  // Token del mese: da query string o mese corrente
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const parsed = parseTokenMese(tokenRaw);
  const token = parsed ? tokenRaw : tokenMeseCorrente();

  // Navigazione
  const tokenPrev = mesePrecedente(token);
  const tokenNext = meseSuccessivo(token);
  const etichetta = etichettaMese(token);

  // Dati del mese
  const { perGiorno, righe } = await attivitaDelMese(token);
  const griglia = costruisciGrigliaMese(token);

  // Conversione Map → plain object e Date → string per il passaggio al client component
  const sintesiPlain = Object.fromEntries(perGiorno);
  const grigliaPlain = JSON.parse(JSON.stringify(griglia));

  return (
    <CalendarioMensile
      token={token}
      tokenPrecedente={tokenPrev}
      tokenSuccessivo={tokenNext}
      etichetta={etichetta}
      griglia={grigliaPlain}
      sintesi={sintesiPlain}
      oggi={new Date().toISOString()}
    />
  );
}
