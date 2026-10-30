import { Resend } from "resend";
import { env } from "../config/env";

// Sans clé Resend, on n'envoie rien : l'email est affiché dans le terminal
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(email: Email): Promise<void> {
  if (!resend) {
    console.log(`\n[Email non envoyé : RESEND_API_KEY est vide]`);
    console.log(`À : ${email.to}`);
    console.log(`Sujet : ${email.subject}`);
    console.log(`${email.text}\n`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    ...email,
  });

  if (error) {
    throw new Error(`Échec de l'envoi de l'email : ${error.message}`);
  }
}
