import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import { riepilogoMesePerCollaboratoreAutorizzato } from "@/lib/attivita";
import { collaboratoreConsultatoDellaPagina } from "@/lib/foglio-attivita";
import {
  tokenMeseCorrente,
  parseTokenMese,
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
} from "@/domain/calendario";
import RiepilogoMese from "./riepilogo-mese";
import StatoProfiloCollaboratore from "../stato-profilo-collaboratore";
import BannerFoglioConsultato from "../banner-foglio-consultato";

export default async function RiepilogoMesePage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string; collaboratore?: string }>;
}) {
  const sessione = await verificaSessione();
  const params = await searchParams;

  // Foglio di un altro collaboratore, aperto da un amministratore.
  const consultato = await collaboratoreConsultatoDellaPagina(
    sessione,
    params.collaboratore
  );

  let collaboratoreId: string;
  if (consultato) {
    collaboratoreId = consultato.id;
  } else {
    const profilo = await risolviProfiloCollaboratoreCorrente(sessione);

    if (profilo.stato !== "ATTIVO") {
      return (
        <StatoProfiloCollaboratore
          stato={profilo.stato}
          amministratore={sessione.ruolo === "AMMINISTRATORE"}
        />
      );
    }
    collaboratoreId = profilo.collaboratore.id;
  }

  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const token = parseTokenMese(tokenRaw) ? tokenRaw : tokenMeseCorrente();

  const riepilogo = await riepilogoMesePerCollaboratoreAutorizzato(
    token,
    collaboratoreId
  );

  return (
    <>
      {consultato && <BannerFoglioConsultato collaboratore={consultato} />}
      <RiepilogoMese
        token={token}
        tokenPrecedente={mesePrecedente(token)}
        tokenSuccessivo={meseSuccessivo(token)}
        etichetta={etichettaMese(token)}
        riepilogo={riepilogo}
      />
    </>
  );
}
