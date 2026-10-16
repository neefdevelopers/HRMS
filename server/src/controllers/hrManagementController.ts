import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';

const assignmentInputSchema = z.object({
  companyId: z.string(),
  role: z.enum(['ADMIN', 'HR', 'ATTENDANCE_VIEWER']).default('HR')
});

const createHrUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional().nullable(),
  role: z.enum(['ADMIN', 'HR', 'ATTENDANCE_VIEWER']).optional().default('HR'),
  companyIds: z.array(z.string()).optional().default([]),
  assignments: z.array(assignmentInputSchema).optional()
});

const updateHrUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(['ADMIN', 'HR', 'ATTENDANCE_VIEWER']).optional(),
  isActive: z.boolean().optional()
});

const updateAssignmentsSchema = z.object({
  companyIds: z.array(z.string()).optional(),
  assignments: z.array(assignmentInputSchema).optional()
});

/**
 * List all managed non-admin users (HR and Attendance Viewer) and their company assignments (Admin only)
 */
export const getHrUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managedUsers = await prisma.user.findMany({
      where: { role: { in: ['HR', 'ATTENDANCE_VIEWER'] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            id: true,
            companyId: true,
            role: true,
            isActive: true,
            company: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = managedUsers.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      role: u.role,
      createdAt: u.createdAt,
      assignments: (u.memberships || []).map((m: any) => ({
        membershipId: m.id,
        companyId: m.companyId,
        companyName: m.company?.name || '',
        companyCode: m.company?.code || '',
        isCompanyActive: m.company?.isActive ?? true,
        role: m.role || 'HR',
        isActive: m.isActive
      }))
    }));

    return sendSuccess(res, formatted);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch users', 500);
  }
};

/**
 * Create a new HR user account and assign to one or multiple companies (Admin only)
 */
export const createHrUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createHrUserSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase().trim() }
    });

    if (existingUser) {
      return sendError(res, 'A user with this email address already exists.', 400);
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    // Verify target company assignments
    let targetAssignments: Array<{ companyId: string; role: 'ADMIN' | 'HR' | 'ATTENDANCE_VIEWER' }> = [];
    if (parsed.assignments && parsed.assignments.length > 0) {
      targetAssignments = parsed.assignments;
    } else if (parsed.companyIds && parsed.companyIds.length > 0) {
      targetAssignments = parsed.companyIds.map((cid) => ({
        companyId: cid,
        role: parsed.role || 'HR'
      }));
    }

    const requestedCompIds = targetAssignments.map((a) => a.companyId);
    let verifiedCompanies: string[] = [];
    if (requestedCompIds.length > 0) {
      const companies = await prisma.company.findMany({
        where: { id: { in: requestedCompIds } },
        select: { id: true }
      });
      verifiedCompanies = companies.map((c) => c.id);
    }

    const verifiedAssignments = targetAssignments.filter((a) => verifiedCompanies.includes(a.companyId));
    const primaryCompanyId = verifiedAssignments.length > 0 ? verifiedAssignments[0].companyId : null;

    const user = await prisma.user.create({
      data: {
        firstName: parsed.firstName.trim(),
        lastName: parsed.lastName.trim(),
        email: parsed.email.toLowerCase().trim(),
        passwordHash,
        phone: parsed.phone,
        role: parsed.role || 'HR',
        isActive: true,
        companyId: primaryCompanyId
      }
    });

    // Create memberships with company-specific roles
    if (verifiedAssignments.length > 0) {
      for (const assign of verifiedAssignments) {
        await prisma.companyMembership.create({
          data: {
            userId: user.id,
            companyId: assign.companyId,
            role: assign.role,
            isActive: true
          }
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        changesJson: JSON.stringify({
          role: user.role,
          email: user.email,
          assignments: verifiedAssignments
        })
      }
    });

    // Notify the newly created user
    try {
      const companyCount = verifiedAssignments.length;
      await notificationService.createNotification({
        userId: user.id,
        companyId: primaryCompanyId,
        title: 'Welcome to HRMS',
        message: companyCount > 0
          ? `Your account has been created with role '${user.role}' and assigned to ${companyCount} ${companyCount === 1 ? 'company' : 'companies'}.`
          : `Your account has been created with role '${user.role}'. An administrator will assign you to your company workspace.`,
        type: 'HR_MANAGEMENT',
        module: 'hr_management',
        recordId: user.id,
        actionUrl: user.role === 'ATTENDANCE_VIEWER' ? '/attendance' : '/dashboard',
        eventKey: `user-welcome-${user.id}`
      });

      // Notify platform administrators
      const adminIds = await notificationService.getAdminUserIds();
      await notificationService.notifyUsers(
        adminIds.filter(id => id !== req.user?.id),
        {
          title: 'New User Account Provisioned',
          message: `${user.firstName} ${user.lastName} (${user.email}) has been provisioned with role '${user.role}' across ${companyCount} company assignments.`,
          type: 'HR_MANAGEMENT',
          module: 'hr_management',
          recordId: user.id,
          actionUrl: '/hr-management',
          eventKeyPrefix: `admin-user-created-${user.id}`
        }
      );
    } catch (notifErr: any) {
      console.error('[HrManagementController] Notification error on createHrUser:', notifErr.message);
    }

    const created = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          include: { company: true }
        }
      }
    });

    const formatted = {
      id: created!.id,
      firstName: created!.firstName,
      lastName: created!.lastName,
      fullName: `${created!.firstName} ${created!.lastName}`.trim(),
      email: created!.email,
      phone: created!.phone,
      isActive: created!.isActive,
      role: created!.role,
      createdAt: created!.createdAt,
      assignments: (created!.memberships || []).map((m: any) => ({
        membershipId: m.id,
        companyId: m.companyId,
        companyName: m.company?.name || '',
        companyCode: m.company?.code || '',
        isCompanyActive: m.company?.isActive ?? true,
        role: m.role || 'HR',
        isActive: m.isActive
      }))
    };

    return sendSuccess(res, formatted, 'User account created successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to create user', 500);
  }
};

