// Lettura delle schede del foglio storico, senza dipendenze esterne.
// Origine: link a un Google Sheets condiviso in lettura (una richiesta CSV per
// scheda) oppure un file .xlsx esportato a mano.

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

/** Riga della scheda: intestazione normalizzata → valore come testo, già ripulito. */
export type RigaFoglio = Record<string, string>;

export interface SchedaLetta {
  intestazioni: string[];
  righe: RigaFoglio[];
}

/** Intestazioni confrontate senza maiuscole, a capo e spazi doppi. */
export function normalizzaIntestazione(valore: string): string {
  return valore.trim().toLowerCase().replace(/\s+/g, " ");
}

const RE_ID_GOOGLE_SHEETS = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;

export interface OrigineFoglio {
  origineFoglio: string;
  fileServiceAccountGoogle: string;
}

export async function leggiScheda(origine: OrigineFoglio, nomeScheda: string): Promise<SchedaLetta> {
  const idGoogle = RE_ID_GOOGLE_SHEETS.exec(origine.origineFoglio)?.[1];
  const matrice = !idGoogle
    ? leggiSchedaXlsx(readFileSync(origine.origineFoglio), nomeScheda)
    : origine.fileServiceAccountGoogle
      ? await scaricaConServiceAccount(idGoogle, nomeScheda, origine.fileServiceAccountGoogle)
      : analizzaCsv(await scaricaCsvGoogle(idGoogle, nomeScheda));
  return inMappe(matrice, nomeScheda);
}

function inMappe(matrice: string[][], nomeScheda: string): SchedaLetta {
  const nonVuote = matrice.filter((r) => r.some((v) => v !== ""));
  if (nonVuote.length === 0) throw new Error(`La scheda "${nomeScheda}" è vuota`);
  const intestazioni = nonVuote[0].map(normalizzaIntestazione);
  const righe = nonVuote.slice(1).map((valori) => {
    const riga: RigaFoglio = {};
    intestazioni.forEach((nome, i) => {
      if (nome) riga[nome] = valori[i] ?? "";
    });
    return riga;
  });
  return { intestazioni: intestazioni.filter(Boolean), righe };
}

/** Errore chiaro se una colonna attesa manca, con le intestazioni trovate. */
export function richiediColonne(scheda: SchedaLetta, nomeScheda: string, colonne: string[]): void {
  const mancanti = colonne.filter((c) => !scheda.intestazioni.includes(normalizzaIntestazione(c)));
  if (mancanti.length > 0) {
    throw new Error(
      `Nella scheda "${nomeScheda}" mancano le colonne: ${mancanti.join(", ")}.\n` +
        `  Colonne trovate: ${scheda.intestazioni.join(" | ")}`,
    );
  }
}

/** Valore della prima colonna presente tra i nomi indicati (alias per intestazioni cambiate nel tempo). */
export function cella(riga: RigaFoglio, ...nomi: string[]): string {
  for (const nome of nomi) {
    const valore = riga[normalizzaIntestazione(nome)];
    if (valore !== undefined) return valore;
  }
  return "";
}

// ── Google Sheets con service account (Sheets API v4) ──────────

interface ChiaveServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const AMBITO_SHEETS_SOLA_LETTURA = "https://www.googleapis.com/auth/spreadsheets.readonly";
let tokenDiAccesso: Promise<string> | undefined;

/** Token OAuth2 per il service account: un JWT RS256 firmato con la chiave, scambiato una volta per esecuzione. */
function ottieniTokenServiceAccount(percorsoChiave: string): Promise<string> {
  return (tokenDiAccesso ??= (async () => {
    let chiave: ChiaveServiceAccount;
    try {
      chiave = JSON.parse(readFileSync(percorsoChiave, "utf8"));
    } catch {
      throw new Error(`Chiave del service account Google non leggibile: ${percorsoChiave}`);
    }
    const tokenUri = chiave.token_uri ?? "https://oauth2.googleapis.com/token";
    const base64Url = (dato: string | Buffer) => Buffer.from(dato).toString("base64url");
    const adesso = Math.floor(Date.now() / 1000);
    const intestazioneEClaim = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
      JSON.stringify({ iss: chiave.client_email, scope: AMBITO_SHEETS_SOLA_LETTURA, aud: tokenUri, iat: adesso, exp: adesso + 3600 }),
    )}`;
    const firma = createSign("RSA-SHA256").update(intestazioneEClaim).sign(chiave.private_key);
    const risposta = await fetch(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${intestazioneEClaim}.${base64Url(firma)}` }),
    });
    const corpo = (await risposta.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!risposta.ok || !corpo.access_token) throw new Error(`Google non ha rilasciato il token al service account: ${corpo.error ?? risposta.status} ${corpo.error_description ?? ""}`);
    return corpo.access_token;
  })());
}

