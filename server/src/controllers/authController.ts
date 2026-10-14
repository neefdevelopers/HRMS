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
        branch: true,
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

    // Resolve companies list from memberships
    const companies = (user.memberships || [])
      .filter((m: any) => m.isActive && m.company.isActive)
      .map((m: any) => ({
        id: m.company.id,
        name: m.company.name,
        code: m.company.code,
        logo: m.company.logo,
        role: m.role,
        isActive: m.company.isActive
      }));

    // For Platform Super Admin, also allow selecting any active company
    let activeCompany: any = null;
    let effectiveRole = user.role;

    if (user.role === 'SUPER_ADMIN') {
      const allCompanies = await prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, logo: true, isActive: true }
      });
      // Super admin has access to all active companies
      if (allCompanies.length > 0) {
        activeCompany = allCompanies[0];
      }
    } else if (companies.length > 0) {
      const primary = companies.find((c) => c.id === user.companyId) || companies[0];
      activeCompany = primary;
      effectiveRole = primary.role;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      brandId: user.brandId,
      branchId: user.branchId,
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
      platformRole: user.role,
      role: effectiveRole,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyId: activeCompany?.id || user.companyId,
      activeCompany,
      companies,
      brandId: user.brandId,
      branchId: user.branchId,
      employeeId: user.employeeId,
      brand: user.brand,
      branch: user.branch,
      employee: user.employee
    };

    return sendSuccess(res, { token, user: safeUser }, 'Login successful');
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
        branch: true,
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

    // Determine authorized companies
    let companies: any[] = [];
    if (user.role === 'SUPER_ADMIN') {
      companies = await prisma.company.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          logo: true,
          isActive: true
        },
        orderBy: { name: 'asc' }
      });
      companies = companies.map(c => ({
        ...c,
        role: 'SUPER_ADMIN'
      }));
    } else {
      companies = (user.memberships || [])
        .filter((m: any) => m.isActive && m.company.isActive)
        .map((m: any) => ({
          id: m.company.id,
          name: m.company.name,
          code: m.company.code,
          logo: m.company.logo,
          role: m.role,
          isActive: m.company.isActive
        }));
    }

    const activeCompany = req.user.activeCompany || (companies.length > 0 ? companies[0] : null);

    const safeUser = {
      id: user.id,
      email: user.email,
      platformRole: user.role,
      role: req.user.role || user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyId: req.effectiveCompanyId || activeCompany?.id || user.companyId,
      activeCompany,
      companies,
      brandId: user.brandId,
      branchId: user.branchId,
      employeeId: user.employeeId,
      brand: user.brand,
      branch: user.branch,
      employee: user.employee
    };

    return sendSuccess(res, safeUser);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch user', 500);
  }
};
