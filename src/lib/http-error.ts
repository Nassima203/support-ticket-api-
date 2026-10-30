// Une erreur qui connaît son code HTTP, par exemple new HttpError(404, "Ticket introuvable")
// Le middleware errorHandler la transforme en réponse { "error": "..." }
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
