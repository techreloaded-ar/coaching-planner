import { ErroreImporter } from "./errori";
import { createHash, randomUUID } from "node:crypto";
import { categoriaDaTipologia, cercaOfferta, leggiData, leggiNumero, normalizzaTesto, CODICE_OFFERTA_MANCANTE } from "@/domain/righe-sospese/abbinamento";
import { preparaCoach } from "./coach";
import { LUNGHEZZA_MASSIMA_CODICE } from "@/domain/anagrafiche/valida-offerta";
import { cella } from "../../../scripts/importa-storico/foglio";
import type { ConfigImporter } from "./config";
import type { Anagrafiche, Archivio, Celle, Esistente, Giornata, Piano, RigaAnteprima, Schede } from "./types";
import { appendiNote } from "./senza-codice";

export function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function impronta(g: Giornata): string {
  return hash([g.collaboratoreId, g.clienteId, g.offertaId, g.data, Number(g.ore), g.categoria, Boolean(g.inAffiancamento),
    g.rimborsoTrasfertaImporto === null ? null : Number(g.rimborsoTrasfertaImporto), g.rimborsoTrasfertaEtichetta, g.nota]);
}
export function revisioneArchivio(a: Archivio): string {
  return hash([a.clienti, a.utenti, a.offerte, a.giornate.map((g) => [g.id, g.versione, impronta(g)]), a.rimborsi, a.registro]);
}
export function normalizzaRiga(row: Celle): Celle {
  const raw = Object.fromEntries(Object.keys(row).sort().map((key) => [key, normalizzaTesto(row[key])]));
  if (leggiData(row.data)) raw.data = leggiData(row.data)!;
  for (const k of ["ore", "giorni fatturati verso cliente", "spese coach"]) {
    if (leggiNumero(row[k]) !== null) raw[k] = String(leggiNumero(row[k]));
  }
  return raw;
}
const nome = (s: string) => s.replace(/\s+/g, " ").trim();
const euro = (n: number) => Math.round(n * 100) / 100;

export function preparaAnagrafiche(s: Schede, a: Archivio, cfg: ConfigImporter): Anagrafiche {
  const result: Anagrafiche = { clienti: [], offerte: [], coach: [], avvisi: [] };
  const clienti = new Map(a.clienti.map((c) => [normalizzaTesto(c.ragioneSociale), c.id]));
  const escluso = (s: string) => cfg.esclusi.includes(normalizzaTesto(s));
  const aggiungiCliente = (ragioneSociale: string, dettagli: Celle = {}) => {
    const key = normalizzaTesto(ragioneSociale);
    if (!key || escluso(key) || clienti.has(key)) return;
    const id = randomUUID();
    clienti.set(key, id);
    // Senza AI il testo originale rimane nelle note, nessun dato viene dedotto.
    const note = Object.entries(dettagli).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
    result.clienti.push({ id, ragioneSociale: nome(ragioneSociale), dettagli, dati: note ? { note } : {}, verifica: false });
  };
  for (const r of s.clienti) aggiungiCliente(cella(r, "Cliente"), Object.fromEntries(
    ["Intestazione Fattura", "Indirizzo Fatturazione", "Partita Iva", "Modalità invio fattura", "Persona di riferimento"].map((k) => [k, cella(r, k)])));
  const offerte = new Set(a.offerte.map((o) => `${o.clienteId}|${normalizzaTesto(o.codice)}`));
  for (const [i, r] of s.offerte.entries()) {
    const cliente = cella(r, "Cliente");
    if (!cliente || escluso(cliente)) continue;
    const anno = Number(/\b(19|20)\d{2}\b/.exec(cella(r, "Data"))?.[0]);
    const codice = nome(cella(r, "Offerta")).replace(/\.0$/, "") || CODICE_OFFERTA_MANCANTE;
    if (!anno || codice.length > LUNGHEZZA_MASSIMA_CODICE) { result.avvisi.push(`OFFERTE, riga ${i + 2}: anno o codice non valido (${cliente}).`); continue; }
    aggiungiCliente(cliente);
    const clienteId = clienti.get(normalizzaTesto(cliente))!;
    const key = `${clienteId}|${normalizzaTesto(codice)}`;
    if (offerte.has(key)) continue;
    const tariffa = leggiNumero(cella(r, "Tariffa Giornaliera", "Tariffa giornaliera venduta al cliente")) ?? 0;
    const spese = leggiNumero(cella(r, "Spese Forfait")) ?? 0;
    const giorni = leggiNumero(cella(r, "Numero Giornate Previste")) ?? 0;
    if ([tariffa, spese].some((v) => v < 0 || v > 99_999_999.99) || giorni < 0 || giorni > 2_147_483_647) { result.avvisi.push(`OFFERTE, riga ${i + 2}: importi fuori intervallo.`); continue; }
    offerte.add(key);
    const forfait = /^forfait/i.test(cella(r, "Tipologia Spese"));
    result.offerte.push({ id: randomUUID(), clienteId, codice, anno,
      descrizione: cella(r, "Descrizione"), tariffaGiornaliera: euro(tariffa).toFixed(2), giorniPrevisti: Math.round(giorni),
      gestioneTrasferta: forfait ? "FORFETTARIA" : "INCLUSA", importoTrasfertaForfettaria: forfait ? (spese > 0 ? euro(spese) : 220).toFixed(2) : null,
      attiva: /^(APERTA|SI|SÌ)$/.test(normalizzaTesto(cella(r, "STATO", "Attiva"))), numeroOrdine: cella(r, "Numero Ordine / BEF") || null,
      accountAgileReloaded: cella(r, "Account") || null });
  }
  result.coach = preparaCoach(s.coach, a, cfg, result.avvisi);
  return result;
}

