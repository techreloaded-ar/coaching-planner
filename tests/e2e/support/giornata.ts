import { expect, type Page } from "@playwright/test";

/**
 * Dettaglio giornata con feedback immediato: dopo «Aggiungi riga», «Salva
 * modifiche» o «Elimina» la riga cambia subito a schermo, PRIMA che il server
 * abbia confermato la scrittura. Finché una scrittura è in attesa la sezione
 * «Attività della giornata» espone `aria-busy="true"` e le righe aggiunte o
 * modificate portano `data-in-attesa="true"`.
 *
 * Un test che dopo la scrittura ricarica la pagina, naviga altrove o legge il
 * database deve prima attendere che nessuna scrittura sia più in attesa: è lo
 * stato osservabile che dice «il server ha risposto».
 */
export async function attendiRigheConfermate(page: Page): Promise<void> {
  await expect(
    page.getByRole("region", { name: "Attività della giornata", exact: true }),
  ).toHaveAttribute("aria-busy", "false");
}
