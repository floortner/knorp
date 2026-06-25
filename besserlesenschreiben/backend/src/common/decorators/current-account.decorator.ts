import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthAccount {
  id: string;
}

/** Injects the authenticated account (derived ONLY from the JWT — never from the request body). */
export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthAccount => {
    const req = ctx.switchToHttp().getRequest<{ account?: AuthAccount }>();
    return req.account as AuthAccount;
  },
);
