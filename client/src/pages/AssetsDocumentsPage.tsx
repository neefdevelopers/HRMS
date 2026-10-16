import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { Asset, CompanyDocument, DocumentExpirySummary, Employee, AssetAssignmentHistory, AssetStatus } from '../types';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  FolderArchive,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Download,
  UploadCloud,
  FileText,
  History,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Send,
  Eye,
  Check,
  FileCheck,
  FileWarning,
  AlertTriangle,
  FolderSync
} from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'CONTRACT', label: 'Contract', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'CERTIFICATE', label: 'Certificate', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'OFFER_LETTER', label: 'Offer Letter', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'RELIEVING_LETTER', label: 'Relieving Letter', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'OTHER', label: 'Other Document', color: 'bg-slate-100 text-slate-700 border-slate-200' }
];

const ASSET_TYPES = [
  { value: 'LAPTOP', label: 'Laptop', icon: Laptop },
  { value: 'MOBILE', label: 'Mobile Phone', icon: Smartphone },
  { value: 'TABLET', label: 'Tablet', icon: Tablet },
  { value: 'MONITOR', label: 'Monitor / Display', icon: Monitor },
  { value: 'OTHER', label: 'Other Asset', icon: FolderArchive }
];

export interface AssetsDocumentsPageProps {
  mode?: 'assets' | 'documents' | 'all';
}

