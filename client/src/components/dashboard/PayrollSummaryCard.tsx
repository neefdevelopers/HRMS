import React from 'react';
import { Card } from '../common/Card';
import { Badge, BadgeVariant } from '../common/Badge';
import { Banknote, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface PayrollSummaryProps {
  payroll: {
    configured: boolean;
    period?: string;
    totalEmployees?: number;
    totalGross?: number;
    totalNet?: number;
    status?: string;
    brandName?: string;
    message?: string;
  } | null | undefined;
}

export const PayrollSummaryCard: React.FC<PayrollSummaryProps> = ({ payroll }) => {
  const { user } = useAuth();
  const canAccessPayroll = user?.role === 'ADMIN' || user?.role === 'HR';

  if (!canAccessPayroll) {
    return (
      <Card title="Monthly Payroll Summary">
        <div className="py-6 text-center">
          <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">
            Salary & payroll metrics restricted to authorized HR management.
          </p>
        </div>
      </Card>
    );
  }

  const statusVariants: Record<string, BadgeVariant> = {
    DRAFT: 'neutral',
    PROCESSING: 'warning',
    FINALIZED: 'success',
    PAID: 'info'
  };

  return (
    <Card
      title="Monthly Payroll Summary"
      action={
        payroll?.configured && payroll?.status ? (
          <Badge variant={statusVariants[payroll.status] || 'neutral'}>
            {payroll.status}
          </Badge>
        ) : undefined
      }
    >
      {!payroll || !payroll.configured ? (
        <div className="py-6 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-600">Payroll Cycle Not Finalized</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
            {payroll?.message || 'No finalized payroll data found for the selected brand and period.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Total Gross Payroll
              </span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                ₹{payroll.totalGross?.toLocaleString('en-IN') || 0}
              </span>
              <span className="text-[10px] text-slate-500">
                {payroll.totalEmployees || 0} Active Employees
              </span>
            </div>

            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 block">
                Estimated Net Payout
              </span>
              <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
                ₹{payroll.totalNet?.toLocaleString('en-IN') || 0}
              </span>
              <span className="text-[10px] text-emerald-600/80">
                Disbursement Ready
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200/60 flex items-center justify-between">
            <span>Brand: <strong>{payroll.brandName || 'Selected Brand'}</strong></span>
            <span>Cycle: <strong>{payroll.period}</strong></span>
          </div>
        </div>
      )}
    </Card>
  );
};
