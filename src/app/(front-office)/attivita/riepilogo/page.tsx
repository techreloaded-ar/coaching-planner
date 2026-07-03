import { richiediRuolo } from "@/lib/dal";
import { riepilogoMese } from "@/lib/attivita";
import {
  tokenMeseCorrente,
  parseTokenMese,
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
} from "@/domain/calendario";
import RiepilogoMese from "./riepilogo-mese";

export default async function RiepilogoMesePage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  await richiediRuolo("COLLABORATORE");

  const params = await searchParams;
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const token = parseTokenMese(tokenRaw) ? tokenRaw : tokenMeseCorrente();

  const riepilogo = await riepilogoMese(token);

  return (
    <RiepilogoMese
      token={token}
      tokenPrecedente={mesePrecedente(token)}
      tokenSuccessivo={meseSuccessivo(token)}
      etichetta={etichettaMese(token)}
      riepilogo={riepilogo}
    />
  );
}
