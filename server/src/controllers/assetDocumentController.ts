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

      const assets = await assetDocumentService.getAssets({
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
      const asset = await assetDocumentService.getAssetById(id);
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
      const updated = await assetDocumentService.updateAsset(id, req.body);
      return sendSuccess(res, updated, 'Asset updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update asset', 400);
    }
  }

  async deleteAsset(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await assetDocumentService.deleteAsset(id);
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
      });

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
      });

      return sendSuccess(res, updated, 'Asset returned and marked available');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to return asset', 400);
    }
  }

  /**
   * ==========================================
   * 2. EMPLOYEE DOCUMENTS ACTIONS
   * ==========================================
   */
  async getDocuments(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const employeeId = (req.query.employeeId as string) || undefined;
      const documentType = (req.query.documentType as string) || undefined;
      const search = (req.query.search as string) || undefined;

      const docs = await assetDocumentService.getDocuments({
        brandId,
        employeeId,
        documentType,
        search
      });

      return sendSuccess(res, docs, 'Documents retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve documents', 500);
    }
  }

  async createDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        employeeId,
        title,
        documentType,
        category,
        fileName,
        fileType,
        fileSize,
        fileUrl,
        issueDate,
        expiryDate,
        remarks,
        description
      } = req.body;

      const brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!brandId || !employeeId) return sendError(res, 'Brand and Employee are required', 400);
      if (!title || !fileName || !fileUrl) return sendError(res, 'Document title, file name, and attachment are required', 400);

      const doc = await assetDocumentService.createDocument({
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
      const updated = await assetDocumentService.updateDocument(id, req.body);
      return sendSuccess(res, updated, 'Document updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update document', 400);
    }
  }

  async replaceDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { fileName, fileType, fileSize, fileUrl, title, issueDate, expiryDate, remarks } = req.body;

      if (!fileName || !fileUrl) {
        return sendError(res, 'Replacement file attachment is required', 400);
      }

      const replaced = await assetDocumentService.replaceDocument(id, {
        fileName,
        fileType,
        fileSize,
        fileUrl,
        title,
        issueDate,
        expiryDate,
        remarks,
        uploadedById: req.user?.id
      });

      return sendSuccess(res, replaced, 'Document replaced and previous version preserved in history', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to replace document', 400);
    }
  }

  async deleteDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await assetDocumentService.deleteDocument(id);
      return sendSuccess(res, null, 'Document deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete document', 400);
    }
  }

  /**
   * ==========================================
   * 3. EXPIRY REMINDERS ACTIONS
   * ==========================================
   */
  async getExpirySummary(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const summary = await assetDocumentService.getExpirySummary({ brandId });
      return sendSuccess(res, summary, 'Document expiry summary generated');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to get expiry summary', 500);
    }
  }

  async triggerExpiryReminders(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.body.brandId as string) || req.effectiveBrandId || undefined;
      const result = await assetDocumentService.triggerExpiryReminders({ brandId });
      return sendSuccess(res, result, `Processed reminders: ${result.remindersSent} notifications triggered.`);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to trigger expiry reminders', 500);
    }
  }
}

export const assetDocumentController = new AssetDocumentController();
