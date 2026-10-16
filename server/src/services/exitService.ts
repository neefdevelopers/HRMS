import { prisma } from '../config/prisma.js';
import { Role } from '../middleware/rbac.js';
import { relievingLetterPdfService } from './relievingLetterPdfService.js';
import { notificationService } from './notificationService.js';

export interface ExitFilters {
  brandId?: string | null;
  status?: string | null;
  search?: string | null;
}

export class ExitService {
  /**
   * Helper to add days to a 'YYYY-MM-DD' date string and return 'YYYY-MM-DD'.
   */
  private addDaysToDateString(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Helper to calculate remaining days between today and lastWorkingDay.
   */
  private calculateRemainingDays(lastWorkingDayStr: string): number {
    const todayStr = new Date().toISOString().split('T')[0];
    const [tY, tM, tD] = todayStr.split('-').map(Number);
    const [lY, lM, lD] = lastWorkingDayStr.split('-').map(Number);

    const todayDate = Date.UTC(tY, tM - 1, tD);
    const lwdDate = Date.UTC(lY, lM - 1, lD);

    const diffMs = lwdDate - todayDate;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * Helper to retrieve current company settings for notice period duration.
   */
  private async getCompanyNoticePeriodDays(): Promise<number> {
    try {
      const setting = await prisma.systemSetting.findFirst({
        where: { key: 'COMPANY_NOTICE_PERIOD_DAYS' }
      });
      if (setting && setting.value) {
        const val = parseInt(JSON.parse(setting.value), 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {
      // Fallback to 30 days default
    }
    return 30;
  }

  /**
   * 1. Exit Management Dashboard: Metrics & Requests List
   */
  async getDashboard(filters: ExitFilters, user: any) {
    const where: any = {};

    // Multi-company and brand permission boundary
    if (user.companyId) {
      where.companyId = user.companyId;
    }
    if (filters.brandId && filters.brandId !== 'all') {
      where.brandId = filters.brandId;
    } else if (user.role === Role.HR && user.brandId) {
      where.brandId = user.brandId;
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { employee: { firstName: { contains: term } } },
        { employee: { lastName: { contains: term } } },
        { employee: { employeeId: { contains: term } } },
        { employee: { email: { contains: term } } }
      ];
    }

    // Compute metrics using aggregate counts scoped to the user's company and brand permission
    const metricsWhere: any = {};
    if (user.companyId) {
      metricsWhere.companyId = user.companyId;
    }
    if (filters.brandId && filters.brandId !== 'all') {
      metricsWhere.brandId = filters.brandId;
    } else if (user.role === Role.HR && user.brandId) {
      metricsWhere.brandId = user.brandId;
    }

    const [totalRequests, pendingApprovals, servingNotice, pendingAssetClearance, exitsCompleted] =
      await Promise.all([
        prisma.exitRequest.count({ where: metricsWhere }),
        prisma.exitRequest.count({ where: { ...metricsWhere, status: 'PENDING_APPROVAL' } }),
        prisma.exitRequest.count({ where: { ...metricsWhere, status: 'NOTICE_PERIOD' } }),
        prisma.exitRequest.count({
          where: {
            ...metricsWhere,
            status: { in: ['NOTICE_PERIOD', 'NOTICE_COMPLETED'] },
            assetClearanceCompleted: false
          }
        }),
        prisma.exitRequest.count({ where: { ...metricsWhere, status: 'EXIT_COMPLETED' } })
      ]);

    // Fetch exit requests
    const rawRequests = await prisma.exitRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            joiningDate: true,
            employeeStatus: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } },
            branch: { select: { id: true, name: true, city: true } }
          }
        },
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
            companyName: true,
            address: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Map requests with calculated notice period and dynamic status
    const requests = rawRequests.map((req) => {
      const remainingDays = this.calculateRemainingDays(req.lastWorkingDay);
      let calculatedStatus = req.status;

      // Notice period completion check
      if (req.status === 'NOTICE_PERIOD' && todayStr >= req.lastWorkingDay) {
        calculatedStatus = 'NOTICE_COMPLETED';
      }

      return {
        ...req,
        effectiveStatus: calculatedStatus,
        remainingNoticeDays: remainingDays
      };
    });

    return {
      metrics: {
        totalRequests,
        pendingApprovals,
        servingNotice,
        pendingAssetClearance,
        exitsCompleted
      },
      requests
    };
  }

