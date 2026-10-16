import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { sendError } from '../utils/response.js';
import { prisma } from '../config/prisma.js';

export const Role = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  ATTENDANCE_VIEWER: 'ATTENDANCE_VIEWER'
} as const;

export type ApplicationRole = (typeof Role)[keyof typeof Role];

/**
 * Authorize role(s).
 * Exactly three application roles exist: ADMIN, HR, and ATTENDANCE_VIEWER.
 * ADMIN has platform and company administration privileges.
 * HR has operational permissions within assigned companies.
 * ATTENDANCE_VIEWER has strictly read-only attendance permissions within assigned companies.
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const userRole = req.user.role;

    // Check if role matches allowed roles
    if (!allowedRoles.includes(userRole)) {
      return sendError(
        res,
        `Access denied. Role '${userRole}' is not authorized to perform this action.`,
        403
      );
    }

    next();
  };
};

/**
 * Middleware ensuring an active validated company context exists on the request.
 * For HR and ATTENDANCE_VIEWER users: membership in active company is strictly required.
 * For Admin users: can operate across authorized company workspaces, or without company on platform endpoints.
 */
export const enforceCompanyAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, 'Unauthorized', 401);
  }

  // Admin operating without specific company on platform-wide management endpoints
  if (req.user.role === Role.ADMIN && !req.effectiveCompanyId) {
    return next();
  }

  if (!req.effectiveCompanyId) {
    if (req.user.role === Role.HR || req.user.role === Role.ATTENDANCE_VIEWER) {
      return sendError(
        res,
        'No active company assignments. Please contact an Administrator to assign you to a company.',
        403
      );
    }
    return sendError(res, 'No active company context. Access denied.', 403);
  }

  next();
};

/**
 * Middleware to enforce multi-brand data isolation on incoming requests.
 * Evaluates brand query params or body fields, verifies company ownership,
 * and binds the authorized effectiveBrandId.
 */
export const enforceBrandAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, 'Unauthorized', 401);
  }

  const requestedBrandId = (req.query.brandId as string) || (req.body && req.body.brandId);

  // If a brand is specified, verify that the brand belongs to the active company
  if (requestedBrandId && requestedBrandId !== 'all') {
    if (req.effectiveCompanyId) {
      const brand = await prisma.brand.findUnique({
        where: { id: requestedBrandId }
      });
      if (!brand || (brand.companyId && brand.companyId !== req.effectiveCompanyId)) {
        return sendError(res, 'Access denied. The specified brand does not belong to your company.', 403);
      }
    }
  }

  // Admin has full brand access within the company
  if (req.user.role === Role.ADMIN) {
    if (requestedBrandId && requestedBrandId !== 'all') {
      req.effectiveBrandId = requestedBrandId;
    } else {
      req.effectiveBrandId = null; // null represents all brands under current company
    }
    return next();
  }

  // HR users with specific brand assignment are scoped, otherwise can access all company brands
  const userBrandId = req.user.brandId;
  if (userBrandId) {
    if (requestedBrandId && requestedBrandId !== 'all' && requestedBrandId !== userBrandId) {
      return sendError(
        res,
        'Access denied. You do not have permission to view or modify records for this brand.',
        403
      );
    }
    req.effectiveBrandId = userBrandId;
  } else {
    if (requestedBrandId && requestedBrandId !== 'all') {
      req.effectiveBrandId = requestedBrandId;
    } else {
      req.effectiveBrandId = null;
    }
  }

  next();
};
