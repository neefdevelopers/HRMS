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
        brandId: user.brandId
      }
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
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
        }
      }
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const { passwordHash, ...safeUser } = user;
    return sendSuccess(res, safeUser);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch user', 500);
  }
};
