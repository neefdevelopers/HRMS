import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Check, X, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface PendingApprovalsProps {
  approvals: Array<{
    id: string;
    status: string;
    reason: string;
    startDate: string;
    endDate: string;
    employee: {
      firstName: string;
      lastName: string;
      employeeId: string;
      department?: { name: string };
      brand?: { name: string };
    };
    leaveType?: { name: string };
  }>;
  onRefresh: () => void;
}

export const PendingApprovalsList: React.FC<PendingApprovalsProps> = ({
  approvals,
  onRefresh
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canApprove = user?.role === 'ADMIN' || user?.role === 'HR';

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setProcessingId(id);
      await api.reviewLeave(id, status);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update approval');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card
      title="Pending Approvals"
      action={
        <button
          onClick={() => navigate('/leave')}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          Approval Queue <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="divide-y divide-slate-100">
        {approvals.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            All approval requests are up to date.
          </div>
        ) : (
          approvals.map((req) => (
            <div key={req.id} className="py-3 first:pt-0 last:pb-0 px-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-slate-900">
                    {req.employee.firstName} {req.employee.lastName}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">({req.employee.employeeId})</span>
                </div>
                <Badge variant="warning">{req.leaveType?.name || 'Leave'}</Badge>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <p className="truncate max-w-[220px]" title={req.reason}>
                  {req.reason}
                </p>
                <span className="font-mono text-slate-600 shrink-0">
                  {req.startDate} to {req.endDate}
                </span>
              </div>

              {canApprove && (
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                  <button
                    disabled={processingId === req.id}
                    onClick={() => handleReview(req.id, 'APPROVED')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    disabled={processingId === req.id}
                    onClick={() => handleReview(req.id, 'REJECTED')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
