import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleValue } from '../../employees/dto/create-employee.dto';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleValue[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No specific roles required for this route
    }
    
    const { user } = context.switchToHttp().getRequest();
    
    // If user has no role but route requires one, deny
    if (!user || !user.role) {
        return false;
    }

    return requiredRoles.some((role) => user.role === role);
  }
}
