import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { sendError } from '../utils/response.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    brandId?: string | null;
    branchId?: string | null;
    employeeId?: string | null;
    firstName: string;
    lastName: string;
  };
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
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      return sendError(res, 'User not found or inactive.', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      brandId: user.brandId,
      branchId: user.branchId,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName
    };

    next();
  } catch (error: any) {
    return sendError(res, 'Authentication failed: ' + error.message, 500);
  }
};
