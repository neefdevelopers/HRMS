import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { assetDocumentService } from '../services/assetDocumentService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class AssetDocumentController {
  /**
   * ==========================================
   * 1. ASSET CONTROLLER ACTIONS
   * ==========================================
   */
  async getAssets(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const type = (req.query.type as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const employeeId = (req.query.employeeId as string) || undefined;
      const search = (req.query.search as string) || undefined;
      const companyId = req.effectiveCompanyId || undefined;

      const assets = await assetDocumentService.getAssets({
        companyId,
        brandId,
        type,
        status,
        employeeId,
        search
      });

      return sendSuccess(res, assets, 'Assets retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve assets', 500);
    }
  }

  async getAssetById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const asset = await assetDocumentService.getAssetById(id, req.effectiveCompanyId);
      return sendSuccess(res, asset);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve asset', 404);
    }
  }

  async createAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, type, assetTag, serialNumber, brandModel, purchaseDate, status, notes } = req.body;
      const brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!brandId) return sendError(res, 'Brand ID is required', 400);
      if (!name || !assetTag) return sendError(res, 'Asset name and Asset ID/Tag are required', 400);

      const asset = await assetDocumentService.createAsset({
        companyId: req.effectiveCompanyId || undefined,
        brandId,
        name,
        type: type || 'LAPTOP',
        assetTag,
        serialNumber,
        brandModel,
        purchaseDate,
        status,
        notes
      });

      return sendSuccess(res, asset, 'Asset created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create asset', 400);
    }
  }

  async updateAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updated = await assetDocumentService.updateAsset(id, req.body, req.effectiveCompanyId);
      return sendSuccess(res, updated, 'Asset updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update asset', 400);
    }
  }

  async deleteAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await assetDocumentService.deleteAsset(id, req.effectiveCompanyId);
      return sendSuccess(res, null, 'Asset deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete asset', 400);
    }
  }

  async assignAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { employeeId, assignedDate, notes } = req.body;

      if (!employeeId) return sendError(res, 'Employee ID is required', 400);

      const updated = await assetDocumentService.assignAsset(id, {
        employeeId,
        assignedDate,
        assignedById: req.user?.id,
        notes
      }, req.effectiveCompanyId);

      return sendSuccess(res, updated, 'Asset assigned successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to assign asset', 400);
    }
  }

  async returnAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { returnedDate, returnNotes, conditionOnReturn } = req.body;

      const updated = await assetDocumentService.returnAsset(id, {
        returnedDate,
        returnNotes,
        conditionOnReturn
      }, req.effectiveCompanyId);

      return sendSuccess(res, updated, 'Asset returned and status updated');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to return asset', 400);
    }
  }

  /**
   * ==========================================
   * 2. DOCUMENT CONTROLLER ACTIONS
   * ==========================================
   */
  async getDocuments(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const employeeId = (req.query.employeeId as string) || undefined;
      const category = (req.query.category as string) || undefined;
      const documentType = (req.query.documentType as string) || undefined;
      const search = (req.query.search as string) || undefined;
      const companyId = req.effectiveCompanyId || undefined;

      const docs = await assetDocumentService.getDocuments({
        companyId,
        brandId,
        employeeId,
        category,
        documentType,
        search
      });

      return sendSuccess(res, docs, 'Documents retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve documents', 500);
    }
  }

  async getDocumentById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const doc = await assetDocumentService.getDocumentById(id, req.effectiveCompanyId);
      return sendSuccess(res, doc);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve document', 404);
    }
  }

  async createDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { employeeId, title, documentType, category, fileName, fileType, fileSize, fileUrl, issueDate, expiryDate, remarks, description } = req.body;
      const brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!employeeId) return sendError(res, 'Employee ID is required', 400);
      if (!title || !fileName || !fileUrl) return sendError(res, 'Title, file name, and file URL/content are required', 400);

      const doc = await assetDocumentService.createDocument({
        companyId: req.effectiveCompanyId || undefined,
        brandId,
        employeeId,
        title,
        documentType: documentType || 'OTHER',
        category: category || 'GENERAL',
        fileName,
        fileType,
        fileSize,
        fileUrl,
        issueDate,
        expiryDate,
        remarks,
        description,
        uploadedById: req.user?.id
      });

      return sendSuccess(res, doc, 'Document uploaded successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to upload document', 400);
    }
  }

  async updateDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updated = await assetDocumentService.updateDocument(id, req.body, req.effectiveCompanyId);
      return sendSuccess(res, updated, 'Document updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update document', 400);
    }
  }

  async deleteDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await assetDocumentService.deleteDocument(id, req.effectiveCompanyId);
      return sendSuccess(res, null, 'Document deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete document', 400);
    }
  }

  /**
   * ==========================================
   * 3. EXPIRY REMINDER ACTION
   * ==========================================
   */
  async getExpirySummary(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const companyId = req.effectiveCompanyId || undefined;

      const summary = await assetDocumentService.getExpirySummary({
        companyId,
        brandId
      });

      return sendSuccess(res, summary, 'Document expiry summary calculated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to calculate expiry summary', 500);
    }
  }

  async replaceDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updated = await assetDocumentService.updateDocument(id, req.body, req.effectiveCompanyId);
      return sendSuccess(res, updated, 'Document replaced successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to replace document', 400);
    }
  }

  async triggerExpiryReminders(req: AuthenticatedRequest, res: Response) {
    try {
      const summary = await assetDocumentService.getExpirySummary({
        companyId: req.effectiveCompanyId || undefined,
        brandId: (req.query.brandId as string) || req.effectiveBrandId || undefined
      });
      return sendSuccess(res, summary, 'Document expiry reminders checked');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to trigger expiry reminders', 500);
    }
  }
}

export const assetDocumentController = new AssetDocumentController();
