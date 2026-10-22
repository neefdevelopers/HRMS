import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { signToken } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        brand: true,
        employee: {
          include: {
            department: true,
            designation: true
          }
        },
        memberships: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      return sendError(res, 'Invalid email or password.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password.', 401);
    }

    const ALLOWED_LOGIN_ROLES = ['ADMIN', 'HR', 'ATTENDANCE_VIEWER'];
    if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
      return sendError(res, 'Access denied. Account does not have an authorized role.', 403);
    }

    let companies: any[] = [];
    let activeCompany: any = null;

    if (user.role === 'ADMIN') {
      // Admin has platform-wide administration and can access all active companies
      companies = await prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, logo: true, isActive: true },
        orderBy: { name: 'asc' }
      });
      if (companies.length > 0) {
        activeCompany = companies[0];
      }
    } else {
      // HR / ATTENDANCE_VIEWER: restricted strictly to companies with active memberships
      companies = (user.memberships || [])
        .filter((m: any) => m.isActive && m.company.isActive)
        .map((m: any) => ({
          id: m.company.id,
          name: m.company.name,
          code: m.company.code,
          logo: m.company.logo,
          role: m.role || user.role,
          isActive: m.company.isActive
        }));

      if (companies.length > 0) {
        const primary = companies.find((c) => c.id === user.companyId) || companies[0];
        activeCompany = primary;
      } else {
        // User with 0 company assignments
        activeCompany = null;
      }
    }

    const matchedMem = (user.memberships || []).find((m: any) => m.companyId === activeCompany?.id);
    const activeRole = user.role === 'ADMIN' ? 'ADMIN' : (matchedMem ? matchedMem.role : user.role);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      brandId: user.brandId,
      employeeId: user.employeeId
    });

    // Record login audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        brandId: user.brandId,
        companyId: activeCompany?.id || user.companyId || null
      }
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      role: activeRole,
      platformRole: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyId: activeCompany?.id || user.companyId || null,
      activeCompany,
      companies,
      brandId: user.brandId,
      employeeId: user.employeeId,
      brand: user.brand,
      employee: user.employee
    };

    return sendSuccess(res, { token, user: safeUser, companies, activeCompany }, 'Login successful');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Invalid request parameters', 400, error.errors);
    }
    return sendError(res, error.message || 'Login failed', 500);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        brand: true,
        employee: {
          include: {
            department: true,
            designation: true,
            shift: true
          }
        },
        memberships: {
          include: {
            company: true
          }
        }
      }
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    let companies: any[] = [];
    if (user.role === 'ADMIN') {
      companies = await prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, logo: true, isActive: true },
        orderBy: { name: 'asc' }
      });
    } else {
      companies = (user.memberships || [])
        .filter((m: any) => m.isActive && m.company.isActive)
        .map((m: any) => ({
          id: m.company.id,
          name: m.company.name,
          code: m.company.code,
          logo: m.company.logo,
          role: m.role || user.role,
          isActive: m.company.isActive
        }));
    }

    const activeCompany = req.user.activeCompany || (companies.length > 0 ? companies[0] : null);

    const matchedMem = (user.memberships || []).find((m: any) => m.companyId === (req.effectiveCompanyId || activeCompany?.id));
    const effectiveRole = user.role === 'ADMIN' ? 'ADMIN' : (matchedMem ? matchedMem.role : user.role);

    const safeUser = {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      platformRole: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyId: req.effectiveCompanyId || activeCompany?.id || user.companyId,
      activeCompany,
      companies,
      brandId: user.brandId,
      employeeId: user.employeeId,
      brand: user.brand,
      employee: user.employee
    };

    return sendSuccess(res, safeUser);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch user', 500);
  }
};
