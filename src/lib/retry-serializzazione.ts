const MASSIMI_RITENTATIVI_SERIALIZZAZIONE = 3;

function isErroreSerializzazione(errore: unknown): boolean {
  if (typeof errore !== "object" || errore === null) return false;

  if ("code" in errore && errore.code === "P2034") return true;

  // PrismaPg può esporre direttamente l'errore del driver al COMMIT, senza
  // convertirlo in P2034. Riconosciamo solo il conflitto SQLSTATE 40001,
  // non gli altri errori del driver o della transazione.
  if (!("name" in errore) || errore.name !== "DriverAdapterError") return false;
  const causa = "cause" in errore ? errore.cause : undefined;
  return (
    typeof causa === "object" &&
    causa !== null &&
    "kind" in causa &&
    causa.kind === "TransactionWriteConflict" &&
    "originalCode" in causa &&
    causa.originalCode === "40001"
  );
}

/** Ritenta l'intera transazione, così ogni tentativo rilegge uno snapshot nuovo.
 * Il callback deve contenere solo operazioni transazionali: redirect,
 * invalidazioni di cache e altri effetti esterni vanno eseguiti dopo il commit.
 */
export async function eseguiConRetrySerializzazione<T>(
  operazione: () => Promise<T>,
): Promise<T> {
  for (let tentativo = 0; ; tentativo += 1) {
    try {
      return await operazione();
    } catch (errore) {
      if (
        !isErroreSerializzazione(errore) ||
        tentativo >= MASSIMI_RITENTATIVI_SERIALIZZAZIONE
      ) {
        throw errore;
      }
    }
  }
}
