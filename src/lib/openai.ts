import OpenAI from "openai";
import { env } from "../config/env";

// Client OpenAI : créé seulement si l'IA est activée. Sinon null, et aucun appel n'est possible.
// maxRetries: 0 : on ne relance jamais un appel raté (chaque essai coûte des tokens et du temps).
const client = env.AI_ENABLED
  ? new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
      timeout: env.AI_TIMEOUT_MS,
      maxRetries: 0,
    })
  : null;

// Erreur d'appel à l'IA avec un message court et sûr (jamais la clé, même masquée)
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

// Ce qu'on garde de la réponse du modèle
export type ModelAnswer = {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

// Envoie le prompt système et le message du ticket au modèle, en mode JSON
export async function askModel(systemPrompt: string, userMessage: string): Promise<ModelAnswer> {
  if (!client) {
    throw new AiProviderError("IA désactivée");
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: env.AI_MAX_OUTPUT_TOKENS,
    });

    return {
      content: completion.choices[0]?.message.content ?? "",
      inputTokens: completion.usage?.prompt_tokens ?? null,
      outputTokens: completion.usage?.completion_tokens ?? null,
    };
  } catch (error) {
    // On ne recopie jamais le message d'OpenAI : il peut contenir une partie de la clé
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new AiProviderError("Délai dépassé");
    }
    if (error instanceof OpenAI.APIError) {
      throw new AiProviderError(`Erreur OpenAI ${error.status ?? "réseau"}`);
    }
    throw new AiProviderError("Erreur inconnue pendant l'appel à l'IA");
  }
}