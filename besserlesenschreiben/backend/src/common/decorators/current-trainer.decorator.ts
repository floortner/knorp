import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthTrainer {
  id: string;
  role: 'trainer' | 'admin';
}

/** Injects the authenticated trainer (derived ONLY from the staff JWT — never the request body). */
export const CurrentTrainer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthTrainer => {
    const req = ctx.switchToHttp().getRequest<{ trainer?: AuthTrainer }>();
    return req.trainer as AuthTrainer;
  },
);
