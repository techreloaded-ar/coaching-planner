// Lettura degli elementi selezionati inviati dalla barra azioni degli elenchi
// (`ElencoSelezionabile`): un campo `id` per elemento.

/** Id distinti e non vuoti dei campi `id` del form. */
export function leggiIdSelezionati(formData: FormData): string[] {
  const id = formData
    .getAll("id")
    .filter((valore): valore is string => typeof valore === "string" && valore !== "");
  return [...new Set(id)];
}
