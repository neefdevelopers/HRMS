import React from 'react';
import { Card } from '../common/Card';
import { Building2, ChevronRight } from 'lucide-react';

interface BrandDistributionProps {
  distribution: Array<{
    brandId: string;
    brandName: string;
    brandCode: string;
    count: number;
    percentage: number;
  }>;
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
}

export const BrandDistributionChart: React.FC<BrandDistributionProps> = ({
  distribution,
  selectedBrandId,
  onSelectBrand
}) => {
  return (
    <Card
      title="Brand-Wise Distribution"
    >
      <div className="space-y-4">
        {distribution.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No brand distribution data available.</p>
        ) : (
          distribution.map((brand) => {
            const isSelected = selectedBrandId === brand.brandId;
            return (
              <div
                key={brand.brandId}
                onClick={() => onSelectBrand(brand.brandId)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/50 shadow-xs'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-800 truncate">{brand.brandName}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">({brand.brandCode})</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-slate-900">{brand.count}</span>
                    <span className="text-slate-400 text-[11px]">({brand.percentage}%)</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>

                {/* Compact Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSelected ? 'bg-brand-600' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, brand.percentage))}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
