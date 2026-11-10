import { ErroreImporter } from "./errori";
import type { Decisione, Piano, RigaAnteprima } from "./types";

export function operazioni(piano: Piano, decisioni: Decisione[]) {
  const scelte = new Map<string, Decisione>();
  for (const d of decisioni) {
    if (scelte.has(d.chiave) || !piano.righe.some((r) => r.chiave === d.chiave)) throw new ErroreImporter("Scelta duplicata o riga non presente nell’anteprima.");
    if (!["NUOVA", "AGGIORNA", "COLLEGA", "IGNORA", "SENZA_CODICE", "ELIMINA"].includes(d.azione)) throw new ErroreImporter("Azione non valida.");
    scelte.set(d.chiave, d);
  }
  const targets = new Set<string>();
  return piano.righe.flatMap<{ riga: RigaAnteprima; azione: Decisione["azione"]; destinazione?: string }>((r) => {
    const scelta = scelte.get(r.chiave);
    if (r.stato === "SCOMPARSA") {
      if (scelta?.azione === "IGNORA") return [{ riga: r, azione: "IGNORA" }];
      if ((scelta && scelta.azione !== "ELIMINA") || r.candidati.length !== 1 || r.collegataId !== r.candidati[0].id ||
        piano.righe.some((altra) => altra !== r && altra.stato !== "SCOMPARSA" && (altra.collegataId === r.collegataId || altra.candidati.some((g) => g.id === r.collegataId))) || targets.has(r.collegataId)) {
        throw new ErroreImporter("Puoi eliminare soltanto una giornata non più presente nel foglio e senza altri abbinamenti.");
      }
      targets.add(r.collegataId);
      return [{ riga: r, azione: "ELIMINA", destinazione: r.collegataId }];
    }
    if (scelta?.azione === "ELIMINA") throw new ErroreImporter("Si possono eliminare soltanto le giornate non più presenti nel foglio.");
    if (r.stato === "PRESENTE") {
      if (!r.collegataId) throw new ErroreImporter("Collegamento mancante.");
      if (scelta) throw new ErroreImporter("Una riga già presente non può essere modificata da questa anteprima.");
      return [{ riga: r, azione: "COLLEGA" as const, destinazione: r.collegataId }];
    }
    if (r.stato === "IGNORATA") return [];
    if (scelta?.azione === "SENZA_CODICE" && !(r.stato === "VERIFICARE" && r.senzaCodice?.motivo === "AMBIGUA" && !r.candidati.length && r.proposta)) {
      throw new ErroreImporter("La scelta SENZA CODICE è disponibile soltanto per un’offerta ambigua valida.");
    }
    if (r.stato === "VERIFICARE" && r.senzaCodice?.motivo === "AMBIGUA" && !r.candidati.length && scelta && !["SENZA_CODICE", "IGNORA"].includes(scelta.azione)) {
      throw new ErroreImporter("Conferma esplicitamente l’importazione dell’offerta ambigua su SENZA CODICE.");
    }
    const azione = scelta?.azione === "SENZA_CODICE" ? "NUOVA" : scelta?.azione ?? (r.stato === "PRONTA" ? "NUOVA" : r.stato === "AGGIORNARE" ? "AGGIORNA" : null);
    if (!azione) return [];
    if (azione !== "IGNORA" && !r.proposta) throw new ErroreImporter("Una riga senza dati validi può soltanto essere ignorata. Correggi la fonte e ripeti l’analisi.");
    if (azione === "AGGIORNA" || azione === "COLLEGA") {
      const destinazione = scelta?.destinazione ?? (r.stato === "AGGIORNARE" ? r.collegataId : undefined);
      if (!destinazione || !r.candidati.some((c) => c.id === destinazione)) throw new ErroreImporter("Seleziona una giornata proposta nell’anteprima.");
      if (targets.has(destinazione)) throw new ErroreImporter("Due righe non possono aggiornare o collegare la stessa giornata nella stessa importazione.");
      // Non sovrascrivere una giornata che un'altra riga del foglio descrive già esattamente.
      if (piano.righe.some((other) => other.chiave !== r.chiave && other.stato === "PRESENTE" && other.collegataId === destinazione)) throw new ErroreImporter("La giornata è già collegata a un’altra riga del foglio. Aggiungi come nuova oppure ignora.");
      targets.add(destinazione);
      if (azione === "COLLEGA") throw new ErroreImporter("Per le righe modificate scegli Aggiorna oppure Aggiungi come nuova.");
    }
    return [{ riga: r, azione, destinazione: scelta?.destinazione ?? (r.stato === "AGGIORNARE" ? r.collegataId : undefined) }];
  });
}


export function parseDecisioni(form: FormData): Decisione[] {
  const decisioni: Decisione[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("scelta:") || typeof value !== "string" || !value) continue;
    const chiave = key.slice(7);
    if (value === "NUOVA" || value === "IGNORA" || value === "SENZA_CODICE" || value === "ELIMINA") decisioni.push({ chiave, azione: value });
    else if (value.startsWith("AGGIORNA:")) decisioni.push({ chiave, azione: "AGGIORNA", destinazione: value.slice(9) });
    else throw new ErroreImporter("Scelta non valida.");
  }
  return decisioni;
}