async function scaricaConServiceAccount(id: string, nomeScheda: string, percorsoChiave: string): Promise<string[][]> {
  const token = await ottieniTokenServiceAccount(percorsoChiave);
  const intervallo = encodeURIComponent(`'${nomeScheda.replace(/'/g, "''")}'`);
  // UNFORMATTED_VALUE: numeri come numeri e date come seriali, non come testo formattato
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${intervallo}?valueRenderOption=UNFORMATTED_VALUE`;
  const risposta = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const corpo = (await risposta.json()) as { values?: unknown[][]; error?: { message?: string } };
  if (!risposta.ok) {
    throw new Error(
      `Scheda "${nomeScheda}" non leggibile con il service account (HTTP ${risposta.status}): ${corpo.error?.message ?? ""}\n` +
        `  Il foglio deve essere condiviso in lettura con l'email del service account e la Google Sheets API abilitata nel progetto.`,
    );
  }
  return (corpo.values ?? []).map((riga) => riga.map((v) => (v === null || v === undefined ? "" : String(v).trim())));
}

// ── Google Sheets pubblico (CSV anonimo) ────────────────────────

async function scaricaCsvGoogle(id: string, nomeScheda: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nomeScheda)}`;
  const risposta = await fetch(url, { redirect: "follow" });
  const tipo = risposta.headers.get("content-type") ?? "";
  if (!risposta.ok || !tipo.includes("csv")) {
    throw new Error(
      `Scheda "${nomeScheda}" non leggibile da Google Sheets (HTTP ${risposta.status}, ${tipo || "tipo ignoto"}).\n` +
        `  Il foglio deve essere condiviso come "Chiunque abbia il link può visualizzare" e la scheda deve esistere.`,
    );
  }
  return await risposta.text();
}

/** CSV secondo RFC 4180: virgolette, virgole e a capo dentro le celle. */
export function analizzaCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let cellaCorrente = "";
  let traVirgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (traVirgolette) {
      if (c === '"' && testo[i + 1] === '"') { cellaCorrente += '"'; i++; }
      else if (c === '"') traVirgolette = false;
      else cellaCorrente += c;
    } else if (c === '"') traVirgolette = true;
    else if (c === ",") { riga.push(cellaCorrente.trim()); cellaCorrente = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(cellaCorrente.trim()); righe.push(riga); riga = []; cellaCorrente = "";
    } else cellaCorrente += c;
  }
  if (cellaCorrente !== "" || riga.length > 0) { riga.push(cellaCorrente.trim()); righe.push(riga); }
  return righe;
}

// ── XLSX (zip di XML) ───────────────────────────────────────────

/** Estrae le voci di uno zip "stored" o "deflate" leggendo il central directory. */
function estraiZip(archivio: Buffer): Map<string, Buffer> {
  let fineDirectory = archivio.length - 22;
  while (fineDirectory >= 0 && archivio.readUInt32LE(fineDirectory) !== 0x06054b50) fineDirectory--;
  if (fineDirectory < 0) throw new Error("Il file non è un archivio zip (xlsx) valido");
  const numeroVoci = archivio.readUInt16LE(fineDirectory + 10);
  let posizione = archivio.readUInt32LE(fineDirectory + 16);
  const voci = new Map<string, Buffer>();
  for (let n = 0; n < numeroVoci; n++) {
    if (archivio.readUInt32LE(posizione) !== 0x02014b50) throw new Error("Central directory dello zip corrotto");
    const metodo = archivio.readUInt16LE(posizione + 10);
    const dimensioneCompressa = archivio.readUInt32LE(posizione + 20);
    const lunghezzaNome = archivio.readUInt16LE(posizione + 28);
    const lunghezzaExtra = archivio.readUInt16LE(posizione + 30);
    const lunghezzaCommento = archivio.readUInt16LE(posizione + 32);
    const offsetLocale = archivio.readUInt32LE(posizione + 42);
    const nome = archivio.toString("utf8", posizione + 46, posizione + 46 + lunghezzaNome);
    const inizioDati = offsetLocale + 30 + archivio.readUInt16LE(offsetLocale + 26) + archivio.readUInt16LE(offsetLocale + 28);
    const dati = archivio.subarray(inizioDati, inizioDati + dimensioneCompressa);
    voci.set(nome, metodo === 8 ? inflateRawSync(dati) : metodo === 0 ? Buffer.from(dati) : (() => { throw new Error(`Metodo di compressione zip non gestito: ${metodo}`); })());
    posizione += 46 + lunghezzaNome + lunghezzaExtra + lunghezzaCommento;
  }
  return voci;
}

function decodificaXml(testo: string): string {
  return testo
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Testo di un elemento ricco (<si> o <is>): concatena tutti i <t>. */
function testoRicco(xml: string): string {
  return decodificaXml([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
}

function indiceColonna(riferimento: string): number {
  let indice = 0;
  for (const lettera of riferimento.replace(/\d+/g, "")) indice = indice * 26 + (lettera.charCodeAt(0) - 64);
  return indice - 1;
}

export function leggiSchedaXlsx(archivio: Buffer, nomeScheda: string): string[][] {
  const voci = estraiZip(archivio);
  const leggi = (nome: string) => voci.get(nome)?.toString("utf8") ?? "";
  const workbook = leggi("xl/workbook.xml");
  const scheda = [...workbook.matchAll(/<sheet\b[^>]*?\/?>/g)]
    .map((m) => m[0])
    .find((tag) => decodificaXml(/name="([^"]*)"/.exec(tag)?.[1] ?? "").trim().toLowerCase() === nomeScheda.trim().toLowerCase());
  if (!scheda) {
    const nomi = [...workbook.matchAll(/<sheet\b[^>]*?name="([^"]*)"/g)].map((m) => decodificaXml(m[1]));
    throw new Error(`Scheda "${nomeScheda}" non presente nel file xlsx. Schede trovate: ${nomi.join(", ")}`);
  }
  const idRelazione = /r:id="([^"]+)"/.exec(scheda)?.[1];
  const relazioni = leggi("xl/_rels/workbook.xml.rels");
  const destinazione = new RegExp(`<Relationship\\b[^>]*?Id="${idRelazione}"[^>]*?Target="([^"]+)"|<Relationship\\b[^>]*?Target="([^"]+)"[^>]*?Id="${idRelazione}"`).exec(relazioni);
  const percorso = (destinazione?.[1] ?? destinazione?.[2] ?? "").replace(/^\/?(xl\/)?/, "xl/");
  const xmlScheda = leggi(percorso);
  if (!xmlScheda) throw new Error(`Contenuto della scheda "${nomeScheda}" non trovato nell'xlsx (${percorso})`);

  const stringheCondivise = [...leggi("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => testoRicco(m[1]));

  const matrice: string[][] = [];
  for (const [, attributiRiga, contenutoRiga] of xmlScheda.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const numeroRiga = Number(/\br="(\d+)"/.exec(attributiRiga)?.[1] ?? matrice.length + 1);
    const valori: string[] = [];
    for (const [, attributi, contenuto = ""] of contenutoRiga.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const riferimento = /\br="([A-Z]+)\d+"/.exec(attributi)?.[1];
      const tipo = /\bt="([^"]+)"/.exec(attributi)?.[1];
      const grezzo = /<v>([\s\S]*?)<\/v>/.exec(contenuto)?.[1] ?? "";
      let valore: string;
      if (tipo === "s") valore = stringheCondivise[Number(grezzo)] ?? "";
      else if (tipo === "inlineStr") valore = testoRicco(contenuto);
      else if (tipo === "b") valore = grezzo === "1" ? "true" : "false";
      else valore = decodificaXml(grezzo);
      valori[riferimento ? indiceColonna(riferimento) : valori.length] = valore.trim();
    }
    matrice[numeroRiga - 1] = Array.from(valori, (v) => v ?? "");
  }
  return matrice.map((r) => r ?? []);
}
