import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { logger } from './logger.js';

/** Application error rendered as RFC 7807 problem+json. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg = 'Bad request', details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg);
export const notFound = (msg = 'Resource not found') => new HttpError(404, msg);
export const conflict = (msg = 'Conflict', details?: unknown) => new HttpError(409, msg, details);

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let detail = 'An unexpected error occurred';
  let errors: unknown;

  if (err instanceof HttpError) {
    status = err.status;
    detail = err.message;
    errors = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    detail = 'Validation failed';
    errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    detail = `Invalid value for ${err.path}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    detail = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if ((err as { code?: number })?.code === 11000) {
    status = 409;
    detail = 'Duplicate resource';
  } else if ((err as { type?: string })?.type === 'entity.parse.failed') {
    status = 400;
    detail = 'Malformed JSON body';
  }

  if (status >= 500) logger.error({ err, reqId: req.id }, 'Unhandled error');

  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title: TITLES[status] ?? 'Error',
      status,
      detail,
      instance: req.originalUrl,
      requestId: req.id,
      ...(errors ? { errors } : {}),
    });
};
