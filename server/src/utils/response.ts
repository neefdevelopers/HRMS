import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: any;
  error?: string;
}

export const sendSuccess = <T>(res: Response, data: T, message?: string, meta?: any, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta
  });
};

export const sendError = (res: Response, error: string, statusCode = 400, details?: any) => {
  return res.status(statusCode).json({
    success: false,
    error,
    details
  });
};
