import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';

export const getBrands = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userBrandId = req.user?.brandId;

    let whereClause = {};
    if (userRole !== Role.SUPER_ADMIN && userRole !== Role.GROUP_HR) {
      if (!userBrandId) {
        return sendSuccess(res, []);
      }
      whereClause = { id: userBrandId };
    }

    const brands = await prisma.brand.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            employees: true,
            branches: true,
            departments: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return sendSuccess(res, brands);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch brands', 500);
  }
};

export const getBrandById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Enforce role isolation
    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== id
    ) {
      return sendError(res, 'Access denied for this brand.', 403);
    }

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        branches: true,
        departments: true,
        shifts: true,
        _count: {
          select: { employees: true }
        }
      }
    });

    if (!brand) {
      return sendError(res, 'Brand not found', 404);
    }

    return sendSuccess(res, brand);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch brand', 500);
  }
};

const brandSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  companyName: z.string().min(2),
  logo: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true)
});

export const createBrand = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = brandSchema.parse(req.body);

    const existing = await prisma.brand.findFirst({
      where: {
        OR: [{ name: validatedData.name }, { code: validatedData.code }]
      }
    });

    if (existing) {
      return sendError(res, 'Brand with this name or code already exists', 400);
    }

    const brand = await prisma.brand.create({
      data: validatedData
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE',
        entityType: 'Brand',
        entityId: brand.id,
        brandId: brand.id,
        changesJson: JSON.stringify(validatedData)
      }
    });

    return sendSuccess(res, brand, 'Brand created successfully', undefined, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to create brand', 500);
  }
};

export const updateBrand = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = brandSchema.partial().parse(req.body);

    const brand = await prisma.brand.update({
      where: { id },
      data: validatedData
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE',
        entityType: 'Brand',
        entityId: brand.id,
        brandId: brand.id,
        changesJson: JSON.stringify(validatedData)
      }
    });

    return sendSuccess(res, brand, 'Brand updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update brand', 500);
  }
};

export const getBranches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;

    const whereClause: any = {};
    if (brandId && brandId !== 'all') {
      whereClause.brandId = brandId;
    }

    const branches = await prisma.branch.findMany({
      where: whereClause,
      include: { brand: true, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' }
    });

    return sendSuccess(res, branches);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch branches', 500);
  }
};

export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const whereClause: any = {};
    if (brandId && brandId !== 'all') {
      whereClause.brandId = brandId;
    }

    const departments = await prisma.department.findMany({
      where: whereClause,
      include: {
        brand: true,
        designations: true,
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });

    return sendSuccess(res, departments);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch departments', 500);
  }
};

export const getDesignations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const whereClause: any = {};
    if (brandId && brandId !== 'all') {
      whereClause.brandId = brandId;
    }

    const designations = await prisma.designation.findMany({
      where: whereClause,
      include: { brand: true, department: true },
      orderBy: { title: 'asc' }
    });

    return sendSuccess(res, designations);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch designations', 500);
  }
};

export const getShifts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const whereClause: any = {};
    if (brandId && brandId !== 'all') {
      whereClause.brandId = brandId;
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: { brand: true },
      orderBy: { name: 'asc' }
    });

    return sendSuccess(res, shifts);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch shifts', 500);
  }
};