/**
 * Update user account details or status (activate / deactivate / role)
 */
export const updateHrUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const parsed = updateHrUserSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'HR' && user.role !== 'ATTENDANCE_VIEWER')) {
      return sendError(res, 'User not found or is an administrator', 404);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(parsed.firstName && { firstName: parsed.firstName.trim() }),
        ...(parsed.lastName && { lastName: parsed.lastName.trim() }),
        ...(parsed.email && { email: parsed.email.toLowerCase().trim() }),
        ...(parsed.phone !== undefined && { phone: parsed.phone }),
        ...(parsed.role && { role: parsed.role }),
        ...(parsed.isActive !== undefined && { isActive: parsed.isActive })
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: updated.id,
        changesJson: JSON.stringify(parsed)
      }
    });

    return sendSuccess(res, updated, 'User updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to update user', 500);
  }
};

/**
 * Update company assignments and company-specific roles for a user (Admin only)
 * Adds new company assignments and removes unselected ones immediately
 */
export const updateHrCompanyAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const parsed = updateAssignmentsSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'HR' && user.role !== 'ATTENDANCE_VIEWER')) {
      return sendError(res, 'User not found or is an administrator', 404);
    }

    // Resolve target assignments
    let targetAssignments: Array<{ companyId: string; role: 'ADMIN' | 'HR' | 'ATTENDANCE_VIEWER' }> = [];
    if (parsed.assignments && parsed.assignments.length > 0) {
      targetAssignments = parsed.assignments;
    } else if (parsed.companyIds) {
      targetAssignments = parsed.companyIds.map((cid) => ({
        companyId: cid,
        role: (user.role as any) || 'HR'
      }));
    }

    // Verify requested company IDs exist
    const requestedCompIds = targetAssignments.map((a) => a.companyId);
    const validCompanies = await prisma.company.findMany({
      where: { id: { in: requestedCompIds } },
      select: { id: true }
    });
    const validCompanyIds = new Set(validCompanies.map((c) => c.id));
    const verifiedAssignments = targetAssignments.filter((a) => validCompanyIds.has(a.companyId));

    // Get current memberships
    const currentMemberships = await prisma.companyMembership.findMany({
      where: { userId }
    });

    // 1. Remove memberships that are no longer assigned
    for (const mem of currentMemberships) {
      if (!validCompanyIds.has(mem.companyId)) {
        await prisma.companyMembership.delete({
          where: { id: mem.id }
        });
      }
    }

    // 2. Add or reactivate newly selected companies with their assigned roles
    for (const assign of verifiedAssignments) {
      await prisma.companyMembership.upsert({
        where: {
          userId_companyId: {
            userId,
            companyId: assign.companyId
          }
        },
        create: {
          userId,
          companyId: assign.companyId,
          role: assign.role,
          isActive: true
        },
        update: {
          role: assign.role,
          isActive: true
        }
      });
    }

    // Update primary companyId on user
    const primaryCompId = verifiedAssignments.length > 0 ? verifiedAssignments[0].companyId : null;
    await prisma.user.update({
      where: { id: userId },
      data: { companyId: primaryCompId }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE_ASSIGNMENTS',
        entityType: 'User',
        entityId: userId,
        changesJson: JSON.stringify({ assignedCompanies: verifiedAssignments })
      }
    });

    // Notify the user about company assignment updates
    try {
      const activeCount = verifiedAssignments.length;
      await notificationService.createNotification({
        userId,
        companyId: primaryCompId,
        title: 'Company Assignments Updated',
        message: activeCount > 0
          ? `Your company assignments have been updated by an Administrator (${activeCount} active ${activeCount === 1 ? 'assignment' : 'assignments'}).`
          : 'Your company assignments have been updated. You currently have no active company assignments.',
        type: 'HR_MANAGEMENT',
        module: 'hr_management',
        recordId: userId,
        actionUrl: user.role === 'ATTENDANCE_VIEWER' ? '/attendance' : '/dashboard',
        eventKey: `assignments-updated-${userId}-${Date.now()}`
      });
    } catch (notifErr: any) {
      console.error('[HrManagementController] Notification error on updateHrCompanyAssignments:', notifErr.message);
    }

    // Return updated memberships
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { company: true }
        }
      }
    });

    const formatted = {
      id: updatedUser!.id,
      firstName: updatedUser!.firstName,
      lastName: updatedUser!.lastName,
      fullName: `${updatedUser!.firstName} ${updatedUser!.lastName}`.trim(),
      email: updatedUser!.email,
      phone: updatedUser!.phone,
      isActive: updatedUser!.isActive,
      role: updatedUser!.role,
      createdAt: updatedUser!.createdAt,
      assignments: (updatedUser!.memberships || []).map((m: any) => ({
        membershipId: m.id,
        companyId: m.companyId,
        companyName: m.company?.name || '',
        companyCode: m.company?.code || '',
        isCompanyActive: m.company?.isActive ?? true,
        role: m.role || 'HR',
        isActive: m.isActive
      }))
    };

    return sendSuccess(res, formatted, 'Company assignments updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to update company assignments', 500);
  }
};

