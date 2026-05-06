import { Injectable, ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { Permission } from 'src/common/permissions/permission.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

@Injectable()
export class RolesGuard {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    if (user.role === UserRole.SUPER_ADMIN) return true;

    return requiredRoles.includes(user.role);
  }
}

/**
 * Fine-grained permission guard.
 * ADMIN and SUPER_ADMIN always pass — permission checks only apply to staff roles.
 * Usage: @Permissions(Permission.SALES_CREATE)
 */
@Injectable()
export class PermissionsGuard {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Admins bypass all permission checks
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) return true;

    const userPerms: Permission[] = user.permissions ?? [];
    return required.every((p) => userPerms.includes(p));
  }
}

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

export const ShopId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.shopId;
});
