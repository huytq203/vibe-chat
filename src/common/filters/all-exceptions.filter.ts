import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCodes } from '../constants/error-codes';

interface ErrorBody {
  code?: string;
  message?: string;
  details?: unknown[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'Lỗi hệ thống, vui lòng thử lại sau';
    let details: unknown[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse() as string | ErrorBody;

      if (typeof body === 'string') {
        message = body;
      } else {
        code = body.code ?? code;
        message = body.message ?? message;
        details = body.details;
      }
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${req.method}] ${req.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${req.method}] ${req.url} → ${statusCode} (${code})`);
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
