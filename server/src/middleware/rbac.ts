import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { sendError } from '../utils/response.js';
import { prisma } from '../config/prisma.js';

export const Role = {
  PLATFORM_SUPER_ADMIN: 'SUPER_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  COMPANY_HR: 'COMPANY_HR',
  GROUP_HR: 'GROUP_HR', // backwards compatibility alias for COMPANY_HR
  BRAND_HR: 'BRAND_HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
} as const;

/**
 * Authorize role(s).
 * Platform Super Admin always passes.
 * GROUP_HR and COMPANY_HR are treated interchangeably for backward-compatibility.
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    // Platform Super Admin has universal access
    if (req.user.platformRole === Role.SUPER_ADMIN) {
      return next();
    }

    const userRole = req.user.role;
    
    // Check if role directly matches
    let isAllowed = allowedRoles.includes(userRole);

    // If COMPANY_HR allowed, accept GROUP_HR as well, and vice-versa
    if (!isAllowed) {
      if (allowedRoles.includes('COMPANY_HR') && userRole === 'GROUP_HR') isAllowed = true;
      if (allowedRoles.includes('GROUP_HR') && userRole === 'COMPANY_HR') isAllowed = true;
      if (allowedRoles.includes('COMPANY_ADMIN') && (userRole === 'SUPER_ADMIN' || req.user.platformRole === 'SUPER_ADMIN')) isAllowed = true;
    }

    if (!isAllowed) {
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
 */
export const enforceCompanyAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, 'Unauthorized', 401);
  }

  // Super admin can operate without specific company on platform endpoints
  if (req.user.platformRole === Role.SUPER_ADMIN && !req.effectiveCompanyId) {
    return next();
  }

  if (!req.effectiveCompanyId) {
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

  // Platform Super Admin, Company Admin, and Company/Group HR have full brand access within the company
  if (
    req.user.platformRole === Role.SUPER_ADMIN ||
    req.user.role === Role.COMPANY_ADMIN ||
    req.user.role === Role.COMPANY_HR ||
    req.user.role === Role.GROUP_HR
  ) {
    if (requestedBrandId && requestedBrandId !== 'all') {
      req.effectiveBrandId = requestedBrandId;
    } else {
      req.effectiveBrandId = null; // null represents all brands under current company
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