export function preparaGiornata(row: Celle, s: Schede, a: Archivio, an: Anagrafiche, cfg: ConfigImporter): { proposta: Giornata | null; motivo: string; senzaCodice?: RigaAnteprima["senzaCodice"] } {
  const errore = (motivo: string) => ({ proposta: null, motivo });
  const coachMap = new Map(s.coach.map((r) => [normalizzaTesto(cella(r, "ID")), cella(r, "Email").toLowerCase()]));
  const email = coachMap.get(normalizzaTesto(cella(row, "Coach")));
  const collaboratoreId = a.utenti.find((u) => u.email.toLowerCase() === email)?.collaboratore?.id ?? an.coach.find((c) => c.email === email)?.id;
  if (!collaboratoreId) return errore("Collaboratore sconosciuto o senza profilo: correggi COACH o l’anagrafica e ripeti l’analisi.");
  const clienti = [...a.clienti, ...an.clienti];
  const matches = clienti.filter((c) => normalizzaTesto(c.ragioneSociale) === normalizzaTesto(cella(row, "Cliente")));
  if (matches.length !== 1) return errore("Cliente sconosciuto o ambiguo: correggi il foglio o l’anagrafica e ripeti l’analisi.");
  const clienteId = matches[0].id;
  const offerte = [...a.offerte, ...an.offerte];
  const codiceOriginale = cella(row, "Codice Offerta");
  // Il ripiego non deve diventare una deduzione fuzzy per altre righe o dopo
  // la prima importazione. Un codice vuoto non deduce mai l'unica offerta.
  const abbinabili = offerte.filter((o) => normalizzaTesto(o.codice) !== CODICE_OFFERTA_MANCANTE || normalizzaTesto(codiceOriginale) === CODICE_OFFERTA_MANCANTE);
  const ricerca = !normalizzaTesto(codiceOriginale) ? { offerta: null } : cercaOfferta(codiceOriginale, abbinabili.filter((o) => o.clienteId === clienteId), abbinabili, new Map(clienti.map((c) => [c.id, c.ragioneSociale])));
  if ("motivo" in ricerca && ricerca.motivo === "OFFERTA_ALTRO_CLIENTE") return errore(ricerca.nota);
  const senzaCodice: RigaAnteprima["senzaCodice"] = !normalizzaTesto(codiceOriginale)
    ? { motivo: "MANCANTE", codiceOriginale }
    : "motivo" in ricerca ? { motivo: ricerca.nota.startsWith("Codice ambiguo") ? "AMBIGUA" : "SCONOSCIUTA", codiceOriginale } : undefined;
  const dedotta = "dedotta" in ricerca ? ricerca.dedotta : undefined;
  const data = leggiData(cella(row, "Data"));
  if (!data) return errore("Data non leggibile.");
  const categoria = categoriaDaTipologia(cella(row, "Tipologia Fatturazione"), normalizzaTesto(cella(row, "Cliente")) === cfg.clienteInterno);
  if (!categoria) return errore("Tipologia di fatturazione sconosciuta.");
  let ore = leggiNumero(cella(row, "Ore"));
  if (cella(row, "Ore") && ore === null) return errore("Ore non numeriche.");
  const note: string[] = [];
  if (ore === null) {
    const giorni = leggiNumero(cella(row, "Giorni Fatturati verso Cliente"));
    ore = giorni && giorni > 0 ? giorni * 8 : 0;
    note.push(giorni && giorni > 0 ? `Ore ricavate dai giorni fatturati (${giorni})` : "Ore non indicate nel foglio originale");
  } else if (ore === 0) note.push("Ore pari a zero nel foglio originale");
  ore = euro(ore);
  if (ore < 0 || ore > 99.99) return errore("Ore fuori intervallo (0–99,99).");
  const spese = leggiNumero(cella(row, "Spese Coach"));
  if (dedotta && !senzaCodice) note.push(`Offerta dedotta: ${dedotta}`);
  const rimborso = spese !== null && spese > 0 ? euro(spese).toFixed(2) : null;
  const tipologia = normalizzaTesto(cella(row, "Tipologia Fatturazione"));
  if (!tipologia) note.push("Tipologia non indicata nel foglio originale");
  else if (!["FATTURABILE", "NON FATTURABILE", "INVESTIMENTO"].includes(tipologia)) note.push(`Tipologia nel foglio originale: ${cella(row, "Tipologia Fatturazione")}`);
  let offertaId = "offerta" in ricerca ? ricerca.offerta?.id ?? null : null;
  if (senzaCodice) {
    const ripieghi = offerte.filter((o) => o.clienteId === clienteId && normalizzaTesto(o.codice) === CODICE_OFFERTA_MANCANTE);
    if (ripieghi.length > 1) return errore("Più offerte SENZA CODICE per il cliente: correggi l’anagrafica e ripeti l’analisi.");
    offertaId = ripieghi[0]?.id ?? randomUUID();
    if (!ripieghi.length) an.offerte.push({ id: offertaId, clienteId, codice: CODICE_OFFERTA_MANCANTE, ripiego: true,
      anno: Number(data.slice(0, 4)), descrizione: "Attività importate con codice offerta mancante o non risolto", tariffaGiornaliera: "0.00", giorniPrevisti: 0,
      gestioneTrasferta: "INCLUSA", importoTrasfertaForfettaria: null, attiva: true, numeroOrdine: null, accountAgileReloaded: null });
    note.push(senzaCodice.motivo === "MANCANTE" ? "Importazione storico: codice offerta non indicato; associata a SENZA CODICE."
      : `Importazione storico: offerta “${codiceOriginale}” ${senzaCodice.motivo === "AMBIGUA" ? "ambigua; associata a SENZA CODICE per scelta dell’amministratore" : "non trovata; associata a SENZA CODICE"}.`);
  }
  return { proposta: { collaboratoreId, clienteId, offertaId, data,
    ore: ore.toFixed(2), categoria, inAffiancamento: tipologia === "PAIR", rimborsoTrasfertaImporto: rimborso,
    rimborsoTrasfertaEtichetta: rimborso ? a.rimborsi.find((r) => Number(r.importo) === Number(rimborso))?.etichetta ?? "Spese dal foglio storico" : null,
    nota: appendiNote(cella(row, "Note", "Nota"), ...note) }, senzaCodice,
    motivo: senzaCodice ? ("motivo" in ricerca ? ricerca.nota : "Codice offerta non indicato.") : dedotta ? `Offerta dedotta: ${dedotta}.` : "Giornata nuova." };
}

