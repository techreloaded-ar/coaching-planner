/** Valore da salvare per un campo di testo libero facoltativo: null se vuoto o solo spazi. */
export function leggiTestoFacoltativoDaForm(formData: FormData, campo: string): string | null {
  const valore = formData.get(campo);
  return typeof valore === "string" && valore.trim() ? valore.trim() : null;
}

/** Valore da salvare per il campo `note` di un form: null se vuoto o solo spazi. */
export function leggiNoteDaForm(formData: FormData): string | null {
  return leggiTestoFacoltativoDaForm(formData, "note");
}
