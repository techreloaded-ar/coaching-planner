import { crc32 } from "node:zlib";

// Writer xlsx minimo: uno .xlsx è uno zip di poche parti OOXML. Niente
// dipendenze esterne; supporta stringhe, numeri e pochi stili di base.

export type StileCella =
  | "grassetto"
  | "importo"
  | "importoGrassetto"
  | "giornate";

export type Cella =
  | string
  | number
  | null
  | { valore: string | number; stile: StileCella };

export interface FoglioXlsx {
  nome: string;
  righe: Cella[][];
  /** Larghezza in caratteri per ciascuna colonna, a partire dalla A */
  larghezzeColonne?: number[];
}

/** Indice in `cellXfs` di xl/styles.xml (0 = nessuno stile). */
const INDICE_STILE: Record<StileCella, number> = {
  grassetto: 1,
  importo: 2,
  importoGrassetto: 3,
  giornate: 4,
};

const CARATTERI_NON_AMMESSI_NOME_FOGLIO = /[[\]:*?/\\]/;
const CARATTERI_CONTROLLO_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function escapeXml(testo: string): string {
  return testo
    .replace(CARATTERI_CONTROLLO_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0 → A, 25 → Z, 26 → AA ... */
function lettereColonna(indice: number): string {
  let lettere = "";
  let resto = indice;
  do {
    lettere = String.fromCharCode(65 + (resto % 26)) + lettere;
    resto = Math.floor(resto / 26) - 1;
  } while (resto >= 0);
  return lettere;
}

function riferimentoCella(indiceColonna: number, numeroRiga: number): string {
  return `${lettereColonna(indiceColonna)}${numeroRiga}`;
}

function validaFogli(fogli: FoglioXlsx[]): void {
  if (fogli.length === 0) {
    throw new Error("Almeno un foglio è richiesto per creare un file xlsx");
  }

  const nomiUsati = new Set<string>();
  for (const foglio of fogli) {
    const { nome } = foglio;
    if (nome.trim() === "" || nome.length > 31) {
      throw new Error(
        `Nome foglio non valido "${nome}": da 1 a 31 caratteri`,
      );
    }
    if (CARATTERI_NON_AMMESSI_NOME_FOGLIO.test(nome)) {
      throw new Error(
        `Nome foglio non valido "${nome}": caratteri [ ] : * ? / \\ non ammessi`,
      );
    }
    const chiave = nome.toLowerCase();
    if (nomiUsati.has(chiave)) {
      throw new Error(`Nome foglio duplicato: "${nome}"`);
    }
    nomiUsati.add(chiave);
  }
}

function xmlCella(
  cella: Exclude<Cella, null>,
  indiceColonna: number,
  numeroRiga: number,
): string {
  const valore = typeof cella === "object" ? cella.valore : cella;
  const stile = typeof cella === "object" ? INDICE_STILE[cella.stile] : null;
  const attributoStile = stile === null ? "" : ` s="${stile}"`;
  const riferimento = riferimentoCella(indiceColonna, numeroRiga);

  if (typeof valore === "number") {
    if (!Number.isFinite(valore)) {
      throw new Error(`Valore numerico non finito nella cella ${riferimento}`);
    }
    return `<c r="${riferimento}"${attributoStile}><v>${valore}</v></c>`;
  }

  return `<c r="${riferimento}" t="inlineStr"${attributoStile}><is><t xml:space="preserve">${escapeXml(valore)}</t></is></c>`;
}

function xmlFoglio(foglio: FoglioXlsx): string {
  const colonne = foglio.larghezzeColonne?.length
    ? `<cols>${foglio.larghezzeColonne
        .map(
          (larghezza, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${larghezza}" customWidth="1"/>`,
        )
        .join("")}</cols>`
    : "";

  const righe = foglio.righe
    .map((riga, indiceRiga) => {
      const numeroRiga = indiceRiga + 1;
      const celle = riga
        .map((cella, indiceColonna) =>
          cella === null ? "" : xmlCella(cella, indiceColonna, numeroRiga),
        )
        .join("");
      return celle === ""
        ? `<row r="${numeroRiga}"/>`
        : `<row r="${numeroRiga}">${celle}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colonne}<sheetData>${righe}</sheetData></worksheet>`;
}

const INTESTAZIONE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_RELAZIONI_PACCHETTO =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_RELAZIONI_DOCUMENTO =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function xmlContentTypes(numeroFogli: number): string {
  const fogli = Array.from(
    { length: numeroFogli },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `${INTESTAZIONE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${fogli}</Types>`;
}

function xmlRelazioniRadice(): string {
  return `${INTESTAZIONE_XML}<Relationships xmlns="${NS_RELAZIONI_PACCHETTO}"><Relationship Id="rId1" Type="${NS_RELAZIONI_DOCUMENTO}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function xmlWorkbook(fogli: FoglioXlsx[]): string {
  const elenco = fogli
    .map(
      (foglio, i) =>
        `<sheet name="${escapeXml(foglio.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");
  return `${INTESTAZIONE_XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_RELAZIONI_DOCUMENTO}"><sheets>${elenco}</sheets></workbook>`;
}

function xmlRelazioniWorkbook(numeroFogli: number): string {
  const fogli = Array.from(
    { length: numeroFogli },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="${NS_RELAZIONI_DOCUMENTO}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join("");
  return `${INTESTAZIONE_XML}<Relationships xmlns="${NS_RELAZIONI_PACCHETTO}">${fogli}<Relationship Id="rId${numeroFogli + 1}" Type="${NS_RELAZIONI_DOCUMENTO}/styles" Target="styles.xml"/></Relationships>`;
}

function xmlStili(): string {
  return `${INTESTAZIONE_XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0#"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
}

interface ParteZip {
  nome: string;
  dati: Buffer;
}

// ponytail: zip senza compressione, i file sono piccoli; usare deflate
// (`zlib.deflateRawSync`, metodo 8) se le dimensioni diventano rilevanti.
function creaZip(parti: ParteZip[]): Buffer {
  const DATA_DOS_1980_01_01 = 0x0021;
  const locali: Buffer[] = [];
  const centrali: Buffer[] = [];
  let offset = 0;

  for (const { nome, dati } of parti) {
    const nomeBuffer = Buffer.from(nome, "utf8");
    const crc = crc32(dati);

    const locale = Buffer.alloc(30);
    locale.writeUInt32LE(0x04034b50, 0);
    locale.writeUInt16LE(20, 4); // versione necessaria
    locale.writeUInt16LE(0, 6); // flag
    locale.writeUInt16LE(0, 8); // metodo 0 = store
    locale.writeUInt16LE(0, 10); // ora
    locale.writeUInt16LE(DATA_DOS_1980_01_01, 12);
    locale.writeUInt32LE(crc, 14);
    locale.writeUInt32LE(dati.length, 18);
    locale.writeUInt32LE(dati.length, 22);
    locale.writeUInt16LE(nomeBuffer.length, 26);
    locale.writeUInt16LE(0, 28); // extra

    const centrale = Buffer.alloc(46);
    centrale.writeUInt32LE(0x02014b50, 0);
    centrale.writeUInt16LE(20, 4); // versione creata
    centrale.writeUInt16LE(20, 6); // versione necessaria
    centrale.writeUInt16LE(0, 8);
    centrale.writeUInt16LE(0, 10);
    centrale.writeUInt16LE(0, 12);
    centrale.writeUInt16LE(DATA_DOS_1980_01_01, 14);
    centrale.writeUInt32LE(crc, 16);
    centrale.writeUInt32LE(dati.length, 20);
    centrale.writeUInt32LE(dati.length, 24);
    centrale.writeUInt16LE(nomeBuffer.length, 28);
    centrale.writeUInt32LE(offset, 42);

    locali.push(locale, nomeBuffer, dati);
    centrali.push(centrale, nomeBuffer);
    offset += locale.length + nomeBuffer.length + dati.length;
  }

  const dimensioneCentrale = centrali.reduce((s, b) => s + b.length, 0);
  const fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0);
  fine.writeUInt16LE(parti.length, 8);
  fine.writeUInt16LE(parti.length, 10);
  fine.writeUInt32LE(dimensioneCentrale, 12);
  fine.writeUInt32LE(offset, 16);

  return Buffer.concat([...locali, ...centrali, fine]);
}

/**
 * Crea un file .xlsx con un foglio per elemento di `fogli`.
 *
 * @throws Error se non ci sono fogli, un nome foglio non è valido o duplicato,
 *   o una cella numerica non è finita
 */
export function creaXlsx(fogli: FoglioXlsx[]): Buffer {
  validaFogli(fogli);

  const parti: ParteZip[] = [
    { nome: "[Content_Types].xml", testo: xmlContentTypes(fogli.length) },
    { nome: "_rels/.rels", testo: xmlRelazioniRadice() },
    { nome: "xl/workbook.xml", testo: xmlWorkbook(fogli) },
    {
      nome: "xl/_rels/workbook.xml.rels",
      testo: xmlRelazioniWorkbook(fogli.length),
    },
    { nome: "xl/styles.xml", testo: xmlStili() },
    ...fogli.map((foglio, i) => ({
      nome: `xl/worksheets/sheet${i + 1}.xml`,
      testo: xmlFoglio(foglio),
    })),
  ].map(({ nome, testo }) => ({ nome, dati: Buffer.from(testo, "utf8") }));

  return creaZip(parti);
}