/**
 * View users assigned to a particular company
 */
export const getCompanyHrUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return sendError(res, 'Company not found', 404);
    }

    const memberships = await prisma.companyMembership.findMany({
      where: {
        companyId,
        isActive: true,
        user: { isActive: true }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            role: true
          }
        }
      }
    });

    const members = memberships.map((m) => ({
      membershipId: m.id,
      user: m.user,
      role: m.role || m.user.role,
      isActive: m.isActive
    }));

    return sendSuccess(res, members);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch company users', 500);
  }
};

/**
 * Assign an existing user to a specific company with role (HR or ATTENDANCE_VIEWER)
 */
export const assignCompanyHrUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const { userId, role } = req.body;

    if (!userId) {
      return sendError(res, 'userId is required', 400);
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return sendError(res, 'Company not found', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'HR' && user.role !== 'ATTENDANCE_VIEWER' && user.role !== 'ADMIN')) {
      return sendError(res, 'Valid user required', 404);
    }

    const targetRole = role === 'ATTENDANCE_VIEWER' ? 'ATTENDANCE_VIEWER' : (role === 'ADMIN' ? 'ADMIN' : 'HR');

    const membership = await prisma.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId,
          companyId
        }
      },
      create: {
        userId,
        companyId,
        role: targetRole,
        isActive: true
      },
      update: {
        role: targetRole,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'ASSIGN_USER',
        entityType: 'CompanyMembership',
        entityId: membership.id,
        companyId,
        changesJson: JSON.stringify({ role: targetRole })
      }
    });

    return sendSuccess(res, membership, 'User assigned to company successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to assign user', 500);
  }
};

/**
 * Remove an HR user from a company (immediate revocation)
 */
export const removeCompanyHrUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, userId } = req.params;

    const membership = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId
        }
      }
    });

    if (!membership) {
      return sendError(res, 'Assignment not found', 404);
    }

    await prisma.companyMembership.delete({
      where: { id: membership.id }
    });

    // If user's default companyId was this company, clear or update it
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { isActive: true } } }
    });

    if (user && user.companyId === companyId) {
      const nextComp = user.memberships.length > 0 ? user.memberships[0].companyId : null;
      await prisma.user.update({
        where: { id: userId },
        data: { companyId: nextComp }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'REMOVE_HR_ASSIGNMENT',
        entityType: 'CompanyMembership',
        entityId: membership.id,
        companyId
      }
    });

    return sendSuccess(res, null, 'HR user assignment removed successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to remove HR user assignment', 500);
  }
};
