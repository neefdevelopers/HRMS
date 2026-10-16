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
    const effectiveCompanyId = req.effectiveCompanyId;
    const queryCompanyId = req.query.companyId as string | undefined;

    let whereClause: any = {};

    // Filter by company:
    // If effectiveCompanyId is set, enforce it.
    // If Super Admin with no effectiveCompanyId provided a specific companyId query, filter by it.
    const companyFilter = effectiveCompanyId || (req.user?.role === Role.ADMIN && queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : undefined);
    if (companyFilter) {
      whereClause.companyId = companyFilter;
    }

    // Role-based brand filtering
    if (userRole === Role.HR && userBrandId) {
      whereClause.id = userBrandId;
    }

    const brands = await prisma.brand.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            isActive: true
          }
        },
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

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            isActive: true
          }
        },
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

    // Company isolation check
    if (req.effectiveCompanyId && brand.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied. Brand belongs to another company.', 403);
    }

    // Role brand-level check
    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== id) {
      return sendError(res, 'Access denied for this brand.', 403);
    }

    return sendSuccess(res, brand);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch brand', 500);
  }
};

const brandSchema = z.object({
  name: z.string().min(2, 'Brand name must be at least 2 characters'),
  code: z.string().min(2, 'Brand code must be at least 2 characters'),
  companyName: z.string().optional(),
  logo: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  companyId: z.string().optional()
});

export const createBrand = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = brandSchema.parse(req.body);

    let targetCompanyId: string | undefined;

    // Platform Admin can target any company; company-level users are strictly bound to their membership
    if (req.user?.role === Role.ADMIN) {
      targetCompanyId = validatedData.companyId || req.effectiveCompanyId || undefined;
    } else {
      targetCompanyId = req.effectiveCompanyId || undefined;
      if (validatedData.companyId && validatedData.companyId !== req.effectiveCompanyId) {
        return sendError(res, 'Access denied. You cannot create a brand for another company.', 403);
      }
    }

    if (!targetCompanyId) {
      return sendError(res, 'A company must be selected to create a brand.', 400);
    }

    // Validate that company exists and is active
    const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!company) {
      return sendError(res, 'Target company not found.', 404);
    }
    if (!company.isActive) {
      return sendError(res, 'Target company is inactive. New brands cannot be created under an inactive company.', 400);
    }

    // Check code/name uniqueness scoped to this company
    const existing = await prisma.brand.findFirst({
      where: {
        companyId: targetCompanyId,
        OR: [{ name: validatedData.name }, { code: validatedData.code }]
      }
    });

    if (existing) {
      if (existing.code.toLowerCase() === validatedData.code.toLowerCase()) {
        return sendError(res, `Brand code '${validatedData.code}' already exists within this company.`, 400);
      }
      return sendError(res, `Brand name '${validatedData.name}' already exists within this company.`, 400);
    }

    const brand = await prisma.brand.create({
      data: {
        name: validatedData.name,
        code: validatedData.code.toUpperCase(),
        companyName: validatedData.companyName || company.name,
        logo: validatedData.logo,
        website: validatedData.website,
        phone: validatedData.phone,
        email: validatedData.email,
        address: validatedData.address,
        isActive: validatedData.isActive ?? true,
        companyId: targetCompanyId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            isActive: true
          }
        },
        _count: {
          select: {
            employees: true,
            branches: true,
            departments: true
          }
        }
      }
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE',
        entityType: 'Brand',
        entityId: brand.id,
        brandId: brand.id,
        companyId: targetCompanyId,
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

    const existingBrand = await prisma.brand.findUnique({
      where: { id },
      include: { company: true }
    });
    if (!existingBrand) {
      return sendError(res, 'Brand not found', 404);
    }

    // Company isolation check
    if (
      req.user?.role !== Role.ADMIN &&
      existingBrand.companyId !== req.effectiveCompanyId
    ) {
      return sendError(res, 'Access denied. Brand belongs to another company.', 403);
    }

    // If companyId is being changed, only Admin can do that
    if (validatedData.companyId && validatedData.companyId !== existingBrand.companyId) {
      if (req.user?.role !== Role.ADMIN) {
        return sendError(res, 'Access denied. You cannot transfer a brand to another company.', 403);
      }
      const targetCompany = await prisma.company.findUnique({ where: { id: validatedData.companyId } });
      if (!targetCompany) {
        return sendError(res, 'Target company not found.', 404);
      }
      if (!targetCompany.isActive) {
        return sendError(res, 'Target company is inactive.', 400);
      }
    }

    const targetCompanyId = validatedData.companyId || existingBrand.companyId;

    // Check code/name conflict within that company if name or code changed
    if (
      (validatedData.name && validatedData.name !== existingBrand.name) ||
      (validatedData.code && validatedData.code !== existingBrand.code)
    ) {
      const conflict = await prisma.brand.findFirst({
        where: {
          companyId: targetCompanyId,
          id: { not: id },
          OR: [
            ...(validatedData.name ? [{ name: validatedData.name }] : []),
            ...(validatedData.code ? [{ code: validatedData.code }] : [])
          ]
        }
      });
      if (conflict) {
        if (conflict.code.toLowerCase() === validatedData.code?.toLowerCase()) {
          return sendError(res, `Brand code '${validatedData.code}' is already in use by another brand in this company.`, 400);
        }
        return sendError(res, `Brand name '${validatedData.name}' is already in use by another brand in this company.`, 400);
      }
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...validatedData,
        code: validatedData.code ? validatedData.code.toUpperCase() : undefined,
        companyId: targetCompanyId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            isActive: true
          }
        },
        _count: {
          select: {
            employees: true,
            branches: true,
            departments: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE',
        entityType: 'Brand',
        entityId: brand.id,
        brandId: brand.id,
        companyId: targetCompanyId,
        changesJson: JSON.stringify(validatedData)
      }
    });

    return sendSuccess(res, brand, 'Brand updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to update brand', 500);
  }
};

