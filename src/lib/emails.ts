import { env } from "../config/env";

// Email envoyé quand un admin crée un compte
export function invitationEmail(to: string, token: string) {
  const link = `${env.APP_URL}/accept-invitation?token=${token}`;

  return {
    to,
    subject: "Invitation à rejoindre Support Ticket API",
    text: `Bonjour,\n\nUn compte a été créé pour vous sur Support Ticket API.\nChoisissez votre mot de passe avec ce lien, valable 48 heures :\n${link}\n`,
    html: `
      <p>Bonjour,</p>
      <p>Un compte a été créé pour vous sur <strong>Support Ticket API</strong>.</p>
      <p><a href="${link}">Choisir mon mot de passe</a></p>
      <p>Ce lien est valable 48 heures.</p>
    `,
  };
}

// Email envoyé quand quelqu'un a oublié son mot de passe
export function passwordResetEmail(to: string, token: string) {
  const link = `${env.APP_URL}/reset-password?token=${token}`;

  return {
    to,
    subject: "Réinitialisation de votre mot de passe",
    text: `Bonjour,\n\nPour choisir un nouveau mot de passe, utilisez ce lien, valable 1 heure :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n`,
    html: `
      <p>Bonjour,</p>
      <p><a href="${link}">Choisir un nouveau mot de passe</a></p>
      <p>Ce lien est valable 1 heure.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  };
}
