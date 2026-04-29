import { Injectable, NestMiddleware, ConflictException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const store = new Map<string, { status: number; body: any; completedAt: number }>();

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const IDEMPOTENCY_PATHS = ['/sales', '/sales/*/payment', '/purchases/*/payment'];

function pathMatches(url: string): boolean {
  const clean = url.split('?')[0].replace(/^\/api\/v1/, '');
  return (
    clean === '/sales' ||
    /^\/sales\/[^/]+\/payment$/.test(clean) ||
    /^\/purchases\/[^/]+\/payment$/.test(clean)
  );
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'POST' || !pathMatches(req.url)) return next();

    const key = req.headers['x-idempotency-key'] as string;
    if (!key) return next();

    // Purge stale entries lazily
    const now = Date.now();
    store.forEach((val, k) => {
      if (now - val.completedAt > IDEMPOTENCY_TTL_MS) store.delete(k);
    });

    const shopId = (req as any).user?.shopId || 'global';
    const storeKey = `${shopId}:${key}`;
    const cached = store.get(storeKey);

    if (cached) {
      return res.status(cached.status).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode < 500) {
        store.set(storeKey, { status: res.statusCode, body, completedAt: Date.now() });
      }
      return originalJson(body);
    };

    next();
  }
}