export const toggleBrandStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const existingBrand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true }
        }
      }
    });

    if (!existingBrand) {
      return sendError(res, 'Brand not found', 404);
    }

    if (
      req.user?.role !== Role.ADMIN &&
      existingBrand.companyId !== req.effectiveCompanyId
    ) {
      return sendError(res, 'Access denied. Brand belongs to another company.', 403);
    }

    const newStatus = typeof isActive === 'boolean' ? isActive : !existingBrand.isActive;

    const brand = await prisma.brand.update({
      where: { id },
      data: { isActive: newStatus },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            isActive: true
          }
        },
        _count: {
          select: {
            employees: true,
            branches: true,
            departments: true
          }
        }
      }
    });

    // Note: Deactivating a brand does not delete any of its employees or historical HR records.
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: newStatus ? 'ACTIVATE' : 'DEACTIVATE',
        entityType: 'Brand',
        entityId: brand.id,
        brandId: brand.id,
        companyId: brand.companyId,
        changesJson: JSON.stringify({
          isActive: newStatus,
          historicalEmployeesPreserved: existingBrand._count.employees
        })
      }
    });

    return sendSuccess(
      res,
      brand,
      `Brand ${newStatus ? 'activated' : 'deactivated'} successfully. All historical records remain intact.`
    );
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update brand status', 500);
  }
};

export const getBranches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const effectiveCompanyId = req.effectiveCompanyId;
    const queryCompanyId = req.query.companyId as string | undefined;

    const whereClause: any = {};

    const companyFilter = effectiveCompanyId || (req.user?.role === Role.ADMIN && queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : undefined);
    if (companyFilter) {
      whereClause.brand = { companyId: companyFilter };
    }

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
    const effectiveCompanyId = req.effectiveCompanyId;
    const queryCompanyId = req.query.companyId as string | undefined;

    const whereClause: any = {};

    const companyFilter = effectiveCompanyId || (req.user?.role === Role.ADMIN && queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : undefined);
    if (companyFilter) {
      whereClause.brand = { companyId: companyFilter };
    }

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
    const effectiveCompanyId = req.effectiveCompanyId;
    const queryCompanyId = req.query.companyId as string | undefined;

    const whereClause: any = {};

    const companyFilter = effectiveCompanyId || (req.user?.role === Role.ADMIN && queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : undefined);
    if (companyFilter) {
      whereClause.brand = { companyId: companyFilter };
    }

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
    const effectiveCompanyId = req.effectiveCompanyId;
    const queryCompanyId = req.query.companyId as string | undefined;

    const whereClause: any = {};

    const companyFilter = effectiveCompanyId || (req.user?.role === Role.ADMIN && queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : undefined);
    if (companyFilter) {
      whereClause.brand = { companyId: companyFilter };
    }

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
