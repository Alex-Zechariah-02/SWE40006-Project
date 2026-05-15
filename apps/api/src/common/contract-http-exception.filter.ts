import type { Request, Response } from 'express';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { makeContractErrorBody } from './contract-errors';

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'AUTH_REQUIRED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'UPLOAD_TOO_LARGE';
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}

function defaultMessageForCode(code: string): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'Request validation failed';
    case 'AUTH_REQUIRED':
      return 'Authentication required';
    case 'AUTH_INVALID_TOKEN':
      return 'Invalid or expired token';
    case 'AUTH_INVALID_CREDENTIALS':
      return 'Invalid credentials';
    case 'FORBIDDEN':
      return 'Forbidden';
    case 'NOT_FOUND':
      return 'Not found';
    case 'CONFLICT':
      return 'Conflict';
    case 'UPLOAD_TOO_LARGE':
      return 'Upload too large';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Unsupported media type';
    case 'SERVICE_UNAVAILABLE':
      return 'Service unavailable';
    case 'INTERNAL_ERROR':
      return 'Internal server error';
    default:
      return 'Request failed';
  }
}

@Catch()
export class ContractHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Multer errors (file upload) are not HttpExceptions by default.
    // Map them into contract-stable error envelopes.
    if (typeof exception === 'object' && exception) {
      const maybe = exception as Record<string, unknown>;
      const maybeCode = typeof maybe.code === 'string' ? maybe.code : undefined;
      const maybeName = typeof maybe.name === 'string' ? maybe.name : undefined;

      if (maybeName === 'MulterError' && maybeCode === 'LIMIT_FILE_SIZE') {
        response.status(HttpStatus.PAYLOAD_TOO_LARGE).json(makeContractErrorBody('UPLOAD_TOO_LARGE', 'Upload too large', []));
        return;
      }

      if (maybeName === 'MulterError') {
        response.status(HttpStatus.UNPROCESSABLE_ENTITY).json(makeContractErrorBody('VALIDATION_ERROR', 'Request validation failed', []));
        return;
      }
    }

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (isHttp) {
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse && 'error' in exResponse) {
        response.status(status).json(exResponse);
        return;
      }
    }

    const code = defaultCodeForStatus(status);
    const message = defaultMessageForCode(code);

    // For now we do not surface `requestId`; keep the envelope stable.
    const body = makeContractErrorBody(code, message, []);

    // Avoid leaking raw exception details.
    void exception;
    void request;

    response.status(status).json(body);
  }
}