  /**
   * 2. Submit Resignation Request
   */
  async submitResignation(
    data: {
      employeeId?: string;
      resignationDate?: string;
      reason: string;
      proposedLastWorkingDay?: string;
      employeeRemarks?: string;
    },
    user: any
  ) {
    const targetEmployeeId = data.employeeId;

    if (!targetEmployeeId) {
      throw new Error('Employee ID is required.');
    }

    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      include: { brand: true }
    });

    if (!employee) {
      throw new Error('Employee not found.');
    }

    // Check brand access if non-admin/HR
    if (user.role === Role.HR && user.brandId && user.brandId !== employee.brandId) {
      throw new Error('Access denied to submit resignation for this employee.');
    }

    // Check if an active exit request already exists
    const activeExit = await prisma.exitRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING_APPROVAL', 'NOTICE_PERIOD', 'NOTICE_COMPLETED'] }
      }
    });

    if (activeExit) {
      throw new Error('An active exit request is already in progress for this employee.');
    }

    const resignationDate = data.resignationDate || new Date().toISOString().split('T')[0];
    const noticePeriodDays = await this.getCompanyNoticePeriodDays();
    const calculatedLwd = this.addDaysToDateString(resignationDate, noticePeriodDays);
    const proposedLwd = data.proposedLastWorkingDay || calculatedLwd;

    const exitRequest = await prisma.exitRequest.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        brandId: employee.brandId,
        resignationDate,
        reason: data.reason.trim(),
        proposedLastWorkingDay: proposedLwd,
        noticePeriodDays,
        lastWorkingDay: proposedLwd, // Initially proposed, HR can confirm or adjust
        employeeRemarks: data.employeeRemarks?.trim() || null,
        status: 'PENDING_APPROVAL'
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        },
        brand: true
      }
    });

    // Notify authorized HR users about resignation submission
    try {
      const hrUserIds = await notificationService.getHrUserIdsForBrand(employee.brandId);
      await notificationService.notifyUsers(hrUserIds, {
        title: 'New Resignation Submitted',
        message: `${employee.firstName} ${employee.lastName} (${employee.employeeId}) has submitted a resignation request.`,
        type: 'EXIT',
        module: 'exit',
        recordId: exitRequest.id,
        actionUrl: '/exit',
        eventKeyPrefix: `exit-submit-${exitRequest.id}`
      });
    } catch (err: any) {
      console.error('[ExitService] Notification error on submitResignation:', err.message);
    }

    return exitRequest;
  }

  /**
   * 3. Approve Resignation
   */
  async approveResignation(
    id: string,
    data: { hrRemarks?: string; confirmedLastWorkingDay?: string },
    user: any
  ) {

    const exitRequest = await prisma.exitRequest.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    if (exitRequest.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve exit request with status '${exitRequest.status}'.`);
    }

    const finalLwd = data.confirmedLastWorkingDay || exitRequest.lastWorkingDay;
    const todayStr = new Date().toISOString().split('T')[0];
    const nextStatus = todayStr >= finalLwd ? 'NOTICE_COMPLETED' : 'NOTICE_PERIOD';

    const updated = await prisma.exitRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        lastWorkingDay: finalLwd,
        hrRemarks: data.hrRemarks?.trim() || exitRequest.hrRemarks,
        approvedAt: new Date(),
        approvedById: user.id
      },
      include: {
        employee: true,
        brand: true
      }
    });

    // Notify employee about resignation approval
    try {
      const empUserId = await notificationService.getUserIdByEmployeeId(exitRequest.employeeId);
      if (empUserId) {
        await notificationService.createNotification({
          userId: empUserId,
          title: 'Resignation Approved',
          message: `Your resignation has been approved. Notice period confirmed until ${finalLwd}.`,
          type: 'EXIT',
          module: 'exit',
          recordId: updated.id,
          actionUrl: '/exit',
          eventKey: `exit-approve-${updated.id}`
        });
      }
    } catch (err: any) {
      console.error('[ExitService] Notification error on approveResignation:', err.message);
    }

    return updated;
  }

  /**
   * 4. Reject Resignation
   */
  async rejectResignation(id: string, remarks: string, user: any) {
    if (!remarks || !remarks.trim()) {
      throw new Error('Rejection remarks are required.');
    }

    const exitRequest = await prisma.exitRequest.findUnique({ where: { id } });
    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    if (exitRequest.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject exit request with status '${exitRequest.status}'.`);
    }

    const updated = await prisma.exitRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        hrRemarks: remarks.trim(),
        rejectedAt: new Date(),
        rejectedById: user.id
      }
    });

    // Notify employee about resignation rejection
    try {
      const empUserId = await notificationService.getUserIdByEmployeeId(exitRequest.employeeId);
      if (empUserId) {
        await notificationService.createNotification({
          userId: empUserId,
          title: 'Resignation Request Rejected',
          message: `Your resignation request was reviewed and rejected. Remarks: ${remarks}`,
          type: 'EXIT',
          module: 'exit',
          recordId: updated.id,
          actionUrl: '/exit',
          eventKey: `exit-reject-${updated.id}`
        });
      }
    } catch (err: any) {
      console.error('[ExitService] Notification error on rejectResignation:', err.message);
    }

    return updated;
  }

  /**
   * 5. Update Last Working Day
   */
  async updateLastWorkingDay(
    id: string,
    data: { lastWorkingDay: string; hrRemarks?: string },
    user: any
  ) {
    if (!data.lastWorkingDay) {
      throw new Error('Last working day is required.');
    }

    const exitRequest = await prisma.exitRequest.findUnique({ where: { id } });
    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    if (['REJECTED', 'WITHDRAWN', 'EXIT_COMPLETED'].includes(exitRequest.status)) {
      throw new Error(`Cannot update last working day for exit request in status '${exitRequest.status}'.`);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let nextStatus = exitRequest.status;
    if (exitRequest.status === 'NOTICE_PERIOD' || exitRequest.status === 'NOTICE_COMPLETED') {
      nextStatus = todayStr >= data.lastWorkingDay ? 'NOTICE_COMPLETED' : 'NOTICE_PERIOD';
    }

    const updated = await prisma.exitRequest.update({
      where: { id },
      data: {
        lastWorkingDay: data.lastWorkingDay,
        status: nextStatus,
        hrRemarks: data.hrRemarks?.trim() || exitRequest.hrRemarks
      },
      include: {
        employee: true,
        brand: true
      }
    });

    // Notify employee about Last Working Day update
    try {
      const empUserId = await notificationService.getUserIdByEmployeeId(exitRequest.employeeId);
      if (empUserId) {
        await notificationService.createNotification({
          userId: empUserId,
          title: 'Last Working Day Adjusted',
          message: `Your official last working day has been updated to ${data.lastWorkingDay}.`,
          type: 'EXIT',
          module: 'exit',
          recordId: updated.id,
          actionUrl: '/exit',
          eventKey: `exit-lwd-${updated.id}-${data.lastWorkingDay}`
        });
      }
    } catch (err: any) {
      console.error('[ExitService] Notification error on updateLastWorkingDay:', err.message);
    }

    return updated;
  }

  /**
   * 6. Withdraw Resignation
   */
  async withdrawResignation(id: string, reason: string, user: any) {
    if (!reason || !reason.trim()) {
      throw new Error('Withdrawal reason is required.');
    }

    const exitRequest = await prisma.exitRequest.findUnique({ where: { id } });
    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    if (['REJECTED', 'WITHDRAWN', 'EXIT_COMPLETED'].includes(exitRequest.status)) {
      throw new Error(`Exit request cannot be withdrawn from status '${exitRequest.status}'.`);
    }

    const updated = await prisma.exitRequest.update({
      where: { id },
      data: {
        status: 'WITHDRAWN',
        withdrawnReason: reason.trim(),
        withdrawnAt: new Date(),
        withdrawnById: user.id
      }
    });

    return updated;
  }

  /**
   * 7. Exit Checklist: Update Handover & Clearances
   */
  async updateChecklist(
    id: string,
    data: {
      handoverCompleted?: boolean;
      tasksHandedOver?: boolean;
      docsHandedOver?: boolean;
      hrClearanceCompleted?: boolean;
      checklistNotes?: string;
    },
    user: any
  ) {
    const exitRequest = await prisma.exitRequest.findUnique({ where: { id } });
    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    const nextHandover =
      data.handoverCompleted !== undefined ? data.handoverCompleted : exitRequest.handoverCompleted;
    const nextTasks =
      data.tasksHandedOver !== undefined ? data.tasksHandedOver : exitRequest.tasksHandedOver;
    const nextDocs =
      data.docsHandedOver !== undefined ? data.docsHandedOver : exitRequest.docsHandedOver;
    const nextHr =
      data.hrClearanceCompleted !== undefined ? data.hrClearanceCompleted : exitRequest.hrClearanceCompleted;

    const allChecked = nextHandover && nextTasks && nextDocs && nextHr;

    const updated = await prisma.exitRequest.update({
      where: { id },
      data: {
        handoverCompleted: nextHandover,
        tasksHandedOver: nextTasks,
        docsHandedOver: nextDocs,
        hrClearanceCompleted: nextHr,
        checklistNotes: data.checklistNotes !== undefined ? data.checklistNotes?.trim() : exitRequest.checklistNotes,
        checklistCompletedAt: allChecked ? new Date() : null,
        checklistCompletedById: allChecked ? user.id : null
      }
    });

    return updated;
  }

  /**
   * 8. Asset Clearance: Fetch Employee's Assigned Assets
   */
  async getEmployeeAssets(exitRequestId: string) {
    const exitRequest = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: { employee: true }
    });

    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    // Direct integration with existing Asset model
    const assignedAssets = await prisma.asset.findMany({
      where: { assignedEmployeeId: exitRequest.employeeId },
      orderBy: { createdAt: 'desc' }
    });

    // Also get returned history for this employee
    const assetHistory = await prisma.assetAssignmentHistory.findMany({
      where: { employeeId: exitRequest.employeeId },
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return {
      assignedAssets,
      assetHistory,
      assetClearanceCompleted: exitRequest.assetClearanceCompleted,
      assetClearanceNotes: exitRequest.assetClearanceNotes,
      assetClearedAt: exitRequest.assetClearedAt
    };
  }

  /**
   * 9. Asset Clearance: Clear an assigned asset (Returned or Damaged)
   */
  async clearAsset(
    exitRequestId: string,
    assetId: string,
    action: 'RETURNED' | 'DAMAGED',
    notes: string | undefined,
    user: any
  ) {
    const exitRequest = await prisma.exitRequest.findUnique({ where: { id: exitRequestId } });
    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new Error('Asset not found.');
    }

    if (asset.assignedEmployeeId !== exitRequest.employeeId) {
      throw new Error('Asset is not currently assigned to this exiting employee.');
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Create return history in existing table
    await prisma.assetAssignmentHistory.create({
      data: {
        assetId: asset.id,
        employeeId: exitRequest.employeeId,
        assignedDate: asset.assignedDate || exitRequest.resignationDate,
        returnedDate: todayStr,
        assignedById: user.id,
        returnNotes: notes?.trim() || `Cleared during Exit Management (${action})`,
        conditionOnReturn: action === 'DAMAGED' ? 'DAMAGED' : 'GOOD'
      }
    });

    // 2. Update existing asset record
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: action === 'DAMAGED' ? 'DAMAGED' : 'AVAILABLE',
        assignedEmployeeId: null,
        assignedDate: null,
        notes: notes?.trim() ? `[Exit Return] ${notes.trim()}` : asset.notes
      }
    });

    // 3. Check remaining assigned assets
    const remainingCount = await prisma.asset.count({
      where: { assignedEmployeeId: exitRequest.employeeId }
    });

    let autoCleared = false;
    if (remainingCount === 0) {
      autoCleared = true;
      await prisma.exitRequest.update({
        where: { id: exitRequestId },
        data: {
          assetClearanceCompleted: true,
          assetClearedAt: new Date(),
          assetClearedById: user.id,
          assetClearanceNotes: 'All assigned company assets have been successfully returned/inspected.'
        }
      });
    }

    return {
      success: true,
      assetId,
      status: action,
      remainingCount,
      autoCleared
    };
  }

  /**
   * 10. Manual Asset Clearance Toggle (e.g. employee had no physical assets assigned)
   */
  async toggleManualAssetClearance(
    exitRequestId: string,
    completed: boolean,
    notes: string | undefined,
    user: any
  ) {
    const exitRequest = await prisma.exitRequest.findUnique({ where: { id: exitRequestId } });
    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    const updated = await prisma.exitRequest.update({
      where: { id: exitRequestId },
      data: {
        assetClearanceCompleted: completed,
        assetClearedAt: completed ? new Date() : null,
        assetClearedById: completed ? user.id : null,
        assetClearanceNotes: notes?.trim() || (completed ? 'Asset clearance completed manually.' : null)
      }
    });

    return updated;
  }

  /**
   * 11. Relieving Letter Preview
   */
  async previewRelievingLetter(exitRequestId: string) {
    const exitRequest = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            branch: true
          }
        },
        brand: true
      }
    });

    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const refNumber = `REL/${new Date().getFullYear()}/${exitRequest.employee.employeeId}`;

    return {
      referenceNumber: refNumber,
      issueDate: todayStr,
      companyName: exitRequest.brand.companyName || exitRequest.brand.name,
      brandName: exitRequest.brand.name,
      brandAddress: exitRequest.brand.address,
      brandPhone: exitRequest.brand.phone,
      brandEmail: exitRequest.brand.email,
      employeeName: `${exitRequest.employee.firstName} ${exitRequest.employee.lastName}`,
      employeeId: exitRequest.employee.employeeId,
      department: exitRequest.employee.department?.name || 'General',
      designation: exitRequest.employee.designation?.title || 'Employee',
      branch: exitRequest.employee.branch?.name || 'Main Office',
      joiningDate: exitRequest.employee.joiningDate,
      lastWorkingDay: exitRequest.lastWorkingDay,
      hrRemarks: exitRequest.hrRemarks,
      relievingLetterIssued: exitRequest.relievingLetterIssued,
      relievingLetterDocId: exitRequest.relievingLetterDocId,
      relievingLetterIssuedAt: exitRequest.relievingLetterIssuedAt
    };
  }

  /**
   * 12. Issue Relieving Letter & Store in Employee Documents
   */
  async issueRelievingLetter(exitRequestId: string, user: any) {
    const preview = await this.previewRelievingLetter(exitRequestId);

    // Generate formal PDF buffer
    const pdfBuffer = await relievingLetterPdfService.generateRelievingLetterPdf({
      referenceNumber: preview.referenceNumber,
      issueDate: preview.issueDate,
      companyName: preview.companyName,
      brandName: preview.brandName,
      brandAddress: preview.brandAddress,
      brandPhone: preview.brandPhone,
      brandEmail: preview.brandEmail,
      employeeName: preview.employeeName,
      employeeId: preview.employeeId,
      department: preview.department,
      designation: preview.designation,
      branch: preview.branch,
      joiningDate: preview.joiningDate,
      lastWorkingDay: preview.lastWorkingDay,
      hrRemarks: preview.hrRemarks
    });

    const base64Data = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    const fileName = `Relieving_Letter_${preview.employeeId}.pdf`;

    const exitRequest = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: { employee: true }
    });

    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    // Check if an existing document was already created for this exit request
    let doc;
    if (exitRequest.relievingLetterDocId) {
      const existingDoc = await prisma.employeeDocument.findUnique({
        where: { id: exitRequest.relievingLetterDocId }
      });
      if (existingDoc) {
        doc = await prisma.employeeDocument.update({
          where: { id: existingDoc.id },
          data: {
            fileUrl: base64Data,
            fileName,
            fileSize: pdfBuffer.length,
            issueDate: preview.issueDate,
            remarks: `Issued by HR on ${preview.issueDate}`,
            uploadedById: user.id
          }
        });
      }
    }

    if (!doc) {
      doc = await prisma.employeeDocument.create({
        data: {
          employeeId: exitRequest.employeeId,
          brandId: exitRequest.brandId,
          title: `Relieving Letter - ${preview.employeeName}`,
          documentType: 'RELIEVING_LETTER',
          category: 'CERTIFICATE',
          fileName,
          fileType: 'application/pdf',
          fileSize: pdfBuffer.length,
          fileUrl: base64Data,
          issueDate: preview.issueDate,
          remarks: `Official relieving letter issued through Exit Management`,
          uploadedById: user.id
        }
      });
    }

    // Update ExitRequest with document reference
    const updatedExit = await prisma.exitRequest.update({
      where: { id: exitRequestId },
      data: {
        relievingLetterIssued: true,
        relievingLetterDocId: doc.id,
        relievingLetterIssuedAt: new Date()
      }
    });

    // Notify employee about Relieving Letter issuance
    try {
      const empUserId = await notificationService.getUserIdByEmployeeId(exitRequest.employeeId);
      if (empUserId) {
        await notificationService.createNotification({
          userId: empUserId,
          title: 'Relieving Letter Issued',
          message: 'Your official Relieving and Service Certificate has been issued and is available for download.',
          type: 'EXIT',
          module: 'exit',
          recordId: updatedExit.id,
          actionUrl: '/exit',
          eventKey: `exit-relieving-${updatedExit.id}`
        });
      }
    } catch (err: any) {
      console.error('[ExitService] Notification error on issueRelievingLetter:', err.message);
    }

    return {
      exitRequest: updatedExit,
      document: doc,
      pdfBase64: base64Data
    };
  }

  /**
   * 13. Download Relieving Letter PDF Buffer directly
   */
  async getRelievingLetterPdfBuffer(exitRequestId: string): Promise<Buffer> {
    const preview = await this.previewRelievingLetter(exitRequestId);
    return relievingLetterPdfService.generateRelievingLetterPdf({
      referenceNumber: preview.referenceNumber,
      issueDate: preview.issueDate,
      companyName: preview.companyName,
      brandName: preview.brandName,
      brandAddress: preview.brandAddress,
      brandPhone: preview.brandPhone,
      brandEmail: preview.brandEmail,
      employeeName: preview.employeeName,
      employeeId: preview.employeeId,
      department: preview.department,
      designation: preview.designation,
      branch: preview.branch,
      joiningDate: preview.joiningDate,
      lastWorkingDay: preview.lastWorkingDay,
      hrRemarks: preview.hrRemarks
    });
  }

  /**
   * 14. Complete Exit
   */
  async completeExit(exitRequestId: string, user: any) {
    const exitRequest = await prisma.exitRequest.findUnique({
      where: { id: exitRequestId },
      include: { employee: true }
    });

    if (!exitRequest) {
      throw new Error('Exit request not found.');
    }

    if (['REJECTED', 'WITHDRAWN', 'EXIT_COMPLETED'].includes(exitRequest.status)) {
      throw new Error(`Cannot complete an exit request currently in '${exitRequest.status}'.`);
    }

    // Check Exit Checklist
    const checklistDone =
      exitRequest.handoverCompleted &&
      exitRequest.tasksHandedOver &&
      exitRequest.docsHandedOver &&
      exitRequest.hrClearanceCompleted;

    if (!checklistDone) {
      throw new Error('Exit checklist is incomplete. Please ensure all 4 checklist items are signed off.');
    }

    // Check Asset Clearance
    if (!exitRequest.assetClearanceCompleted) {
      throw new Error('Asset clearance is pending. All company assets must be returned or cleared.');
    }

    // 1. Mark ExitRequest as completed
    const updatedExit = await prisma.exitRequest.update({
      where: { id: exitRequestId },
      data: {
        status: 'EXIT_COMPLETED',
        completedAt: new Date(),
        completedById: user.id
      }
    });

    // 2. Update Employee status and exitDate
    await prisma.employee.update({
      where: { id: exitRequest.employeeId },
      data: {
        employeeStatus: 'INACTIVE',
        exitDate: exitRequest.lastWorkingDay
      }
    });

    // Notify employee & HR of completion
    try {
      const empUserId = await notificationService.getUserIdByEmployeeId(exitRequest.employeeId);
      if (empUserId) {
        await notificationService.createNotification({
          userId: empUserId,
          title: 'Exit Formalities Completed',
          message: 'Your exit formalities and clearances have been completed. Thank you for your service.',
          type: 'EXIT',
          module: 'exit',
          recordId: updatedExit.id,
          actionUrl: '/exit',
          eventKey: `exit-complete-${updatedExit.id}`
        });
      }
    } catch (err: any) {
      console.error('[ExitService] Notification error on completeExit:', err.message);
    }

    return updatedExit;
  }
}

export const exitService = new ExitService();
