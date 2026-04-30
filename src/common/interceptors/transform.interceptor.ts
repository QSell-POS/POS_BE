import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, any>;
  timestamp: string;
}

const STRIP_KEYS = new Set(['updatedAt', 'deletedAt']);

function stripFields(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(stripFields);
  if (typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (STRIP_KEYS.has(key)) continue;
      out[key] = stripFields(value[key]);
    }
    return out;
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (STRIP_KEYS.has(key)) continue;
      out[key] = stripFields((value as any)[key]);
    }
    return out;
  }
  return value;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => this.format(payload)),
    );
  }

  private format(payload: any): ApiResponse<any> {
    const timestamp = new Date().toISOString();

    if (payload === null || payload === undefined || Array.isArray(payload) || typeof payload !== 'object') {
      return {
        success: true,
        data: stripFields(payload) ?? null,
        timestamp,
      };
    }

    if ('data' in payload) {
      const { data, message, meta, ...extra } = payload as Record<string, any>;
      const extraKeys = Object.keys(extra);
      const finalMeta =
        meta !== undefined || extraKeys.length > 0
          ? { ...(meta ?? {}), ...(extraKeys.length > 0 ? extra : {}) }
          : undefined;

      return {
        success: true,
        data: stripFields(data),
        ...(message !== undefined ? { message } : {}),
        ...(finalMeta !== undefined ? { meta: finalMeta } : {}),
        timestamp,
      };
    }

    return {
      success: true,
      data: stripFields(payload),
      timestamp,
    };
  }
}
