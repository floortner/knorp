import { HttpException } from '@nestjs/common';

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/**
 * An HttpException that carries a stable `code` string (ARCHITECTURE §5). The global filter reads
 * the code/message/details straight off the response payload. Throw this anywhere a controller or
 * service needs to surface a domain error with a contract-defined code.
 * `retryAfterSeconds` (429s only) becomes the Retry-After header so clients can back off precisely.
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
    readonly retryAfterSeconds?: number,
  ) {
    super({ code, message, details }, status);
  }
}
