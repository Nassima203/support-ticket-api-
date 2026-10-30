import { Resend } from "resend";
import { env } from "../config/env";

// Sans clé Resend, on n'envoie rien : l'email est affiché dans le terminal
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const isProduction = process.env.NODE_ENV === "production";

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Affiche un email dans le terminal du serveur
function printEmail(email: Email) {
  console.log(`À : ${email.to}`);
  console.log(`Sujet : ${email.subject}`);
  console.log(`${email.text}\n`);
}

export async function sendEmail(email: Email): Promise<void> {
  if (!resend) {
    console.log(`\n[Email non envoyé : RESEND_API_KEY est vide]`);
    printEmail(email);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    ...email,
  });

  if (error) {
    // En production, une erreur d'envoi doit remonter
    if (isProduction) {
      throw new Error(`Échec de l'envoi de l'email : ${error.message}`);
    }

    // En développement, Resend n'accepte que l'adresse du compte :
    // pour les autres adresses, on affiche l'email dans le terminal
    console.log(`\n[Resend a refusé l'email : ${error.message}]`);
    printEmail(email);
  }
}
