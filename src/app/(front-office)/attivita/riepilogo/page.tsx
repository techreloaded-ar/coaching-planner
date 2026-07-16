import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { riepilogoMese } from "@/lib/attivita";
import {
  tokenMeseCorrente,
  parseTokenMese,
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
} from "@/domain/calendario";
import RiepilogoMese from "./riepilogo-mese";
import StatoProfiloCollaboratore from "../stato-profilo-collaboratore";

export default async function RiepilogoMesePage({
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
