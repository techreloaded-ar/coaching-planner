import { randomUUID } from "node:crypto";
import { cella } from "../../../scripts/importa-storico/foglio";
import { leggiNumero, normalizzaTesto } from "@/domain/righe-sospese/abbinamento";
import { validaCensimentoUtente } from "@/domain/anagrafiche/valida-utente";
import { parseTokenMese, tokenMeseCorrente } from "@/domain/calendario";
import { tariffaValidaNelMese, validaVoceTariffa } from "@/domain/tariffe";
import { ErroreImporter } from "./errori";
import type { ConfigImporter } from "./config";
import type { Archivio, Celle, CoachImport } from "./types";

const iniziali = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (c) => c.toUpperCase());

/** Un'identità per ID, più periodi ordinati. Gli errori storici non possono
 * essere ignorati: saltare una scadenza prolungherebbe una tariffa precedente. */
export function preparaCoach(righe: Celle[], archivio: Archivio, cfg: ConfigImporter, avvisi: string[], mese = tokenMeseCorrente()): CoachImport[] {
  const gruppi = new Map<string, { righe: Celle[]; email: string }>();
  const emailIds = new Map<string, string>();
  for (const [i, r] of righe.entries()) {
    const id = normalizzaTesto(cella(r, "ID"));
    if (!id) continue;
    const email = cella(r, "Email").toLowerCase();
    const gruppo = gruppi.get(id);
    if ((emailIds.has(email) && emailIds.get(email) !== id) || (gruppo &&
      (gruppo.email !== email || ["Nome", "Cognome", "Partita Iva"].some((k) => normalizzaTesto(cella(gruppo.righe[0], k)) !== normalizzaTesto(cella(r, k)))))) {
      throw new ErroreImporter(`COACH, riga ${i + 2}: ID o email ripetuti con anagrafiche incoerenti.`);
    }
    emailIds.set(email, id);
    if (gruppo) gruppo.righe.push(r); else gruppi.set(id, { email, righe: [r] });
  }
  const result: CoachImport[] = [];
  for (const [id, gruppo] of gruppi) {
    const primo = gruppo.righe[0];
    const esistente = archivio.utenti.find((u) => u.email.toLowerCase() === gruppo.email);
    const conPeriodi = gruppo.righe.some((r) => Object.keys(r).some((k) => ["dal_mese", "al_mese"].includes(k)));
    // Il vecchio foglio senza importi può ancora riferire un coach già censito.
    if (!conPeriodi && esistente?.collaboratore) continue;
    const nome = iniziali(cella(primo, "Nome")), cognome = iniziali(cella(primo, "Cognome"));
    const partitaIva = cella(primo, "Partita Iva");
    const tariffe: NonNullable<CoachImport["tariffe"]> = [];
    for (const r of gruppo.righe) {
      const tipo = normalizzaTesto(cella(r, "Tipologia", "Tipo Tariffa"));
      const modalita = /percent/.test(tipo.toLowerCase()) ? "PERCENTUALE" : /giorn/i.test(tipo) ? "GIORNALIERA" : /fiss|mens/i.test(tipo) ? "FISSO_MENSILE" : null;
      const importo = leggiNumero(cella(r, "Importo", "Tariffa"));
      const dal = cella(r, "DAL_MESE") || (conPeriodi ? "" : cfg.dalMese);
      const al = cella(r, "AL_MESE") || null;
      const errori = validaVoceTariffa({ validaDalMese: dal, modalita: modalita ?? "", importo: importo?.toFixed(2) ?? "" });
      if (al && (!parseTokenMese(al) || al < dal)) errori.validaAlMese = "AL_MESE non valido o precedente a DAL_MESE";
      Object.assign(errori, validaCensimentoUtente({ nome, cognome, email: gruppo.email, partitaIva,
        ruoloAmministratore: cfg.amministratori.includes(gruppo.email), ruoloCollaboratore: true,
        modalitaTariffa: modalita ?? "", importoTariffa: importo?.toFixed(2) ?? "", tariffaValidaDalMese: dal }));
      if (!modalita || importo === null || Object.keys(errori).length) {
        const messaggio = `COACH ${id}: tariffa o dati non validi. ${Object.values(errori).join("; ")}`;
        if (conPeriodi) throw new ErroreImporter(messaggio);
        avvisi.push(messaggio); continue;
      }
      tariffe.push({ validaDalMese: dal, validaAlMese: al, modalita, importo: importo.toFixed(2) });
    }
    tariffe.sort((a, b) => a.validaDalMese.localeCompare(b.validaDalMese));
    for (let i = 1; i < tariffe.length; i++) {
      const prima = tariffe[i - 1], dopo = tariffe[i];
      if (prima.validaDalMese === dopo.validaDalMese || !prima.validaAlMese || prima.validaAlMese >= dopo.validaDalMese) {
        throw new ErroreImporter(`COACH ${id}: periodi sovrapposti o decorrenza ripetuta (${dopo.validaDalMese}).`);
      }
    }
    if (!tariffe.length) continue;
    const attivo = tariffaValidaNelMese(tariffe, mese) !== null;
    if (esistente?.collaboratore && JSON.stringify(esistente.collaboratore.tariffe) === JSON.stringify(tariffe) &&
      esistente.collaboratore.attivo === attivo && (esistente.ruolo === "AMMINISTRATORE" || esistente.attivo === attivo)) continue;
    result.push({ id: esistente?.collaboratore?.id ?? randomUUID(), userId: esistente?.id ?? randomUUID(),
      utenteEsistente: Boolean(esistente), profiloEsistente: Boolean(esistente?.collaboratore), nome, cognome, email: gruppo.email, partitaIva,
      ruolo: esistente?.ruolo ?? (cfg.amministratori.includes(gruppo.email) ? "AMMINISTRATORE" : "COLLABORATORE"),
      modalita: tariffe[0].modalita, importo: tariffe[0].importo, dalMese: tariffe[0].validaDalMese, tariffe, attivo });
  }
  return result;
}
