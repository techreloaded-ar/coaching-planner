/** Valore da salvare per il campo `note` di un form: null se vuoto o solo spazi. */
export function leggiNoteDaForm(formData: FormData): string | null {
  const valore = formData.get("note");
  return typeof valore === "string" && valore.trim() ? valore.trim() : null;
}
