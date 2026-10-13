import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { sendError } from '../utils/response.js';

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  GROUP_HR: 'GROUP_HR',
  BRAND_HR: 'BRAND_HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
} as const;

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Role '${req.user.role}' is not authorized to perform this action.`,
        403
      );
    }

    next();
  };
};

/**
 * Middleware to enforce multi-brand data isolation on incoming requests.
 * Evaluates brand query params or body fields and binds the authorized effectiveBrandId.
 */
export const enforceBrandAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, 'Unauthorized', 401);
  }

  const requestedBrandId = (req.query.brandId as string) || (req.body && req.body.brandId);

  // Super Admin & Group HR have multi-brand group-level privileges
  if (req.user.role === Role.SUPER_ADMIN || req.user.role === Role.GROUP_HR) {
    if (requestedBrandId && requestedBrandId !== 'all') {
      req.effectiveBrandId = requestedBrandId;
    } else {
      req.effectiveBrandId = null; // null represents all brands (group view)
    }
    return next();
  }

  // Brand HR, Manager, Employee are strictly scoped to their assigned brand
  const userBrandId = req.user.brandId;
  if (!userBrandId) {
    return sendError(res, 'User is not assigned to any brand.', 403);
  }

  // If user requested another brand, reject immediately
  if (requestedBrandId && requestedBrandId !== 'all' && requestedBrandId !== userBrandId) {
    return sendError(
      res,
      'Access denied. You do not have permission to view or modify records for this brand.',
      403
    );
  }

  req.effectiveBrandId = userBrandId;
  next();
};
