import { prisma } from '../config/prisma.js';
import { Role } from '../middleware/rbac.js';

export interface CreateNotificationInput {
  userId: string;
  companyId?: string | null;
  title: string;
  message: string;
  type: 'LEAVE' | 'ATTENDANCE' | 'SALARY' | 'EMPLOYEE' | 'EXIT' | 'SYSTEM' | 'INFO' | string;
  module?: string;
  recordId?: string;
  actionUrl?: string;
  eventKey?: string;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

export class NotificationService {
  /**
   * Creates a single in-app notification with duplicate prevention.
   */
  async createNotification(data: CreateNotificationInput) {
    if (!data.userId || !data.title || !data.message) {
      return null;
    }

    // Deduplication check via eventKey if provided
    if (data.eventKey) {
      const existing = await prisma.notification.findUnique({
        where: { eventKey: data.eventKey }
      });
      if (existing) {
        return existing;
      }
    }

    try {
      return await prisma.notification.create({
        data: {
          userId: data.userId,
          companyId: data.companyId || null,
          title: data.title.trim(),
          message: data.message.trim(),
          type: data.type || 'INFO',
          module: data.module || null,
          recordId: data.recordId || null,
          actionUrl: data.actionUrl || null,
          eventKey: data.eventKey || null
        }
      });
    } catch (err: any) {
      // In case of unique constraint race condition on eventKey
      if (err.code === 'P2002' && data.eventKey) {
        return await prisma.notification.findUnique({
          where: { eventKey: data.eventKey }
        });
      }
      console.error('[NotificationService] Failed to create notification:', err.message);
      return null;
    }
  }

  /**
   * Broadcasts notifications to multiple targeted recipients without duplication.
   */
  async notifyUsers(
    userIds: string[],
    data: Omit<CreateNotificationInput, 'userId' | 'eventKey'> & { eventKeyPrefix?: string }
  ) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    const results = [];

    for (const userId of uniqueUserIds) {
      const eventKey = data.eventKeyPrefix ? `${data.eventKeyPrefix}-${userId}` : undefined;
      const notif = await this.createNotification({
        userId,
        companyId: data.companyId,
        title: data.title,
        message: data.message,
        type: data.type,
        module: data.module,
        recordId: data.recordId,
        actionUrl: data.actionUrl,
        eventKey
      });
      if (notif) results.push(notif);
    }

    return results;
  }

  /**
   * Resolves recipient HR user IDs for a given brand scoped to company.
   */
  async getHrUserIdsForBrand(brandId?: string | null): Promise<string[]> {
    let companyId: string | null = null;
    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { companyId: true } });
      if (brand) companyId = brand.companyId;
    }

    const whereConditions: any[] = [
      { role: Role.SUPER_ADMIN }
    ];

    if (companyId) {
      whereConditions.push(
        { role: 'COMPANY_ADMIN', companyId },
        { role: 'COMPANY_HR', companyId },
        { role: 'GROUP_HR', companyId }
      );
      if (brandId) {
        whereConditions.push({ role: Role.BRAND_HR, brandId, companyId });
      } else {
        whereConditions.push({ role: Role.BRAND_HR, companyId });
      }
    } else {
      whereConditions.push(
        { role: 'COMPANY_ADMIN' },
        { role: 'COMPANY_HR' },
        { role: 'GROUP_HR' },
        { role: Role.BRAND_HR }
      );
    }

    const hrUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: whereConditions
      },
      select: { id: true }
    });

    return hrUsers.map((u) => u.id);
  }

  /**
   * Resolves user ID for an employee.
   */
  async getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
    const user = await prisma.user.findFirst({
      where: { employeeId, isActive: true },
      select: { id: true }
    });
    return user ? user.id : null;
  }

  /**
   * Resolves approver user IDs for an employee:
   * Their direct reporting manager (if has user account) + authorized HRs of their brand.
   */
  async getApproverUserIdsForEmployee(employeeId: string): Promise<string[]> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { reportingManagerId: true, brandId: true }
    });

    if (!employee) return [];

    const approverUserIds: string[] = [];

    // 1. Direct Reporting Manager user
    if (employee.reportingManagerId) {
      const managerUser = await this.getUserIdByEmployeeId(employee.reportingManagerId);
      if (managerUser) approverUserIds.push(managerUser);
    }

    // 2. Brand HR, Group HR, and Super Admin
    const hrUsers = await this.getHrUserIdsForBrand(employee.brandId);
    approverUserIds.push(...hrUsers);

    return [...new Set(approverUserIds)];
  }

  /**
   * Resolves system administrator user IDs.
   */
  async getAdminUserIds(): Promise<string[]> {
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        role: Role.SUPER_ADMIN
      },
      select: { id: true }
    });
    return admins.map((u) => u.id);
  }

  /**
   * Retrieves notifications for a specific user with pagination and optional read filter.
   */
  async getUserNotifications(userId: string, filters: NotificationFilters = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));

    const where: any = { userId };

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters.type && filters.type !== 'ALL') {
      where.type = filters.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount
      }
    };
  }

  /**
   * Returns unread notifications count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false }
    });
  }

  /**
   * Marks a specific notification as read, enforcing strict user ownership.
   */
  async markAsRead(notificationId: string, userId: string) {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notif) {
      throw new Error('Notification not found.');
    }

    if (notif.userId !== userId) {
      throw new Error('Access denied. You do not own this notification.');
    }

    if (notif.isRead) {
      return notif;
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  /**
   * Marks all notifications of a user as read.
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return { updatedCount: result.count };
  }
}

export const notificationService = new NotificationService();
