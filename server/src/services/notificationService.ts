import { prisma } from '../config/prisma.js';
import { Role } from '../middleware/rbac.js';

export interface CreateNotificationInput {
  userId: string;
  companyId?: string | null;
  title: string;
  message: string;
  type: 'LEAVE' | 'ATTENDANCE' | 'SALARY' | 'EMPLOYEE' | 'EXIT' | 'HR_MANAGEMENT' | 'SYSTEM' | 'INFO' | string;
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
  companyId?: string | null;
  search?: string;
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
        where: { eventKey: data.eventKey },
        include: {
          company: {
            select: { id: true, name: true, code: true, logo: true }
          }
        }
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
        },
        include: {
          company: {
            select: { id: true, name: true, code: true, logo: true }
          }
        }
      });
    } catch (err: any) {
      // In case of unique constraint race condition on eventKey
      if (err.code === 'P2002' && data.eventKey) {
        return await prisma.notification.findUnique({
          where: { eventKey: data.eventKey },
          include: {
            company: {
              select: { id: true, name: true, code: true, logo: true }
            }
          }
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
   * Resolves recipient HR and Admin user IDs for a given company.
   */
  async getHrUserIdsForCompany(companyId: string): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: Role.ADMIN },
          {
            role: Role.HR,
            memberships: {
              some: {
                companyId,
                isActive: true
              }
            }
          }
        ]
      },
      select: { id: true }
    });

    return users.map((u) => u.id);
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

    if (companyId) {
      return this.getHrUserIdsForCompany(companyId);
    }

    return this.getAdminUserIds();
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
   * Direct manager (if has user account) + authorized HRs of their brand/company.
   */
  async getApproverUserIdsForEmployee(employeeId: string): Promise<string[]> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { reportingManagerId: true, brandId: true }
    });

    if (!employee) return [];

    const approverUserIds: string[] = [];

    // 1. Direct Reporting Manager user (if exists)
    if (employee.reportingManagerId) {
      const managerUser = await this.getUserIdByEmployeeId(employee.reportingManagerId);
      if (managerUser) approverUserIds.push(managerUser);
    }

    // 2. HR & Admin users for this brand's company
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
        role: Role.ADMIN
      },
      select: { id: true }
    });
    return admins.map((u) => u.id);
  }

  /**
   * Retrieves notifications for a specific user with pagination, company scoping, and search.
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

    // Tenant / Company scoping: filter by companyId if specified, or allow platform/system alerts (companyId = null)
    if (filters.companyId && filters.companyId !== 'all') {
      where.OR = [
        { companyId: filters.companyId },
        { companyId: null }
      ];
    }

    // Keyword search over title and message
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      const searchCriteria = {
        OR: [
          { title: { contains: term } },
          { message: { contains: term } }
        ]
      };

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          searchCriteria
        ];
        delete where.OR;
      } else {
        where.AND = [searchCriteria];
      }
    }

    const unreadWhere: any = {
      userId,
      isRead: false
    };
    if (filters.companyId && filters.companyId !== 'all') {
      unreadWhere.OR = [
        { companyId: filters.companyId },
        { companyId: null }
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              code: true,
              logo: true
            }
          }
        }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: unreadWhere })
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount
      }
    };
  }

  /**
   * Returns unread notifications count for a user, with optional company scoping.
   */
  async getUnreadCount(userId: string, companyId?: string | null): Promise<number> {
    const where: any = { userId, isRead: false };
    if (companyId && companyId !== 'all') {
      where.OR = [
        { companyId },
        { companyId: null }
      ];
    }
    return prisma.notification.count({ where });
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
      return prisma.notification.findUnique({
        where: { id: notificationId },
        include: {
          company: {
            select: { id: true, name: true, code: true, logo: true }
          }
        }
      });
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      },
      include: {
        company: {
          select: { id: true, name: true, code: true, logo: true }
        }
      }
    });
  }

  /**
   * Marks a specific notification as unread.
   */
  async markAsUnread(notificationId: string, userId: string) {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notif) {
      throw new Error('Notification not found.');
    }

    if (notif.userId !== userId) {
      throw new Error('Access denied. You do not own this notification.');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: false,
        readAt: null
      },
      include: {
        company: {
          select: { id: true, name: true, code: true, logo: true }
        }
      }
    });
  }

  /**
   * Deletes a specific notification with user ownership enforcement.
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notif) {
      throw new Error('Notification not found.');
    }

    if (notif.userId !== userId) {
      throw new Error('Access denied. You do not own this notification.');
    }

    return prisma.notification.delete({
      where: { id: notificationId }
    });
  }

  /**
   * Marks all notifications of a user as read, optionally scoped by company.
   */
  async markAllAsRead(userId: string, companyId?: string | null) {
    const where: any = {
      userId,
      isRead: false
    };

    if (companyId && companyId !== 'all') {
      where.OR = [
        { companyId },
        { companyId: null }
      ];
    }

    const result = await prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return { updatedCount: result.count };
  }

  /**
   * Clears/deletes all read notifications for a user, optionally scoped by company.
   */
  async clearReadNotifications(userId: string, companyId?: string | null) {
    const where: any = {
      userId,
      isRead: true
    };

    if (companyId && companyId !== 'all') {
      where.OR = [
        { companyId },
        { companyId: null }
      ];
    }

    const result = await prisma.notification.deleteMany({ where });
    return { deletedCount: result.count };
  }
}

export const notificationService = new NotificationService();
