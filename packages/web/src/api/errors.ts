export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
  }
}
