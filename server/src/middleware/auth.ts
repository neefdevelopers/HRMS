import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { sendError } from '../utils/response.js';

export interface UserMembershipSummary {
  id: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  companyLogo?: string | null;
  role: string;
  isActive: boolean;
  isCompanyActive: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  platformRole: string; // SUPER_ADMIN or ordinary user
  role: string;         // Effective role in current company context
  companyId?: string | null;
  brandId?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  memberships: UserMembershipSummary[];
  activeCompany?: {
    id: string;
    name: string;
    code: string;
    logo?: string | null;
    isActive: boolean;
  } | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  effectiveCompanyId?: string | null;
  effectiveBrandId?: string | null;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded: TokenPayload;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return sendError(res, 'Invalid or expired token.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        memberships: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      return sendError(res, 'User not found or inactive.', 401);
    }

    // Map user's company memberships
    const memberships: UserMembershipSummary[] = (user.memberships || []).map((m: any) => ({
      id: m.id,
      companyId: m.companyId,
      companyName: m.company.name,
      companyCode: m.company.code,
      companyLogo: m.company.logo,
      role: m.role,
      isActive: m.isActive,
      isCompanyActive: m.company.isActive
    }));

    // Resolve tenant context: check header 'x-company-id' or query 'companyId'
    const headerCompanyId = (req.headers['x-company-id'] as string) || (req.query.companyId as string);

    let effectiveCompanyId: string | null = null;
    let effectiveRole = user.role;
    let activeCompany: any = null;

    // Platform Super Admin
    if (user.role === 'SUPER_ADMIN') {
      if (headerCompanyId && headerCompanyId !== 'all') {
        const targetComp = await prisma.company.findUnique({ where: { id: headerCompanyId } });
        if (targetComp) {
          effectiveCompanyId = targetComp.id;
          activeCompany = {
            id: targetComp.id,
            name: targetComp.name,
            code: targetComp.code,
            logo: targetComp.logo,
            isActive: targetComp.isActive
          };
        }
      } else if (headerCompanyId === 'all') {
        effectiveCompanyId = null;
        activeCompany = null;
      } else if (memberships.length > 0) {
        // Fallback to first company membership if available
        const firstActive = memberships.find((m) => m.isActive && m.isCompanyActive) || memberships[0];
        if (firstActive) {
          effectiveCompanyId = firstActive.companyId;
          activeCompany = {
            id: firstActive.companyId,
            name: firstActive.companyName,
            code: firstActive.companyCode,
            logo: firstActive.companyLogo,
            isActive: firstActive.isCompanyActive
          };
        }
      }
    } else {
      // Non-super-admin users must be strictly bound by validated membership
      const activeMemberships = memberships.filter((m) => m.isActive && m.isCompanyActive);

      if (headerCompanyId && headerCompanyId !== 'all') {
        const matchedMem = memberships.find((m) => m.companyId === headerCompanyId);
        if (!matchedMem || !matchedMem.isActive) {
          return sendError(res, 'Access denied. You do not have an active membership in this company.', 403);
        }
        if (!matchedMem.isCompanyActive) {
          return sendError(res, 'Company account is currently inactive. Please contact platform administration.', 403);
        }
        effectiveCompanyId = matchedMem.companyId;
        effectiveRole = matchedMem.role;
        activeCompany = {
          id: matchedMem.companyId,
          name: matchedMem.companyName,
          code: matchedMem.companyCode,
          logo: matchedMem.companyLogo,
          isActive: matchedMem.isCompanyActive
        };
      } else {
        // Auto-select company if user has memberships
        const primary = activeMemberships.find((m) => m.companyId === user.companyId) || activeMemberships[0];
        if (primary) {
          effectiveCompanyId = primary.companyId;
          effectiveRole = primary.role;
          activeCompany = {
            id: primary.companyId,
            name: primary.companyName,
            code: primary.companyCode,
            logo: primary.companyLogo,
            isActive: primary.isCompanyActive
          };
        } else if (memberships.length > 0 && activeMemberships.length === 0) {
          return sendError(res, 'Your company account is inactive. Please contact platform administration.', 403);
        }
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      platformRole: user.role,
      role: effectiveRole,
      companyId: effectiveCompanyId,
      brandId: user.brandId,
      branchId: user.branchId,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      memberships,
      activeCompany
    };
    req.effectiveCompanyId = effectiveCompanyId;

    next();
  } catch (error: any) {
    return sendError(res, 'Authentication failed: ' + error.message, 500);
  }
};