export function analizza(s: Schede, archivio: Archivio, cfg: ConfigImporter, modalita: Piano["modalita"] = "INCREMENTALE"): Piano {
  const a: Archivio = modalita === "RESET" ? { clienti: [], utenti: archivio.utenti.filter((u) => u.ruolo === "AMMINISTRATORE").map((u) => ({ ...u, collaboratore: null })), offerte: [], giornate: [], rimborsi: [], registro: [] } : archivio;
  const anagrafiche = preparaAnagrafiche(s, a, cfg);
  // Le identità usano riferimenti già risolti, date ISO e ore numeriche:
  // formati del foglio, note e colonne accessorie non cambiano la chiave.
  const identita = (g: Giornata, conOre = true) => hash([
    g.collaboratoreId, g.data, g.clienteId, g.offertaId,
    ...(conOre ? [Number(g.ore)] : []),
  ]);
  const occurrences = new Map<string, number>();
  const idVisti = new Set<string>();
  const righe: RigaAnteprima[] = s.giornate.flatMap((g, i) => {
    if (!Object.values(g).some(Boolean)) return [];
    const id = cella(g, "ID");
    if (id && idVisti.has(id)) throw new ErroreImporter("GIORNATE: ID ripetuti. Ogni giornata deve avere un ID distinto.");
    if (id) idVisti.add(id);
    const esclusa = cfg.esclusi.includes(normalizzaTesto(cella(g, "Cliente")));
    const parsed = esclusa ? { proposta: null, motivo: "Cliente escluso." } : preparaGiornata(g, s, a, anagrafiche, cfg);
    const base = id ? `id:${id}` : parsed.proposta ? `giornata:${identita(parsed.proposta)}` : hash(normalizzaRiga(g));
    const occ = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occ);
    const senzaCodice = "senzaCodice" in parsed ? parsed.senzaCodice : undefined;
    return [{ chiave: `${base}:${occ}`, numero: i + 2, grezzi: g, proposta: parsed.proposta, senzaCodice,
      stato: esclusa ? "IGNORATA" : senzaCodice?.motivo === "AMBIGUA" ? "VERIFICARE" : parsed.proposta ? "PRONTA" : "NON_IMPORTABILE",
      candidati: [], motivo: parsed.motivo }];
  });
  const registro = new Map(a.registro.map((r) => [r.chiave, r]));
  const giornatePerId = new Map(a.giornate.map((g) => [g.id, g]));
  const perChiave = new Map<string, Esistente[]>();
  const perChiaveSenzaOre = new Map<string, Esistente[]>();
  for (const g of a.giornate) {
    const key = identita(g), ridotta = identita(g, false);
    perChiave.set(key, [...(perChiave.get(key) ?? []), g]);
    perChiaveSenzaOre.set(ridotta, [...(perChiaveSenzaOre.get(ridotta) ?? []), g]);
  }
  const utilizzate = new Set<string>();
  const ambiguaDaDecidere = (r: RigaAnteprima) => r.senzaCodice?.motivo === "AMBIGUA" && !r.collegataId;
  const collega = (r: RigaAnteprima, esistente: Esistente) => {
    utilizzate.add(esistente.id);
    r.collegataId = esistente.id;
    r.candidati = [esistente];
    if (r.senzaCodice && r.proposta) r.proposta.nota = appendiNote(esistente.nota, r.proposta.nota);
    r.stato = impronta(r.proposta!) === impronta(esistente) ? "PRESENTE" : "AGGIORNARE";
    r.motivo = r.stato === "PRESENTE" ? "Già presente: collaboratore, data, cliente, offerta e ore corrispondono."
      : "Giornata riconosciuta: verrà aggiornata con i valori del foglio.";
  };
  // Il ripiego può cambiare l'offerta e quindi la chiave naturale. Riusa il
  // collegamento alla stessa occorrenza della fonte, anche per le vecchie analisi.
  const identitaFonte = (dati: Celle) => {
    const normalizzata = normalizzaRiga(dati);
    return hash(["coach", "cliente", "codice offerta", "data", "ore"].map((campo) => normalizzata[campo] ?? ""));
  };
  const registroPerFonte = new Map<string, typeof a.registro>();
  for (const voce of a.registro) {
    const key = identitaFonte(voce.dati);
    registroPerFonte.set(key, [...(registroPerFonte.get(key) ?? []), voce]);
  }
  for (const r of righe) {
    if (!r.senzaCodice || !r.proposta || r.chiave.startsWith("id:")) continue;
    const precedenti = registroPerFonte.get(identitaFonte(r.grezzi)) ?? [];
    const esistente = precedenti.map((voce) => voce.rigaAttivitaId ? giornatePerId.get(voce.rigaAttivitaId) : undefined)
      .find((g) => g && !utilizzate.has(g.id) && (r.senzaCodice?.motivo !== "AMBIGUA" || g.offertaId === r.proposta?.offertaId));
    if (esistente) collega(r, esistente);
  }
  // Un ID esplicito, quando disponibile, identifica anche cambi di data.
  for (const r of righe) {
    if (!r.proposta || r.collegataId || !r.chiave.startsWith("id:")) continue;
    const voce = registro.get(r.chiave);
    const id = voce?.rigaAttivitaId;
    const esistente = id ? giornatePerId.get(id) : undefined;
    if (ambiguaDaDecidere(r) && (!esistente || esistente.offertaId !== r.proposta.offertaId || normalizzaTesto(voce?.dati["codice offerta"]) !== normalizzaTesto(r.senzaCodice?.codiceOriginale))) continue;
    if (esistente && !utilizzate.has(esistente.id)) collega(r, esistente);
  }
  // Prima riserviamo TUTTE le corrispondenze complete. Una variazione delle ore
  // non deve consumare una giornata esatta che compare più avanti nel foglio.
  for (const r of righe) {
    if (!r.proposta || r.collegataId || ambiguaDaDecidere(r)) continue;
    const esatte = (perChiave.get(identita(r.proposta)) ?? []).filter((g) => !utilizzate.has(g.id));
    const esistente = esatte.find((g) => impronta(g) === impronta(r.proposta!)) ?? esatte[0];
    if (esistente) collega(r, esistente);
  }
  const daRisolvere = new Map<string, RigaAnteprima[]>();
  for (const r of righe) {
    if (!r.proposta || r.collegataId || ambiguaDaDecidere(r)) continue;
    const key = identita(r.proposta, false);
    daRisolvere.set(key, [...(daRisolvere.get(key) ?? []), r]);
  }
  for (const [key, gruppo] of daRisolvere) {
    const candidati = (perChiaveSenzaOre.get(key) ?? []).filter((g) => !utilizzate.has(g.id));
    if (gruppo.length === 1 && candidati.length === 1) {
      collega(gruppo[0], candidati[0]);
      gruppo[0].motivo = "Variazione delle ore: una sola corrispondenza per collaboratore, data, cliente e offerta. Verrà aggiornata.";
    } else if (candidati.length) {
      for (const r of gruppo) {
        r.stato = "VERIFICARE";
        r.candidati = candidati;
        r.motivo = "Più corrispondenze possibili per collaboratore, data, cliente e offerta. Scegli se aggiornare o aggiungere.";
      }
    }
  }
  // Segnala soltanto giornate collegate a questo documento dal suo registro.
  // Le righe manuali e i collegamenti già risolti/candidati non sono sparizioni.
  const protette = new Set(righe.flatMap((r) => [r.collegataId, ...r.candidati.map((g) => g.id)]).filter(Boolean));
  const chiaviPresenti = new Set(righe.map((r) => r.chiave));
  const identitaGiornoFonte = (dati: Celle) => {
    const raw = normalizzaRiga(dati);
    return hash([raw.coach, raw.cliente, raw.data]);
  };
  const fontiNonValide = new Set(righe.filter((r) => r.stato === "NON_IMPORTABILE" || r.stato === "IGNORATA").map((r) => identitaGiornoFonte(r.grezzi)));
  for (const voce of a.registro) {
    if (!voce.rigaAttivitaId || protette.has(voce.rigaAttivitaId) || chiaviPresenti.has(voce.chiave) || fontiNonValide.has(identitaGiornoFonte(voce.dati))) continue;
    const esistente = giornatePerId.get(voce.rigaAttivitaId);
    if (!esistente) continue;
    righe.push({ chiave: voce.chiave, numero: 0, grezzi: voce.dati, stato: "SCOMPARSA", proposta: null,
      candidati: [esistente], collegataId: esistente.id,
      motivo: "Giornata importata da questo documento, non più ritrovata nel foglio. È proposta l’eliminazione alla conferma dell’importazione; puoi scegliere di mantenerla nell’app." });
    protette.add(esistente.id);
  }
  return { versione: 6, origine: cfg.id, modalita, revisioneArchivio: revisioneArchivio(archivio), anagrafiche, righe,
    schede: s, riferimenti: { clienti: [...a.clienti, ...anagrafiche.clienti].map(({ id, ragioneSociale }) => ({ id, ragioneSociale })),
      offerte: [...a.offerte, ...anagrafiche.offerte].map(({ id, codice, clienteId }) => ({ id, codice, clienteId })),
      coach: [...a.utenti.filter((u) => u.collaboratore).map((u) => ({ id: u.collaboratore!.id, etichetta: u.email })), ...anagrafiche.coach.map((c) => ({ id: c.id, etichetta: `${c.nome} ${c.cognome} (${c.email})` }))] },
    ai: "Assistenza AI non configurata. Analisi deterministica disponibile." };
}
