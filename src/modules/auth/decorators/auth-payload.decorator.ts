import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthPayload } from '../types/auth-payload.type';

export const GetAuthPayload = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as Request & { user?: AuthPayload }).user;
  },
);
