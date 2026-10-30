/// <reference types="node" />
import { sendEmail } from "../src/lib/mailer";

const to = process.argv[2];

if (!to) {
  console.error("Indique l'adresse : npm run email:test -- ton@email.com");
  process.exit(1);
}

sendEmail({
  to,
  subject: "Test Support Ticket API",
  text: "Si tu lis ce message, l'envoi d'emails fonctionne.",
  html: "<p>Si tu lis ce message, l'envoi d'emails fonctionne.</p>",
})
  .then(() => console.log(`Email envoyé à ${to}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
