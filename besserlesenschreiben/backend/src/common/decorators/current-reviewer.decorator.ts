import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthReviewer {
  id: string;
  role: 'reviewer' | 'admin';
}

/** Injects the authenticated reviewer (derived ONLY from the staff JWT — never the request body). */
export const CurrentReviewer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthReviewer => {
    const req = ctx.switchToHttp().getRequest<{ reviewer?: AuthReviewer }>();
    return req.reviewer as AuthReviewer;
  },
);
