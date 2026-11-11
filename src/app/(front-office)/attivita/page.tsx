import {
  risolviProfiloCollaboratoreCorrente,
  verificaSessione,
} from "@/lib/dal";
import {
  datiCalendarioMesePerCollaboratoreAutorizzato,
  righeDelMesePerCollaboratoreAutorizzato,
} from "@/lib/attivita";
import { collaboratoreConsultatoDellaPagina } from "@/lib/foglio-attivita";
import { tokenMeseCorrente, parseTokenMese } from "@/domain/calendario";
import CalendarioMensile from "./calendario-mensile";
import IndicatoreCalendario from "./indicatore-calendario";
import StatoProfiloCollaboratore from "./stato-profilo-collaboratore";
import BannerFoglioConsultato from "./banner-foglio-consultato";
import { calendarioCollegato } from "@/lib/proposte-calendario";
import ElencoAttivita from "./elenco-attivita";

export default async function AttivitaPage({
  searchParams,
}: {
  searchParams: Promise<{
    mese?: string;
    collaboratore?: string;
    vista?: string;
    cliente?: string;
    offerta?: string;
    nota?: string;
  }>;
}) {
  const sessione = await verificaSessione();
  const params = await searchParams;

  // Foglio di un altro collaboratore, aperto da un amministratore.
  const consultato = await collaboratoreConsultatoDellaPagina(
    sessione,
    params.collaboratore
  );

  // Token del mese: da query string o mese corrente
  const tokenRaw = params.mese ?? tokenMeseCorrente();
  const parsed = parseTokenMese(tokenRaw);
  const token = parsed ? tokenRaw : tokenMeseCorrente();

  // Vista Elenco: le righe del mese in tabella, filtrabili. Il calendario resta
  // la vista predefinita.
  const vistaElenco = params.vista === "elenco";
  const elenco = async (
    collaboratoreId: string,
    solaLettura: boolean,
    nomeCollaboratoreConsultato: string | null = null,
    indicatoreCalendario: Promise<React.ReactNode> | null = null
  ) => {
    const [righe, indicatore] = await Promise.all([
      righeDelMesePerCollaboratoreAutorizzato(token, collaboratoreId),
      indicatoreCalendario,
    ]);
    return (
      <ElencoAttivita
        token={token}
        righe={righe}
        filtriIniziali={{
          cliente: params.cliente ?? "",
          offerta: params.offerta ?? "",
          nota: params.nota ?? "",
        }}
        solaLettura={solaLettura}
        nomeCollaboratoreConsultato={nomeCollaboratoreConsultato}
        indicatoreCalendario={indicatore}
      />
    );
  };

  if (consultato) {
    if (vistaElenco) {
      return (
        <>
          <BannerFoglioConsultato collaboratore={consultato} />
          {await elenco(
            consultato.id,
            !consultato.attivo,
            `${consultato.nome} ${consultato.cognome}`
          )}
        </>
      );
    }

    // Il collegamento Google Calendar è personale: sul foglio di un altro
    // collaboratore non se ne mostra lo stato.
    const datiMese = await datiCalendarioMesePerCollaboratoreAutorizzato(
      token,
      consultato.id
    );

    return (
      <>
        <BannerFoglioConsultato collaboratore={consultato} />
        <CalendarioMensile
          datiMeseIniziale={datiMese}
          oggi={new Date().toISOString()}
        />
      </>
    );
  }

  // La sessione è già verificata: il resolver del profilo la riusa invece di
  // risolverla una seconda volta.
  const profilo = await risolviProfiloCollaboratoreCorrente(sessione);

  if (profilo.stato !== "ATTIVO") {
    return (
      <StatoProfiloCollaboratore
        stato={profilo.stato}
        amministratore={sessione.ruolo === "AMMINISTRATORE"}
      />
    );
  }

  // Dati del mese letti con il collaboratore già autorizzato: la query non
  // ripete la catena sessione → profilo. Etichetta del mese e griglia delle 42
  // celle sono derivate nel client dalle funzioni pure del dominio, quindi non
  // vengono serializzate nel payload.
  // Lo stato di Google Calendar sta in fondo alla barra del mese, letto in
  // parallelo ai dati della vista. La `key` serve perché l'elemento, creato
  // fuori dal render, arriva al client tra i figli della barra senza la
  // validazione statica del JSX e React in sviluppo lo segnalerebbe.
  const indicatoreCalendario = calendarioCollegato(profilo.collaboratore.id).then(
    (collegato) => <IndicatoreCalendario key="indicatore-calendario" collegato={collegato} />
  );

  if (vistaElenco) {
    return elenco(profilo.collaboratore.id, false, null, indicatoreCalendario);
  }

  const [datiMese, indicatore] = await Promise.all([
    datiCalendarioMesePerCollaboratoreAutorizzato(token, profilo.collaboratore.id),
    indicatoreCalendario,
  ]);

  return (
    <CalendarioMensile
      datiMeseIniziale={datiMese}
      oggi={new Date().toISOString()}
      indicatoreCalendario={indicatore}
    />
  );
}
