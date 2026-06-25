import { HttpException } from '@nestjs/common';

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/**
 * An HttpException that carries a stable `code` string (ARCHITECTURE §5). The global filter reads
 * the code/message/details straight off the response payload. Throw this anywhere a controller or
 * service needs to surface a domain error with a contract-defined code.
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }
}
