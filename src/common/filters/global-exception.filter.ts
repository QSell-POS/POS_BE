import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[] | object;
  path: string;
  timestamp: string;
  data?: { errors: Record<string, string> };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] | object = 'Internal server error';
    let error = 'InternalServerError';
    let validationErrors: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, any>;
        message = body.message ?? body;
        error = body.error || exception.name;

        if (exception instanceof BadRequestException && Array.isArray(body.message)) {
          validationErrors = this.extractFieldErrors(body.message);
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const responseBody: ErrorResponseBody = {
      success: false,
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (validationErrors) {
      responseBody.data = { errors: validationErrors };
    }

    response.status(status).json(responseBody);
  }

  private extractFieldErrors(messages: string[]): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const msg of messages) {
      if (typeof msg !== 'string') continue;
      const field = msg.split(' ')[0];
      if (!field) continue;
      if (!errors[field]) {
        errors[field] = msg;
      }
    }
    return errors;
  }
}
