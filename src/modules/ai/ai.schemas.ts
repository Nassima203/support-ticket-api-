import { z } from "zod";

// Format attendu de la réponse de l'IA (voir SYSTEM_PROMPT dans ai.prompt.ts).
// zod ignore les champs en plus : on pourra en ajouter plus tard (category, needsHuman...)
// sans casser ce code.
export const aiReplySchema = z.object({
  inScope: z.boolean(),
  answer: z.string().trim().min(1).max(5000),
});

export type AiReply = z.infer<typeof aiReplySchema>;