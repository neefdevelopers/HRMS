import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  code: z.string().min(2, 'Company code is required').transform(v => v.toUpperCase().trim()),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  // Optional initial admin setup
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(6).optional(),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional()
});

const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

/**
 * List all registered companies (Platform Super Admin only)
 * Supports query params: search, status ('ALL', 'ACTIVE', 'INACTIVE')
 */
export const getCompanies = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status } = req.query;

    const whereClause: any = {};

    if (search && typeof search === 'string' && search.trim() !== '') {
      whereClause.OR = [
        { name: { contains: search.trim() } },
        { code: { contains: search.trim().toUpperCase() } },
        { email: { contains: search.trim() } }
      ];
    }

    if (status && status !== 'ALL') {
      whereClause.isActive = status === 'ACTIVE';
    }

    const companies = await prisma.company.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            brands: true,
            employees: true,
            users: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, companies);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch companies', 500);
  }
};

/**
 * Get company overview details & metrics by ID
 */
export const getCompanyById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        brands: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            _count: {
              select: {
                employees: true
              }
            }
          }
        },
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true
              }
            }
          }
        },
        _count: {
          select: {
            brands: true,
            employees: true,
            assets: true,
            documents: true
          }
        }
      }
    });

    if (!company) {
      return sendError(res, 'Company not found', 404);
    }

    return sendSuccess(res, company);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch company details', 500);
  }
};

/**
 * Create a new Company (Platform Super Admin only)
 */
export const createCompany = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createCompanySchema.parse(req.body);

    // Check code uniqueness
    const existing = await prisma.company.findUnique({
      where: { code: parsed.code }
    });
    if (existing) {
      return sendError(res, `Company with code '${parsed.code}' already exists.`, 400);
    }

    const company = await prisma.company.create({
      data: {
        name: parsed.name,
        code: parsed.code,
        email: parsed.email,
        phone: parsed.phone,
        address: parsed.address,
        logo: parsed.logo,
        registrationNumber: parsed.registrationNumber,
        taxId: parsed.taxId,
        isActive: parsed.isActive ?? true
      }
    });

    // Optionally create company admin user if credentials provided
    if (parsed.adminEmail && parsed.adminPassword) {
      const passwordHash = await bcrypt.hash(parsed.adminPassword, 10);
      let adminUser = await prisma.user.findUnique({ where: { email: parsed.adminEmail } });
      
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: {
            email: parsed.adminEmail,
            passwordHash,
            firstName: parsed.adminFirstName || 'Company',
            lastName: parsed.adminLastName || 'Admin',
            role: 'COMPANY_ADMIN',
            companyId: company.id
          }
        });
      }

      await prisma.companyMembership.upsert({
        where: {
          userId_companyId: {
            userId: adminUser.id,
            companyId: company.id
          }
        },
        create: {
          userId: adminUser.id,
          companyId: company.id,
          role: 'COMPANY_ADMIN',
          isActive: true
        },
        update: {
          role: 'COMPANY_ADMIN',
          isActive: true
        }
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE',
        entityType: 'Company',
        entityId: company.id,
        companyId: company.id,
        changesJson: JSON.stringify({ name: company.name, code: company.code })
      }
    });

    return sendSuccess(res, company, 'Company registered successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to create company', 500);
  }
};

/**
 * Update Company details
 */
export const updateCompany = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateCompanySchema.parse(req.body);

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 'Company not found', 404);
    }

    const updated = await prisma.company.update({
      where: { id },
      data: parsed
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE',
        entityType: 'Company',
        entityId: updated.id,
        companyId: updated.id,
        changesJson: JSON.stringify(parsed)
      }
    });

    return sendSuccess(res, updated, 'Company updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to update company', 500);
  }
};

/**
 * Activate or Deactivate Company status
 */
export const toggleCompanyStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return sendError(res, 'isActive boolean field is required', 400);
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return sendError(res, 'Company not found', 404);
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { isActive }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
        entityType: 'Company',
        entityId: updated.id,
        companyId: updated.id
      }
    });

    return sendSuccess(res, updated, `Company ${isActive ? 'activated' : 'deactivated'} successfully`);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update company status', 500);
  }
};

/**
 * Assign an existing user or invite a new user as Company Admin
 */
export const assignCompanyAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { email, password, firstName, lastName } = req.body;

    if (!email) {
      return sendError(res, 'Email is required', 400);
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return sendError(res, 'Company not found', 404);
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (!password || password.length < 6) {
        return sendError(res, 'A temporary password of at least 6 characters is required for new user.', 400);
      }
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: firstName || 'Company',
          lastName: lastName || 'Admin',
          role: 'COMPANY_ADMIN',
          companyId
        }
      });
    }

    // Create or update membership
    const membership = await prisma.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId
        }
      },
      create: {
        userId: user.id,
        companyId,
        role: 'COMPANY_ADMIN',
        isActive: true
      },
      update: {
        role: 'COMPANY_ADMIN',
        isActive: true
      }
    });

    return sendSuccess(res, { user, membership }, 'Company admin assigned successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to assign company admin', 500);
  }
};

/**
 * Get comprehensive overview metrics for a Company
 */
export const getCompanyOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        brands: {
          include: {
            _count: { select: { employees: true } }
          }
        },
        memberships: {
          where: { isActive: true },
          include: { user: true }
        }
      }
    });

    if (!company) {
      return sendError(res, 'Company not found', 404);
    }

    const [employeeCount, punchingDeviceCount, activeExitCount] = await Promise.all([
      prisma.employee.count({ where: { companyId: id } }),
      prisma.punchingDevice.count({ where: { companyId: id } }),
      prisma.exitRequest.count({ where: { companyId: id, status: { notIn: ['COMPLETED', 'REJECTED'] } } })
    ]);

    return sendSuccess(res, {
      company,
      brands: company.brands,
      employeeCount,
      punchingDeviceCount,
      adminMemberships: company.memberships,
      activeExitCount
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch company overview', 500);
  }
};

