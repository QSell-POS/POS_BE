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
        data: payload ?? null,
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
        data,
        ...(message !== undefined ? { message } : {}),
        ...(finalMeta !== undefined ? { meta: finalMeta } : {}),
        timestamp,
      };
    }

    return {
      success: true,
      data: payload,
      timestamp,
    };
  }
}
