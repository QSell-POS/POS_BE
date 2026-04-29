import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from 'src/modules/audit/audit.service';

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

function extractEntityFromPath(path: string): { entity: string; entityId: string | null } {
  // Remove query string
  const cleanPath = path.split('?')[0];
  // Split and filter empty segments
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { entity: 'unknown', entityId: null };
  }

  // UUID pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let entity = segments[0];
  let entityId: string | null = null;

  // e.g. /products/123e... → entity=products, entityId=uuid
  // e.g. /products/123e.../activate → entity=products, entityId=uuid
  for (let i = 1; i < segments.length; i++) {
    if (uuidRegex.test(segments[i])) {
      entityId = segments[i];
    }
  }

  // Convert kebab-case to PascalCase for entity name
  entity = entity
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  return { entity, entityId };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method?.toUpperCase();

    // Only log mutating methods
    if (!METHOD_ACTION_MAP[method]) {
      return next.handle();
    }

    const action = METHOD_ACTION_MAP[method];
    const { entity, entityId } = extractEntityFromPath(req.path || req.url || '');
    const userId: string | undefined = req.user?.id;
    const shopId: string | undefined = req.user?.shopId;

    // Skip if no authenticated user
    if (!userId) {
      return next.handle();
    }

    const ipAddress: string =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    const userAgent: string = req.headers['user-agent'] || null;

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({
            userId,
            shopId,
            action,
            entity,
            entityId,
            method,
            path: req.path || req.url,
            ipAddress,
            userAgent,
          })
          .catch(() => {});
      }),
    );
  }
}
