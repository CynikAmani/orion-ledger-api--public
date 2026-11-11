import { BrevoError } from '@getbrevo/brevo';

export function getBrevoErrorMessage(error: unknown): string {
  if (error instanceof BrevoError) {
    const bodyMessage = extractBodyMessage(error.body);

    return (
      bodyMessage ??
      error.message ??
      `Brevo API error (status ${error.statusCode ?? 'unknown'})`
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown email delivery error';
}

function extractBodyMessage(body: unknown): string | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return undefined;
}
