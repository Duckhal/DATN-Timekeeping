import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const ALLOWED_FOR_PASSWORD_CHANGE = new Set([
  'POST /api/auth/change-password',
  'GET /api/auth/me',
]);

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.scope !== 'password_change') {
      return true;
    }

    const method = request.method;
    const path = request.route?.path ?? '';
    const key = `${method} ${path}`;

    return ALLOWED_FOR_PASSWORD_CHANGE.has(key);
  }
}
