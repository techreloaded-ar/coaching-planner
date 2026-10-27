import "server-only";

import nodemailer from "nodemailer";

// Invio email con l'SMTP del dominio (SiteGround). Configurazione da
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD ed EMAIL_MITTENTE: se manca,
// l'invio non riesce senza eccezioni. Con EMAIL_DESTINATARIO_DI_PROVA tutte le
// email vanno a quell'indirizzo, con il destinatario originale nell'oggetto.
//
// Con E2E_TEST_MODE=true nessuna email parte: l'invio è dato per riuscito.

export interface Email {
  destinatario: string;
  oggetto: string;
  testo: string;
}

/** true se l'SMTP ha accettato l'email. Non lancia mai. */
export async function inviaEmail({ destinatario, oggetto, testo }: Email): Promise<boolean> {
  if (process.env.E2E_TEST_MODE === "true") return true;

  const host = process.env.SMTP_HOST?.trim();
  const porta = Number(process.env.SMTP_PORT);
  const utente = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const mittente = process.env.EMAIL_MITTENTE?.trim();
  if (!host || !Number.isInteger(porta) || porta <= 0 || !utente || !password || !mittente) {
    console.error("SMTP non configurato");
    return false;
  }

  const destinatarioDiProva = process.env.EMAIL_DESTINATARIO_DI_PROVA?.trim();

  try {
    const trasporto = nodemailer.createTransport({
      host,
      port: porta,
      secure: porta === 465,
      auth: { user: utente, pass: password },
    });
    await trasporto.sendMail({
      from: mittente,
      to: destinatarioDiProva || destinatario,
      subject: destinatarioDiProva ? `[prova per ${destinatario}] ${oggetto}` : oggetto,
      text: testo,
    });
    return true;
  } catch (errore) {
    // Solo tipo e codice: il messaggio può riportare dati della connessione.
    const { name, code } = (errore ?? {}) as { name?: string; code?: string };
    console.error("Invio email non riuscito:", name ?? "errore sconosciuto", code ?? "");
    return false;
  }
}
