import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Application Error:', err);

  if (err instanceof ZodError) {
    return sendError(
      res,
      'Validation error',
      400,
      err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    );
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};