export const AssetsDocumentsPage: React.FC<AssetsDocumentsPageProps> = ({ mode = 'all' }) => {
  const { selectedBrandId } = useBrand();
  const { user } = useAuth();
  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR';

  // Active section tab: 'assets' | 'documents' | 'reminders'
  const [activeTab, setActiveTab] = useState<'assets' | 'documents' | 'reminders'>(() => {
    if (mode === 'documents') return 'documents';
    return 'assets';
  });

  // Common data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // 1. Assets State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('ALL');
  const [assetStatusFilter, setAssetStatusFilter] = useState('ALL');

  // Asset Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState<{
    name: string;
    type: string;
    assetTag: string;
    serialNumber: string;
    brandModel: string;
    purchaseDate: string;
    status: AssetStatus;
    notes: string;
  }>({
    name: '',
    type: 'LAPTOP',
    assetTag: '',
    serialNumber: '',
    brandModel: '',
    purchaseDate: '',
    status: 'AVAILABLE',
    notes: ''
  });

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAssetForAssign, setSelectedAssetForAssign] = useState<Asset | null>(null);
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    assignedDate: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedAssetForReturn, setSelectedAssetForReturn] = useState<Asset | null>(null);
  const [returnForm, setReturnForm] = useState({
    returnedDate: new Date().toISOString().slice(0, 10),
    conditionOnReturn: 'GOOD',
    returnNotes: ''
  });

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  // 2. Documents State
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [docEmployeeFilter, setDocEmployeeFilter] = useState('ALL');

  // Document Modals
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<CompanyDocument | null>(null);
  const [docForm, setDocForm] = useState({
    employeeId: '',
    documentType: 'CONTRACT',
    title: '',
    fileName: '',
    fileUrl: '',
    fileType: '',
    fileSize: 0,
    issueDate: '',
    expiryDate: '',
    remarks: ''
  });

  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [selectedDocForReplace, setSelectedDocForReplace] = useState<CompanyDocument | null>(null);
  const [replaceForm, setReplaceForm] = useState({
    title: '',
    fileName: '',
    fileUrl: '',
    fileType: '',
    fileSize: 0,
    issueDate: '',
    expiryDate: '',
    remarks: ''
  });

  // 3. Expiry Reminders State
  const [expirySummary, setExpirySummary] = useState<DocumentExpirySummary | null>(null);
  const [reminderFilter, setReminderFilter] = useState<'ALL' | 'EXPIRED' | '7_DAYS' | '30_DAYS'>('ALL');
  const [reminderInProgress, setReminderInProgress] = useState(false);

  const showNotification = (text: string, isError = false) => {
    setFeedbackMsg({ text, isError });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Initial Data Fetch
  useEffect(() => {
    loadEmployees();
  }, [selectedBrandId]);

  useEffect(() => {
    if (activeTab === 'assets') {
      loadAssets();
    } else if (activeTab === 'documents') {
      loadDocuments();
    } else if (activeTab === 'reminders') {
      loadExpirySummary();
    }
  }, [activeTab, selectedBrandId, assetTypeFilter, assetStatusFilter, docTypeFilter, docEmployeeFilter]);

  const loadEmployees = async () => {
    try {
      const emps = await api.getEmployees({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        limit: 200,
        status: 'ACTIVE'
      });
      setEmployees(emps);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    }
  };

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await api.getAssets({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        type: assetTypeFilter,
        status: assetStatusFilter,
        search: assetSearch.trim() || undefined
      });
      setAssets(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load assets', true);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await api.getCompanyDocuments({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        documentType: docTypeFilter,
        employeeId: docEmployeeFilter !== 'ALL' ? docEmployeeFilter : undefined,
        search: docSearch.trim() || undefined
      });
      setDocuments(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load documents', true);
    } finally {
      setLoading(false);
    }
  };

  const loadExpirySummary = async () => {
    setLoading(true);
    try {
      const data = await api.getDocumentExpirySummary({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined
      });
      setExpirySummary(data);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load expiry reminders', true);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ASSET ACTIONS
  // ============================================================
  const openCreateAssetModal = () => {
    setEditingAsset(null);
    setAssetForm({
      name: '',
      type: 'LAPTOP',
      assetTag: '',
      serialNumber: '',
      brandModel: '',
      purchaseDate: '',
      status: 'AVAILABLE',
      notes: ''
    });
    setIsAssetModalOpen(true);
  };

  const openEditAssetModal = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      type: asset.type,
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber || '',
      brandModel: asset.brandModel || '',
      purchaseDate: asset.purchaseDate || '',
      status: asset.status,
      notes: asset.notes || ''
    });
    setIsAssetModalOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAsset) {
        await api.updateAsset(editingAsset.id, assetForm);
        showNotification(`Asset "${assetForm.name}" updated successfully.`);
      } else {
        await api.createAsset({
          ...assetForm,
          brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined
        });
        showNotification(`Asset "${assetForm.name}" added successfully.`);
      }
      setIsAssetModalOpen(false);
      loadAssets();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save asset', true);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (asset.status === 'ASSIGNED') {
      showNotification('Cannot delete an assigned asset. Return it first.', true);
      return;
    }
    if (!confirm(`Are you sure you want to delete asset "${asset.name}" (${asset.assetTag})?`)) return;

    try {
      await api.deleteAsset(asset.id);
      showNotification(`Asset "${asset.name}" deleted.`);
      loadAssets();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete asset', true);
    }
  };

  const openAssignModal = (asset: Asset) => {
    setSelectedAssetForAssign(asset);
    setAssignForm({
      employeeId: '',
      assignedDate: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setIsAssignModalOpen(true);
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForAssign || !assignForm.employeeId) return;

    try {
      await api.assignAsset(selectedAssetForAssign.id, assignForm);
      showNotification(`Asset assigned successfully.`);
      setIsAssignModalOpen(false);
      loadAssets();
    } catch (err: any) {
      showNotification(err.message || 'Failed to assign asset', true);
    }
  };

  const openReturnModal = (asset: Asset) => {
    setSelectedAssetForReturn(asset);
    setReturnForm({
      returnedDate: new Date().toISOString().slice(0, 10),
      conditionOnReturn: 'GOOD',
      returnNotes: ''
    });
    setIsReturnModalOpen(true);
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForReturn) return;

    try {
      await api.returnAsset(selectedAssetForReturn.id, returnForm);
      showNotification(`Asset returned and marked as ${returnForm.conditionOnReturn === 'DAMAGED' ? 'Damaged' : 'Available'}.`);
      setIsReturnModalOpen(false);
      loadAssets();
    } catch (err: any) {
      showNotification(err.message || 'Failed to return asset', true);
    }
  };

  const openHistoryModal = async (asset: Asset) => {
    try {
      const fullAsset = await api.getAssetById(asset.id);
      setHistoryAsset(fullAsset);
      setIsHistoryModalOpen(true);
    } catch (err: any) {
      showNotification('Failed to fetch assignment history', true);
    }
  };

  // ============================================================
  // DOCUMENT ACTIONS
  // ============================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isReplace = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      showNotification('File exceeds the 12MB limit.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileUrl = reader.result as string;
      const fileName = file.name;
      const fileType = file.type || 'application/octet-stream';
      const fileSize = file.size;

      if (isReplace) {
        setReplaceForm(prev => ({
          ...prev,
          fileUrl,
          fileName,
          fileType,
          fileSize,
          title: prev.title || fileName.replace(/\.[^/.]+$/, '')
        }));
      } else {
        setDocForm(prev => ({
          ...prev,
          fileUrl,
          fileName,
          fileType,
          fileSize,
          title: prev.title || fileName.replace(/\.[^/.]+$/, '')
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const openCreateDocModal = () => {
    setEditingDoc(null);
    setDocForm({
      employeeId: employees[0]?.id || '',
      documentType: 'CONTRACT',
      title: '',
      fileName: '',
      fileUrl: '',
      fileType: '',
      fileSize: 0,
      issueDate: '',
      expiryDate: '',
      remarks: ''
    });
    setIsDocModalOpen(true);
  };

  const openEditDocModal = (doc: CompanyDocument) => {
    setEditingDoc(doc);
    setDocForm({
      employeeId: doc.employeeId,
      documentType: doc.documentType,
      title: doc.title,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileType: doc.fileType || '',
      fileSize: doc.fileSize || 0,
      issueDate: doc.issueDate || '',
      expiryDate: doc.expiryDate || '',
      remarks: doc.remarks || ''
    });
    setIsDocModalOpen(true);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc && !docForm.fileUrl) {
      showNotification('Please select a document file to upload.', true);
      return;
    }

    try {
      if (editingDoc) {
        await api.updateCompanyDocument(editingDoc.id, {
          title: docForm.title,
          documentType: docForm.documentType,
          issueDate: docForm.issueDate || undefined,
          expiryDate: docForm.expiryDate || undefined,
          remarks: docForm.remarks
        });
        showNotification(`Document "${docForm.title}" updated.`);
      } else {
        await api.createCompanyDocument({
          ...docForm,
          brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined
        });
        showNotification(`Document "${docForm.title}" uploaded successfully.`);
      }
      setIsDocModalOpen(false);
      loadDocuments();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save document', true);
    }
  };

  const openReplaceModal = (doc: CompanyDocument) => {
    setSelectedDocForReplace(doc);
    setReplaceForm({
      title: doc.title,
      fileName: '',
      fileUrl: '',
      fileType: '',
      fileSize: 0,
      issueDate: doc.issueDate || '',
      expiryDate: doc.expiryDate || '',
      remarks: doc.remarks || ''
    });
    setIsReplaceModalOpen(true);
  };

  const handleReplaceDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForReplace || !replaceForm.fileUrl) {
      showNotification('Please attach the new replacement file.', true);
      return;
    }

    try {
      await api.replaceCompanyDocument(selectedDocForReplace.id, replaceForm);
      showNotification(`Document "${selectedDocForReplace.title}" replaced. Previous version archived safely.`);
      setIsReplaceModalOpen(false);
      loadDocuments();
      if (activeTab === 'reminders') loadExpirySummary();
    } catch (err: any) {
      showNotification(err.message || 'Failed to replace document', true);
    }
  };

  const handleDeleteDocument = async (doc: CompanyDocument) => {
    if (!confirm(`Are you sure you want to delete document "${doc.title}"?`)) return;

    try {
      await api.deleteCompanyDocument(doc.id);
      showNotification(`Document "${doc.title}" deleted.`);
      loadDocuments();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete document', true);
    }
  };

  // ============================================================
  // EXPIRY REMINDER ACTIONS
  // ============================================================
  const handleTriggerReminders = async () => {
    setReminderInProgress(true);
    try {
      const res = await api.triggerExpiryReminders({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined
      });
      showNotification(`Triggered ${res.remindersSent} document expiry notifications successfully.`);
      loadExpirySummary();
    } catch (err: any) {
      showNotification(err.message || 'Failed to trigger reminders', true);
    } finally {
      setReminderInProgress(false);
    }
  };

  // Helper Formatter
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeBadge = (type: string) => {
    const found = DOCUMENT_TYPES.find(d => d.value === type);
    return found ? (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${found.color}`}>
        {found.label}
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-slate-100 text-slate-700 border-slate-200">
        {type.replace('_', ' ')}
      </span>
    );
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'LAPTOP':
        return <Laptop className="w-4 h-4 text-indigo-600" />;
      case 'MOBILE':
        return <Smartphone className="w-4 h-4 text-emerald-600" />;
      case 'TABLET':
        return <Tablet className="w-4 h-4 text-amber-600" />;
      case 'MONITOR':
        return <Monitor className="w-4 h-4 text-purple-600" />;
      default:
        return <FolderArchive className="w-4 h-4 text-slate-600" />;
    }
  };

  // Filtered Assets list
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSearch =
        !assetSearch ||
        a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.assetTag.toLowerCase().includes(assetSearch.toLowerCase()) ||
        (a.serialNumber && a.serialNumber.toLowerCase().includes(assetSearch.toLowerCase())) ||
        (a.brandModel && a.brandModel.toLowerCase().includes(assetSearch.toLowerCase())) ||
        (a.assignedEmployee &&
          `${a.assignedEmployee.firstName} ${a.assignedEmployee.lastName} ${a.assignedEmployee.employeeId}`
            .toLowerCase()
            .includes(assetSearch.toLowerCase()));

      const matchType = assetTypeFilter === 'ALL' || a.type === assetTypeFilter;
      const matchStatus = assetStatusFilter === 'ALL' || a.status === assetStatusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [assets, assetSearch, assetTypeFilter, assetStatusFilter]);

  // Filtered Documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter(d => {
      const matchSearch =
        !docSearch ||
        d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
        d.fileName.toLowerCase().includes(docSearch.toLowerCase()) ||
        (d.employee &&
          `${d.employee.firstName} ${d.employee.lastName} ${d.employee.employeeId}`
            .toLowerCase()
            .includes(docSearch.toLowerCase()));

      const matchType = docTypeFilter === 'ALL' || d.documentType === docTypeFilter;
      const matchEmp = docEmployeeFilter === 'ALL' || d.employeeId === docEmployeeFilter;

      return matchSearch && matchType && matchEmp;
    });
  }, [documents, docSearch, docTypeFilter, docEmployeeFilter]);

  // Filtered Reminders list
  const filteredReminders = useMemo(() => {
    if (!expirySummary) return [];
    if (reminderFilter === 'EXPIRED') return expirySummary.expired;
    if (reminderFilter === '7_DAYS') return expirySummary.expiringSoon7;
    if (reminderFilter === '30_DAYS') return expirySummary.expiringSoon30;
    // 'ALL' returns expired + expiring soon (7 + 30)
    return [...expirySummary.expired, ...expirySummary.expiringSoon7, ...expirySummary.expiringSoon30];
  }, [expirySummary, reminderFilter]);

  return (
    <div className="space-y-6">
      {/* Page Title & Notification Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {mode === 'assets'
              ? 'Hardware & Asset Management'
              : mode === 'documents'
              ? 'Employee Documents & Compliance'
              : 'Assets & Documents'}
          </h1>
        </div>

        {/* Tab switchers: only show tabs if mode is 'all' or 'documents' */}
        {mode === 'all' && (
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('assets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'assets'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>Assets</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 text-slate-600 font-mono">
                {assets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'documents'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>Employee Documents</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 text-slate-600 font-mono">
                {documents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'reminders'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Expiry Reminders</span>
              {expirySummary && (expirySummary.counts.expired > 0 || expirySummary.counts.expiringSoon7 > 0) && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-bold animate-pulse font-mono">
                  {expirySummary.counts.expired + expirySummary.counts.expiringSoon7}
                </span>
              )}
            </button>
          </div>
        )}

        {mode === 'documents' && (
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'documents'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>All Documents</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 text-slate-600 font-mono">
                {documents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'reminders'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Expiry Reminders</span>
              {expirySummary && (expirySummary.counts.expired > 0 || expirySummary.counts.expiringSoon7 > 0) && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-bold animate-pulse font-mono">
                  {expirySummary.counts.expired + expirySummary.counts.expiringSoon7}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Floating Notification */}
      {feedbackMsg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium shadow-sm transition-all ${
            feedbackMsg.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedbackMsg.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 1: ASSETS */}
      {/* ============================================================ */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[240px] flex-1 md:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search asset tag, name, model, employee..."
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={assetTypeFilter}
                onChange={e => setAssetTypeFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">All Types</option>
                {ASSET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={assetStatusFilter}
                onChange={e => setAssetStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAssets}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Refresh assets"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {isHrOrAdmin && (
                <button
                  onClick={openCreateAssetModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Asset</span>
                </button>
              )}
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Asset ID / Tag</th>
                    <th className="py-3 px-4">Asset Details</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Serial No.</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Currently Held By</th>
                    <th className="py-3 px-4">Assigned Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading && assets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading company assets...
                      </td>
                    </tr>
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No assets found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map(asset => {
                      return (
                        <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Tag */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[11px]">
                              {asset.assetTag}
                            </span>
                          </td>

                          {/* Name & Model */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{asset.name}</div>
                            {asset.brandModel && (
                              <div className="text-[11px] text-slate-500">{asset.brandModel}</div>
                            )}
                            {asset.purchaseDate && (
                              <div className="text-[10px] text-slate-400">
                                Purchased: {asset.purchaseDate}
                              </div>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {getAssetTypeIcon(asset.type)}
                              <span className="font-medium text-slate-700">
                                {ASSET_TYPES.find(t => t.value === asset.type)?.label || asset.type}
                              </span>
                            </div>
                          </td>

                          {/* Serial */}
                          <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                            {asset.serialNumber || '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {asset.status === 'AVAILABLE' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Available
                              </span>
                            )}
                            {asset.status === 'ASSIGNED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Assigned
                              </span>
                            )}
                            {asset.status === 'DAMAGED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Damaged
                              </span>
                            )}
                          </td>

                          {/* Currently Held By */}
                          <td className="py-3.5 px-4">
                            {asset.assignedEmployee ? (
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {asset.assignedEmployee.firstName} {asset.assignedEmployee.lastName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {asset.assignedEmployee.employeeId} • {asset.assignedEmployee.department?.name || 'General'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">In Storage / Unassigned</span>
                            )}
                          </td>

                          {/* Assigned Date */}
                          <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                            {asset.assignedDate || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Assign Button */}
                              {isHrOrAdmin && asset.status !== 'ASSIGNED' && (
                                <button
                                  onClick={() => openAssignModal(asset)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md font-semibold text-[11px] border border-brand-200 transition-colors"
                                  title="Assign to Employee"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Assign</span>
                                </button>
                              )}

                              {/* Return Button */}
                              {isHrOrAdmin && asset.status === 'ASSIGNED' && (
                                <button
                                  onClick={() => openReturnModal(asset)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md font-semibold text-[11px] border border-amber-200 transition-colors"
                                  title="Return Asset"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Return</span>
                                </button>
                              )}

                              {/* History */}
                              <button
                                onClick={() => openHistoryModal(asset)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                                title="Assignment History"
                              >
                                <History className="w-4 h-4" />
                              </button>

                              {/* Edit */}
                              {isHrOrAdmin && (
                                <button
                                  onClick={() => openEditAssetModal(asset)}
                                  className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Edit Asset Details"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete */}
                              {isHrOrAdmin && asset.status !== 'ASSIGNED' && (
                                <button
                                  onClick={() => handleDeleteAsset(asset)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Delete Asset"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: EMPLOYEE DOCUMENTS */}
      {/* ============================================================ */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[240px] flex-1 md:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by title, file name, or employee..."
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={docTypeFilter}
                onChange={e => setDocTypeFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">All Document Types</option>
                {DOCUMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {/* Employee Filter */}
              <select
                value={docEmployeeFilter}
                onChange={e => setDocEmployeeFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 max-w-[200px]"
              >
                <option value="ALL">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDocuments}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Refresh documents"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {isHrOrAdmin && (
                <button
                  onClick={openCreateDocModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Document</span>
                </button>
              )}
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Document Title</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Attachment</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading && documents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading employee documents...
                      </td>
                    </tr>
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No documents found. Click "Upload Document" to attach files.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map(doc => {
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Employee */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {doc.employee?.firstName} {doc.employee?.lastName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {doc.employee?.employeeId}
                            </div>
                          </td>

                          {/* Title */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                              <span>{doc.title}</span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4">{getDocTypeBadge(doc.documentType)}</td>

                          {/* Attachment Link */}
                          <td className="py-3.5 px-4">
                            <a
                              href={doc.fileUrl}
                              download={doc.fileName}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-center gap-1.5 font-mono text-brand-700 hover:text-brand-900 hover:underline max-w-[180px] truncate"
                              title={`Download ${doc.fileName}`}
                            >
                              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-700 shrink-0" />
                              <span className="truncate">{doc.fileName}</span>
                            </a>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatFileSize(doc.fileSize)}
                            </div>
                          </td>

                          {/* Issue Date */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                            {doc.issueDate || '—'}
                          </td>

                          {/* Expiry Date */}
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            {doc.expiryDate ? (
                              <span className="font-semibold text-slate-800">{doc.expiryDate}</span>
                            ) : (
                              <span className="text-slate-400 italic">No Expiry</span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate">
                            {doc.remarks || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Download button */}
                              <a
                                href={doc.fileUrl}
                                download={doc.fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                                title="Download Document"
                              >
                                <Download className="w-4 h-4" />
                              </a>

                              {/* Replace button */}
                              {isHrOrAdmin && (
                                <button
                                  onClick={() => openReplaceModal(doc)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] border border-slate-300 transition-colors"
                                  title="Replace document with updated version (preserves history)"
                                >
                                  <FolderSync className="w-3.5 h-3.5" />
                                  <span>Replace</span>
                                </button>
                              )}

                              {/* Edit details */}
                              {isHrOrAdmin && (
                                <button
                                  onClick={() => openEditDocModal(doc)}
                                  className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Edit details"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete */}
                              {isHrOrAdmin && (
                                <button
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Delete Document"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 3: EXPIRY REMINDERS */}
      {/* ============================================================ */}
      {activeTab === 'reminders' && (
        <div className="space-y-6">
          {/* Expiry Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Expired */}
            <div
              onClick={() => setReminderFilter('EXPIRED')}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                reminderFilter === 'EXPIRED'
                  ? 'ring-2 ring-rose-500 bg-rose-50/70 border-rose-300'
                  : 'bg-white hover:border-rose-300 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
                  Expired Documents
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                  <FileWarning className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-700 mt-2 font-mono">
                {expirySummary?.counts.expired || 0}
              </div>
              <p className="text-[11px] text-rose-600 mt-1">Requires immediate renewal / replacement</p>
            </div>

            {/* Expiring Soon (7 Days) */}
            <div
              onClick={() => setReminderFilter('7_DAYS')}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                reminderFilter === '7_DAYS'
                  ? 'ring-2 ring-amber-500 bg-amber-50/70 border-amber-300'
                  : 'bg-white hover:border-amber-300 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Expiring In ≤ 7 Days
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
                {expirySummary?.counts.expiringSoon7 || 0}
              </div>
              <p className="text-[11px] text-amber-600 mt-1">Urgent reminder notification queued</p>
            </div>

            {/* Expiring in 30 Days */}
            <div
              onClick={() => setReminderFilter('30_DAYS')}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                reminderFilter === '30_DAYS'
                  ? 'ring-2 ring-blue-500 bg-blue-50/70 border-blue-300'
                  : 'bg-white hover:border-blue-300 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Expiring In 8–30 Days
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-blue-700 mt-2 font-mono">
                {expirySummary?.counts.expiringSoon30 || 0}
              </div>
              <p className="text-[11px] text-blue-600 mt-1">Standard 30-day reminder scheduled</p>
            </div>

            {/* Active & Valid */}
            <div
              onClick={() => setReminderFilter('ALL')}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                reminderFilter === 'ALL'
                  ? 'ring-2 ring-emerald-500 bg-emerald-50/70 border-emerald-300'
                  : 'bg-white hover:border-emerald-300 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Valid / All Tracked
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
                {expirySummary?.counts.totalTracked || 0}
              </div>
              <p className="text-[11px] text-emerald-600 mt-1">
                {expirySummary?.counts.activeValid || 0} valid beyond 30 days
              </p>
            </div>
          </div>

          {/* Action Header & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setReminderFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reminderFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Expiring / Expired
              </button>
              <button
                onClick={() => setReminderFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reminderFilter === 'EXPIRED'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Expired Only ({expirySummary?.counts.expired || 0})
              </button>
              <button
                onClick={() => setReminderFilter('7_DAYS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reminderFilter === '7_DAYS'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                ≤ 7 Days ({expirySummary?.counts.expiringSoon7 || 0})
              </button>
              <button
                onClick={() => setReminderFilter('30_DAYS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  reminderFilter === '30_DAYS'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                8–30 Days ({expirySummary?.counts.expiringSoon30 || 0})
              </button>
            </div>

            {/* Trigger Reminders Action */}
            {isHrOrAdmin && (
              <button
                onClick={handleTriggerReminders}
                disabled={reminderInProgress}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors shrink-0 disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${reminderInProgress ? 'animate-spin' : ''}`} />
                <span>{reminderInProgress ? 'Sending Reminders...' : 'Send Expiry Reminders'}</span>
              </button>
            )}
          </div>

          {/* Reminders Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Document Title & Type</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Time Left / Status</th>
                    <th className="py-3 px-4">Automated Reminder</th>
                    <th className="py-3 px-4">Attachment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading && !expirySummary ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Analyzing document expiration schedules...
                      </td>
                    </tr>
                  ) : filteredReminders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No documents matching the selected expiry reminder filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReminders.map(doc => {
                      const days = doc.daysUntilExpiry ?? 0;
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Employee */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {doc.employee?.firstName} {doc.employee?.lastName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {doc.employee?.employeeId}
                            </div>
                          </td>

                          {/* Title & Type */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{doc.title}</div>
                            <div className="mt-1">{getDocTypeBadge(doc.documentType)}</div>
                          </td>

                          {/* Expiry Date */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-[11px]">
                            {doc.expiryDate}
                          </td>

                          {/* Days Left Status Badge */}
                          <td className="py-3.5 px-4">
                            {days < 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                Expired {Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} ago
                              </span>
                            ) : days <= 7 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Expiring in {days} day{days === 1 ? '' : 's'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                Expiring in {days} days
                              </span>
                            )}
                          </td>

                          {/* Reminder Status */}
                          <td className="py-3.5 px-4">
                            {doc.reminder7Sent ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                <Check className="w-3 h-3 text-rose-600" />
                                7-Day Alert Sent
                              </span>
                            ) : doc.reminder30Sent ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <Check className="w-3 h-3 text-amber-600" />
                                30-Day Alert Sent
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Reminder Scheduled
                              </span>
                            )}
                          </td>

                          {/* Attachment Link */}
                          <td className="py-3.5 px-4">
                            <a
                              href={doc.fileUrl}
                              download={doc.fileName}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-brand-700 hover:underline max-w-[150px] truncate block text-[11px]"
                            >
                              {doc.fileName}
                            </a>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <a
                                href={doc.fileUrl}
                                download={doc.fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                                title="Download Document"
                              >
                                <Download className="w-4 h-4" />
                              </a>

                              {isHrOrAdmin && (
                                <button
                                  onClick={() => openReplaceModal(doc)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md font-semibold text-[11px] border border-brand-200 transition-colors"
                                  title="Renew / Replace Document"
                                >
                                  <FolderSync className="w-3.5 h-3.5" />
                                  <span>Renew Document</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT ASSET */}
      {/* ============================================================ */}
      <Modal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        title={editingAsset ? `Edit Asset: ${editingAsset.assetTag}` : 'Add New Company Asset'}
        description="Record company laptops, mobile phones, or other equipment."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveAsset} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Asset Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. MacBook Pro 14, iPhone 15, Dell UltraSharp"
              value={assetForm.name}
              onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Asset Type *</label>
              <select
                value={assetForm.type}
                onChange={e => setAssetForm({ ...assetForm, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                {ASSET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unique Asset ID / Tag *</label>
              <input
                type="text"
                required
                placeholder="e.g. LAP-2024-001"
                value={assetForm.assetTag}
                onChange={e => setAssetForm({ ...assetForm, assetTag: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Serial Number</label>
              <input
                type="text"
                placeholder="e.g. C02G41ABMD6R"
                value={assetForm.serialNumber}
                onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand / Model</label>
              <input
                type="text"
                placeholder="e.g. Apple M3 Pro, Samsung S24"
                value={assetForm.brandModel}
                onChange={e => setAssetForm({ ...assetForm, brandModel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={assetForm.purchaseDate}
                onChange={e => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={assetForm.status}
                onChange={e => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
                disabled={editingAsset?.status === 'ASSIGNED'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-100"
              >
                <option value="AVAILABLE">Available</option>
                <option value="DAMAGED">Damaged</option>
                {editingAsset?.status === 'ASSIGNED' && <option value="ASSIGNED">Assigned</option>}
              </select>
              {editingAsset?.status === 'ASSIGNED' && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">Use 'Return' action to change status.</span>
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Specifications</label>
            <textarea
              rows={2}
              placeholder="e.g. 16GB RAM, 512GB SSD, includes power adapter"
              value={assetForm.notes}
              onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssetModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              {editingAsset ? 'Save Changes' : 'Create Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: ASSIGN ASSET */}
      {/* ============================================================ */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Asset to Employee"
        description={`Assign ${selectedAssetForAssign?.name} (${selectedAssetForAssign?.assetTag})`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAssignAsset} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Employee *</label>
            <select
              required
              value={assignForm.employeeId}
              onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
            >
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId}) - {emp.department?.name || 'General'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assignment Date *</label>
            <input
              type="date"
              required
              value={assignForm.assignedDate}
              onChange={e => setAssignForm({ ...assignForm, assignedDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assignment Remarks (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Issued with charger and laptop bag."
              value={assignForm.notes}
              onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              Confirm Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: RETURN ASSET */}
      {/* ============================================================ */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Return Asset"
        description={`Return ${selectedAssetForReturn?.name} (${selectedAssetForReturn?.assetTag})`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleReturnAsset} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500">Currently held by:</div>
            <div className="font-bold text-slate-900 mt-0.5">
              {selectedAssetForReturn?.assignedEmployee?.firstName}{' '}
              {selectedAssetForReturn?.assignedEmployee?.lastName} (
              {selectedAssetForReturn?.assignedEmployee?.employeeId})
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Assigned on: {selectedAssetForReturn?.assignedDate || '—'}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Return Date *</label>
            <input
              type="date"
              required
              value={returnForm.returnedDate}
              onChange={e => setReturnForm({ ...returnForm, returnedDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Condition on Return *</label>
            <select
              value={returnForm.conditionOnReturn}
              onChange={e => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
            >
              <option value="GOOD">Good / Pristine (Make Available)</option>
              <option value="MINOR_WEAR">Minor Wear & Tear (Make Available)</option>
              <option value="DAMAGED">Damaged / Broken (Mark as Damaged)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Return Notes / Inspection</label>
            <textarea
              rows={2}
              placeholder="e.g. Device inspected, factory reset, power adapter received."
              value={returnForm.returnNotes}
              onChange={e => setReturnForm({ ...returnForm, returnNotes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs"
            >
              Confirm Return
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: ASSET ASSIGNMENT HISTORY */}
      {/* ============================================================ */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Assignment History: ${historyAsset?.name} (${historyAsset?.assetTag})`}
        description="Preserved historical records of all employees who held this asset."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3 text-xs">
          {!historyAsset?.assignmentHistory || historyAsset.assignmentHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No historical assignments recorded for this asset yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Assigned Date</th>
                    <th className="py-2.5 px-3">Returned Date</th>
                    <th className="py-2.5 px-3">Condition</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {historyAsset.assignmentHistory.map(hist => (
                    <tr key={hist.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {hist.employee?.firstName} {hist.employee?.lastName}
                        <span className="text-[10px] text-slate-400 font-mono ml-1">
                          ({hist.employee?.employeeId})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{hist.assignedDate}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {hist.returnedDate ? (
                          <span className="text-slate-700">{hist.returnedDate}</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            Currently Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {hist.conditionOnReturn ? (
                          <span className="text-[11px] font-medium text-slate-600">
                            {hist.conditionOnReturn}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{hist.returnNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 5: UPLOAD / EDIT DOCUMENT */}
      {/* ============================================================ */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title={editingDoc ? `Edit Document Details: ${editingDoc.title}` : 'Upload Employee Document'}
        description="Upload employee contracts, certificates, offer letters, or relieving letters."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
          {!editingDoc && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Employee *</label>
              <select
                required
                value={docForm.employeeId}
                onChange={e => setDocForm({ ...docForm, employeeId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                <option value="">-- Choose Employee --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId}) - {emp.department?.name || 'General'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Document Type *</label>
              <select
                value={docForm.documentType}
                onChange={e => setDocForm({ ...docForm, documentType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                {DOCUMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Employment Contract 2024"
                value={docForm.title}
                onChange={e => setDocForm({ ...docForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {!editingDoc && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                File Attachment (PDF, DOCX, PNG, JPG) *
              </label>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={e => handleFileUpload(e, false)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700"
              />
              {docForm.fileName && (
                <div className="text-[11px] text-emerald-700 font-mono mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    Selected: {docForm.fileName} ({formatFileSize(docForm.fileSize)})
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Issue Date (Optional)</label>
              <input
                type="date"
                value={docForm.issueDate}
                onChange={e => setDocForm({ ...docForm, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expiry Date (Optional)</label>
              <input
                type="date"
                value={docForm.expiryDate}
                onChange={e => setDocForm({ ...docForm, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Leave empty if document has no expiry.
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Signed contract copy by HR Director"
              value={docForm.remarks}
              onChange={e => setDocForm({ ...docForm, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDocModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              {editingDoc ? 'Save Changes' : 'Upload Document'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 6: REPLACE DOCUMENT */}
      {/* ============================================================ */}
      <Modal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        title={`Replace Document: ${selectedDocForReplace?.title}`}
        description="Preserves existing record in archive and uploads new active version."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleReplaceDocument} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
            <div className="font-semibold text-xs flex items-center gap-1.5">
              <FolderSync className="w-4 h-4 text-amber-600" />
              <span>Version Preservation</span>
            </div>
            <p className="text-[11px] mt-1 leading-snug">
              Replacing will mark the current file (
              <span className="font-mono font-bold">{selectedDocForReplace?.fileName}</span>) as archived. Historical
              records remain intact.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select New File *</label>
            <input
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={e => handleFileUpload(e, true)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700"
            />
            {replaceForm.fileName && (
              <div className="text-[11px] text-emerald-700 font-mono mt-1 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>
                  New File: {replaceForm.fileName} ({formatFileSize(replaceForm.fileSize)})
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Document Title</label>
            <input
              type="text"
              value={replaceForm.title}
              onChange={e => setReplaceForm({ ...replaceForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Issue Date</label>
              <input
                type="date"
                value={replaceForm.issueDate}
                onChange={e => setReplaceForm({ ...replaceForm, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Expiry Date</label>
              <input
                type="date"
                value={replaceForm.expiryDate}
                onChange={e => setReplaceForm({ ...replaceForm, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Replacement Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Renewed contract for 2025"
              value={replaceForm.remarks}
              onChange={e => setReplaceForm({ ...replaceForm, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReplaceModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              Replace Document
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AssetsDocumentsPage;
