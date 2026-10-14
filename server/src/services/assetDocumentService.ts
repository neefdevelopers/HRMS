import { prisma } from '../config/prisma.js';

export interface AssetInput {
  companyId?: string;
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
  companyId?: string;
  brandId: string;
  employeeId: string;
  title: string;
  documentType: string;
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
    companyId?: string;
    brandId?: string;
    type?: string;
    status?: string;
    employeeId?: string;
    search?: string;
  }) {
    const { companyId, brandId, type, status, employeeId, search } = params;
    const where: any = {};

    if (companyId) where.companyId = companyId;
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

  async getAssetById(id: string, companyId?: string | null) {
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
    if (companyId && asset.companyId && asset.companyId !== companyId) {
      throw new Error('Access denied. Asset belongs to another company.');
    }
    return asset;
  }

  async createAsset(data: AssetInput) {
    const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
    if (!brand) throw new Error('Brand not found');

    const companyId = data.companyId || brand.companyId;

    const existing = await prisma.asset.findFirst({
      where: {
        companyId,
        assetTag: data.assetTag.trim().toUpperCase()
      }
    });
    if (existing) {
      throw new Error(`Asset ID / Tag "${data.assetTag}" already exists in this company.`);
    }

    return prisma.asset.create({
      data: {
        companyId,
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

  async updateAsset(id: string, data: Partial<AssetInput>, companyId?: string | null) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) throw new Error('Asset not found');

    if (companyId && existing.companyId && existing.companyId !== companyId) {
      throw new Error('Access denied. Asset belongs to another company.');
    }

    if (data.assetTag && data.assetTag.trim().toUpperCase() !== existing.assetTag) {
      const duplicate = await prisma.asset.findFirst({
        where: {
          companyId: existing.companyId,
          assetTag: data.assetTag.trim().toUpperCase()
        }
      });
      if (duplicate) throw new Error(`Asset ID / Tag "${data.assetTag}" already exists in this company.`);
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

  async deleteAsset(id: string, companyId?: string | null) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    if (companyId && asset.companyId && asset.companyId !== companyId) {
      throw new Error('Access denied. Asset belongs to another company.');
    }

    if (asset.status === 'ASSIGNED' || asset.assignedEmployeeId) {
      throw new Error('Cannot delete an asset that is currently assigned to an employee. Return the asset first.');
    }

    await prisma.asset.delete({ where: { id } });
    return { success: true };
  }

  async assignAsset(id: string, data: { employeeId: string; assignedDate?: string; assignedById?: string; notes?: string }, companyId?: string | null) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    if (companyId && asset.companyId && asset.companyId !== companyId) {
      throw new Error('Access denied. Asset belongs to another company.');
    }

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new Error('Employee not found');

    // Strict cross-company assignment prevention
    if (asset.companyId && employee.companyId && asset.companyId !== employee.companyId) {
      throw new Error('Cross-company asset assignment is not allowed.');
    }

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

  async returnAsset(id: string, data: { returnedDate?: string; returnNotes?: string; conditionOnReturn?: string }, companyId?: string | null) {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    if (companyId && asset.companyId && asset.companyId !== companyId) {
      throw new Error('Access denied. Asset belongs to another company.');
    }

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

    // 2. Clear assigned status on asset
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        status: newStatus,
        assignedEmployeeId: null,
        assignedDate: null
      },
      include: {
        brand: true
      }
    });

    return updated;
  }

  /**
   * ==========================================
   * 2. COMPANY DOCUMENTS MANAGEMENT
   * ==========================================
   */
  async getDocuments(params: {
    companyId?: string;
    brandId?: string;
    employeeId?: string;
    category?: string;
    documentType?: string;
    search?: string;
    includeArchived?: boolean;
  }) {
    const { companyId, brandId, employeeId, category, documentType, search, includeArchived } = params;
    const where: any = {};

    if (companyId) where.companyId = companyId;
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (employeeId) where.employeeId = employeeId;
    if (category && category !== 'ALL') where.category = category;
    if (documentType && documentType !== 'ALL') where.documentType = documentType;
    if (!includeArchived) where.isArchived = false;

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { fileName: { contains: search } },
        { description: { contains: search } },
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
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getDocumentById(id: string, companyId?: string | null) {
    const doc = await prisma.employeeDocument.findUnique({
      where: { id },
      include: {
        brand: true,
        employee: {
          include: { department: true, designation: true }
        }
      }
    });
    if (!doc) throw new Error('Document not found');
    if (companyId && doc.companyId && doc.companyId !== companyId) {
      throw new Error('Access denied. Document belongs to another company.');
    }
    return doc;
  }

  async createDocument(data: DocumentInput) {
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new Error('Employee not found');

    const companyId = data.companyId || employee.companyId;

    return prisma.employeeDocument.create({
      data: {
        companyId,
        brandId: data.brandId || employee.brandId,
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
        brand: true,
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } }
      }
    });
  }

  async updateDocument(id: string, data: Partial<DocumentInput>, companyId?: string | null) {
    const existing = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');

    if (companyId && existing.companyId && existing.companyId !== companyId) {
      throw new Error('Access denied. Document belongs to another company.');
    }

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

  async deleteDocument(id: string, companyId?: string | null) {
    const existing = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!existing) throw new Error('Document not found');

    if (companyId && existing.companyId && existing.companyId !== companyId) {
      throw new Error('Access denied. Document belongs to another company.');
    }

    await prisma.employeeDocument.delete({ where: { id } });
    return { success: true };
  }

  /**
   * ==========================================
   * 3. DOCUMENT EXPIRY REMINDERS
   * ==========================================
   */
  async getExpirySummary(params: { companyId?: string; brandId?: string }) {
    const { companyId, brandId } = params;
    const whereBrand: any = {
      isArchived: false,
      expiryDate: { not: null }
    };
    if (companyId) whereBrand.companyId = companyId;
    if (brandId && brandId !== 'all') whereBrand.brandId = brandId;

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr + 'T00:00:00Z');

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
}

export const assetDocumentService = new AssetDocumentService();
