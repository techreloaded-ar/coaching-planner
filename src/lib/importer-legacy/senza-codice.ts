import type { RigaAnteprima } from "./types";

/** Append idempotente: conserva anche le note aggiunte manualmente nell'app. */
export function appendiNote(...note: (string | null | undefined)[]): string | null {
  let risultato = "";
  for (const nota of note) {
    if (!nota?.trim()) continue;
    if (!risultato) { risultato = nota; continue; }
    const esistenti = new Set(risultato.split("\n"));
    const nuove = nota.split("\n").filter((riga) => riga.trim() && !esistenti.has(riga));
    if (nuove.length) risultato += `${risultato.endsWith("\n") ? "" : "\n"}${nuove.join("\n")}`;
  }
  return risultato || null;
}

export function daImportareSenzaCodice(riga: RigaAnteprima, scelta = ""): boolean {
  if (!riga.senzaCodice || !riga.proposta || scelta === "IGNORA") return false;
  return riga.stato === "PRONTA" || riga.stato === "AGGIORNARE" ||
    (riga.stato === "VERIFICARE" && (scelta === "SENZA_CODICE" || scelta === "NUOVA" || scelta.startsWith("AGGIORNA:")));
}
