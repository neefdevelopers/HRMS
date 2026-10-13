import { prisma } from '../config/prisma.js';

export interface AssetInput {
  brandId: string;
  name: string;
  type: string; // LAPTOP, MOBILE, TABLET, MONITOR, OTHER
  assetTag: string;
  serialNumber?: string;
  brandModel?: string;
  purchaseDate?: string;
  status?: string; // AVAILABLE, ASSIGNED, DAMAGED
  notes?: string;
}

export interface DocumentInput {
  brandId: string;
  employeeId: string;
  title: string;
  documentType: string; // CONTRACT, CERTIFICATE, OFFER_LETTER, APPOINTMENT_LETTER, EXPERIENCE_LETTER, RELIEVING_LETTER, OTHER
  category?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  fileUrl: string;
  issueDate?: string;
  expiryDate?: string;
  remarks?: string;
  description?: string;
  uploadedById?: string;
}

export class AssetDocumentService {
  /**
   * ==========================================
   * 1. ASSET MANAGEMENT
   * ==========================================
   */
  async getAssets(params: {
    brandId?: string;
    type?: string;
    status?: string;
    employeeId?: string;
    search?: string;
  }) {
    const { brandId, type, status, employeeId, search } = params;
    const where: any = {};

    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (type && type !== 'ALL') where.type = type;
    if (status && status !== 'ALL') where.status = status;
    if (employeeId) where.assignedEmployeeId = employeeId;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { assetTag: { contains: search } },
        { serialNumber: { contains: search } },
        { brandModel: { contains: search } },
        {
          assignedEmployee: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { employeeId: { contains: search } }
            ]
          }
        }
      ];
    }

    return prisma.asset.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, code: true } },
        assignedEmployee: {
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
        assignmentHistory: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAssetById(id: string) {
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        brand: true,
        assignedEmployee: {
          include: { department: true, designation: true }
        },
        assignmentHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } }
          }
        }
      }
    });
    if (!asset) throw new Error('Asset not found');
    return asset;
  }

  async createAsset(data: AssetInput) {
    const existing = await prisma.asset.findUnique({
      where: { assetTag: data.assetTag.trim().toUpperCase() }
    });
    if (existing) {
      throw new Error(`Asset ID / Tag "${data.assetTag}" already exists.`);
    }

    return prisma.asset.create({
      data: {
        brandId: data.brandId,
        name: data.name.trim(),
        type: data.type || 'LAPTOP',
        assetTag: data.assetTag.trim().toUpperCase(),
        serialNumber: data.serialNumber?.trim() || null,
        brandModel: data.brandModel?.trim() || null,
        purchaseDate: data.purchaseDate || null,
        status: data.status || 'AVAILABLE',
        notes: data.notes?.trim() || null
      },
      include: { brand: true }
    });
  }

  async updateAsset(id: string, data: Partial<AssetInput>) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) throw new Error('Asset not found');

    if (data.assetTag && data.assetTag.trim().toUpperCase() !== existing.assetTag) {
      const duplicate = await prisma.asset.findUnique({
        where: { assetTag: data.assetTag.trim().toUpperCase() }
      });
      if (duplicate) throw new Error(`Asset ID / Tag "${data.assetTag}" already exists.`);
    }

    return prisma.asset.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.assetTag ? { assetTag: data.assetTag.trim().toUpperCase() } : {}),
        ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber?.trim() || null } : {}),
        ...(data.brandModel !== undefined ? { brandModel: data.brandModel?.trim() || null } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate || null } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {})
      },
      include: {
        brand: true,
        assignedEmployee: { select: { id: true, employeeId: true, firstName: true, lastName: true } }
      }
    });
  }

  async deleteAsset(id: string) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    if (asset.status === 'ASSIGNED' || asset.assignedEmployeeId) {
      throw new Error('Cannot delete an asset that is currently assigned to an employee. Return the asset first.');
    }

    await prisma.asset.delete({ where: { id } });
    return { success: true };
  }

  async assignAsset(id: string, data: { employeeId: string; assignedDate?: string; assignedById?: string; notes?: string }) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new Error('Employee not found');

    // If already assigned to someone, close previous assignment
    if (asset.assignedEmployeeId) {
      await prisma.assetAssignmentHistory.updateMany({
        where: { assetId: id, returnedDate: null },
        data: { returnedDate: new Date().toISOString().slice(0, 10), conditionOnReturn: 'REASSIGNED' }
      });
    }

    const assignedDate = data.assignedDate || new Date().toISOString().slice(0, 10);

    // 1. Create assignment history record
    await prisma.assetAssignmentHistory.create({
      data: {
        assetId: id,
        employeeId: data.employeeId,
        assignedDate,
        assignedById: data.assignedById || null,
        returnNotes: data.notes || null
      }
    });

    // 2. Update asset status
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        assignedEmployeeId: data.employeeId,
        assignedDate,
        ...(data.notes ? { notes: data.notes } : {})
      },
      include: {
        brand: true,
        assignedEmployee: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, department: { select: { name: true } } }
        }
      }
    });

    return updated;
  }

  async returnAsset(id: string, data: { returnedDate?: string; returnNotes?: string; conditionOnReturn?: string }) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    if (asset.status !== 'ASSIGNED' && !asset.assignedEmployeeId) {
      throw new Error('Asset is not currently assigned to any employee.');
    }

    const returnedDate = data.returnedDate || new Date().toISOString().slice(0, 10);
    const condition = data.conditionOnReturn || 'GOOD';
    const newStatus = condition === 'DAMAGED' ? 'DAMAGED' : 'AVAILABLE';

    // 1. Update the active history record
    await prisma.assetAssignmentHistory.updateMany({
      where: { assetId: id, returnedDate: null },
      data: {
        returnedDate,
        returnNotes: data.returnNotes || null,
        conditionOnReturn: condition
      }
    });

    // 2. Mark asset as available (or damaged if damaged)
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        status: newStatus,
        assignedEmployeeId: null,
        assignedDate: null,
        ...(data.returnNotes ? { notes: data.returnNotes } : {})
      },
      include: { brand: true }
    });

    return updated;
  }

  /**
   * ==========================================
   * 2. EMPLOYEE DOCUMENTS
   * ==========================================
   */
  async getDocuments(params: {
    brandId?: string;
    employeeId?: string;
    documentType?: string;
    search?: string;
    includeArchived?: boolean;
  }) {
    const { brandId, employeeId, documentType, search, includeArchived } = params;
    const where: any = {};

    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (employeeId) where.employeeId = employeeId;
    if (documentType && documentType !== 'ALL') where.documentType = documentType;
    if (!includeArchived) where.isArchived = false;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { fileName: { contains: search } },
        { remarks: { contains: search } },
        {
          employee: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { employeeId: { contains: search } }
            ]
          }
        }
      ];
    }

    return prisma.employeeDocument.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDocument(data: DocumentInput) {
    return prisma.employeeDocument.create({
      data: {
        brandId: data.brandId,
        employeeId: data.employeeId,
        title: data.title.trim(),
        documentType: data.documentType || 'OTHER',
        category: data.category || 'GENERAL',
        fileName: data.fileName.trim(),
        fileType: data.fileType || null,
        fileSize: data.fileSize !== undefined ? Number(data.fileSize) : null,
        fileUrl: data.fileUrl,
        issueDate: data.issueDate || null,
        expiryDate: data.expiryDate || null,
        remarks: data.remarks?.trim() || null,
        description: data.description?.trim() || null,
        uploadedById: data.uploadedById || null
      },
      include: {
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } },
        brand: true
      }
    });
  }

  async updateDocument(id: string, data: Partial<DocumentInput>) {
    const existing = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');

    return prisma.employeeDocument.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title.trim() } : {}),
        ...(data.documentType ? { documentType: data.documentType } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(data.issueDate !== undefined ? { issueDate: data.issueDate || null } : {}),
        ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate || null } : {}),
        ...(data.remarks !== undefined ? { remarks: data.remarks?.trim() || null } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {})
      },
      include: {
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } }
      }
    });
  }

  async replaceDocument(id: string, newFileData: {
    fileName: string;
    fileType?: string;
    fileSize?: number;
    fileUrl: string;
    title?: string;
    issueDate?: string;
    expiryDate?: string;
    remarks?: string;
    uploadedById?: string;
  }) {
    const existing = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');

    // 1. Mark existing document as archived to preserve history
    await prisma.employeeDocument.update({
      where: { id },
      data: { isArchived: true }
    });

    // 2. Create the new replaced document version
    const newDoc = await prisma.employeeDocument.create({
      data: {
        brandId: existing.brandId,
        employeeId: existing.employeeId,
        title: newFileData.title ? newFileData.title.trim() : existing.title,
        documentType: existing.documentType,
        category: existing.category,
        fileName: newFileData.fileName.trim(),
        fileType: newFileData.fileType || existing.fileType,
        fileSize: newFileData.fileSize !== undefined ? Number(newFileData.fileSize) : existing.fileSize,
        fileUrl: newFileData.fileUrl,
        issueDate: newFileData.issueDate !== undefined ? newFileData.issueDate : existing.issueDate,
        expiryDate: newFileData.expiryDate !== undefined ? newFileData.expiryDate : existing.expiryDate,
        remarks: newFileData.remarks !== undefined ? newFileData.remarks : existing.remarks,
        replacedById: existing.id,
        uploadedById: newFileData.uploadedById || null
      },
      include: {
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } }
      }
    });

    return newDoc;
  }

  async deleteDocument(id: string) {
    const existing = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');

    await prisma.employeeDocument.delete({ where: { id } });
    return { success: true };
  }

  /**
   * ==========================================
   * 3. DOCUMENT EXPIRY REMINDERS
   * ==========================================
   */
  async getExpirySummary(params: { brandId?: string }) {
    const { brandId } = params;
    const whereBrand: any = {
      isArchived: false,
      expiryDate: { not: null }
    };
    if (brandId && brandId !== 'all') whereBrand.brandId = brandId;

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr + 'T00:00:00Z');

    // Date thresholds: 7 days and 30 days
    const next7DaysStr = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const next30DaysStr = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const documentsWithExpiry = await prisma.employeeDocument.findMany({
      where: whereBrand,
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
        brand: { select: { id: true, name: true, code: true } }
      },
      orderBy: { expiryDate: 'asc' }
    });

    const expired: any[] = [];
    const expiringSoon7: any[] = [];
    const expiringSoon30: any[] = [];
    const activeValid: any[] = [];

    for (const doc of documentsWithExpiry) {
      if (!doc.expiryDate) continue;

      const expDate = doc.expiryDate;
      const daysUntilExpiry = Math.ceil(
        (new Date(expDate + 'T00:00:00Z').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const enhancedDoc = {
        ...doc,
        daysUntilExpiry,
        isExpired: daysUntilExpiry < 0,
        isExpiringSoon7: daysUntilExpiry >= 0 && daysUntilExpiry <= 7,
        isExpiringSoon30: daysUntilExpiry > 7 && daysUntilExpiry <= 30
      };

      if (daysUntilExpiry < 0) {
        expired.push(enhancedDoc);
      } else if (daysUntilExpiry <= 7) {
        expiringSoon7.push(enhancedDoc);
      } else if (daysUntilExpiry <= 30) {
        expiringSoon30.push(enhancedDoc);
      } else {
        activeValid.push(enhancedDoc);
      }
    }

    return {
      today: todayStr,
      counts: {
        totalTracked: documentsWithExpiry.length,
        expired: expired.length,
        expiringSoon7: expiringSoon7.length,
        expiringSoon30: expiringSoon30.length,
        activeValid: activeValid.length
      },
      expired,
      expiringSoon7,
      expiringSoon30,
      activeValid
    };
  }

  async triggerExpiryReminders(params: { brandId?: string }) {
    const summary = await this.getExpirySummary(params);
    const triggeredReminders: any[] = [];

    // 1. Process 7-day reminders (for docs <= 7 days where reminder7Sent is false)
    for (const doc of summary.expiringSoon7) {
      if (!doc.reminder7Sent) {
        await prisma.employeeDocument.update({
          where: { id: doc.id },
          data: { reminder7Sent: true, reminder30Sent: true }
        });
        triggeredReminders.push({
          documentId: doc.id,
          employee: `${doc.employee?.firstName} ${doc.employee?.lastName}`,
          documentTitle: doc.title,
          expiryDate: doc.expiryDate,
          daysLeft: doc.daysUntilExpiry,
          reminderType: '7_DAYS_URGENT'
        });
      }
    }

    // 2. Process 30-day reminders (for docs <= 30 days where reminder30Sent is false)
    for (const doc of summary.expiringSoon30) {
      if (!doc.reminder30Sent) {
        await prisma.employeeDocument.update({
          where: { id: doc.id },
          data: { reminder30Sent: true }
        });
        triggeredReminders.push({
          documentId: doc.id,
          employee: `${doc.employee?.firstName} ${doc.employee?.lastName}`,
          documentTitle: doc.title,
          expiryDate: doc.expiryDate,
          daysLeft: doc.daysUntilExpiry,
          reminderType: '30_DAYS_UPCOMING'
        });
      }
    }

    return {
      remindersSent: triggeredReminders.length,
      details: triggeredReminders
    };
  }
}

export const assetDocumentService = new AssetDocumentService();
