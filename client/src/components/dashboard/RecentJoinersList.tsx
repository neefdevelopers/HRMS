import React from 'react';
import { Card } from '../common/Card';
import { UserPlus, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecentJoinersProps {
  joiners: Array<{
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    joiningDate: string;
    department?: { name: string };
    brand?: { name: string };
    designation?: { title: string };
  }>;
}

export const RecentJoinersList: React.FC<RecentJoinersProps> = ({ joiners }) => {
  const navigate = useNavigate();

  return (
    <Card
      title="New Joiners"
      action={
        <button
          onClick={() => navigate('/employees')}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          View All <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="divide-y divide-slate-100">
        {joiners.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No new joiners within this period.
          </div>
        ) : (
          joiners.map((emp) => (
            <div
              key={emp.id}
              onClick={() => navigate(`/employees?search=${emp.employeeId}`)}
              className="py-3 first:pt-0 last:pb-0 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                  {emp.firstName[0]}
                  {emp.lastName[0]}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 leading-tight">
                    {emp.firstName} {emp.lastName}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {emp.designation?.title || emp.department?.name || 'Staff'} • {emp.brand?.name}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {emp.joiningDate}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">{emp.employeeId}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
