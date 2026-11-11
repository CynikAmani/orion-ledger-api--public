export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  errorCode: string;
}

export function buildErrorResponse(
  statusCode: number,
  path: string,
  message: string | string[],
  errorCode: string,
): ErrorResponse {
  return {
    statusCode,
    timestamp: new Date().toISOString(),
    path,
    message,
    errorCode,
  };
}
