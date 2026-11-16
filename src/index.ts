import { env } from "./config/env";
import { app } from "./app";

// Dit clairement au démarrage si l'IA est allumée ou non.
// On n'affiche jamais la clé : seulement le modèle et la limite d'appels.
function logAiStatus() {
  if (env.AI_ENABLED) {
    console.log(`IA activée : modèle ${env.AI_MODEL}, ${env.AI_MAX_CALLS_PER_DAY} appels maximum par jour`);
    return;
  }

  console.log("IA désactivée (pour l'activer : AI_ENABLED=true dans le .env)");

  // AI_ENABLED est rempli mais ne vaut ni "true" ni "false" : c'est sûrement une faute de frappe
  if (env.AI_ENABLED_RAW !== "" && env.AI_ENABLED_RAW !== "false") {
    console.warn(`Attention : AI_ENABLED vaut "${env.AI_ENABLED_RAW}". Seul "true" (en minuscules) active l'IA.`);
  }
}

app.listen(env.PORT, () => {
  console.log(`API démarrée sur http://localhost:${env.PORT}`);
  logAiStatus();
});