import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { Brand, Branch, Department, Shift } from '../types';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, MapPin, Clock, Layers } from 'lucide-react';

export const BrandsPage: React.FC = () => {
  const { canAccessAllBrands } = useAuth();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  const [newBrand, setNewBrand] = useState({
    name: '',
    code: '',
    companyName: '',
    email: '',
    phone: '',
    address: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, brData, dData, sData] = await Promise.all([
        api.getBrands(),
        api.getBranches(),
        api.getDepartments(),
        api.getShifts()
      ]);
      setBrands(bData);
      setBranches(brData);
      setDepartments(dData);
      setShifts(sData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBrand(newBrand);
      setIsBrandModalOpen(false);
      setNewBrand({ name: '', code: '', companyName: '', email: '', phone: '', address: '' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create brand');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization & Brands</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure group brands, branches, departments, and shift templates.
          </p>
        </div>

        {canAccessAllBrands && (
          <button
            onClick={() => setIsBrandModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Brand
          </button>
        )}
      </div>

      {/* Brands Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {brands.map((b) => (
          <Card key={b.id} className="hover:border-slate-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{b.name}</h3>
                  <span className="text-[11px] font-mono text-slate-400">Code: {b.code}</span>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>

            <p className="text-xs text-slate-600 mb-3 line-clamp-1">{b.companyName}</p>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center">
              <div>
                <span className="text-sm font-bold text-slate-900">{b._count?.employees ?? 0}</span>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Staff</span>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900">{b._count?.branches ?? 0}</span>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Branches</span>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900">{b._count?.departments ?? 0}</span>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Depts</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-3 truncate">{b.address || 'Address registered'}</p>
          </Card>
        ))}
      </div>

      {/* Branches & Shifts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branches */}
        <Card title="Operating Branches" subtitle="Location and regional hubs">
          <div className="divide-y divide-slate-100">
            {branches.map((br) => (
              <div key={br.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="font-semibold text-slate-900">{br.name}</span>
                    <span className="block text-[11px] text-slate-400">
                      {br.city}, {br.state} • {br.brand?.name}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-500">{br.code}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Standard Shifts */}
        <Card title="Shift Configurations" subtitle="Working hours and grace periods">
          <div className="divide-y divide-slate-100">
            {shifts.map((s) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="font-semibold text-slate-900">{s.name}</span>
                    <span className="block text-[11px] text-slate-400">
                      Grace: {s.gracePeriodMinutes} mins • {s.brand?.name}
                    </span>
                  </div>
                </div>
                <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {s.startTime} - {s.endTime}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Add Brand Modal */}
      <Modal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        title="Register New Brand"
        description="Add a distinct operating company or brand into the enterprise group."
      >
        <form onSubmit={handleCreateBrand} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Apex Lifestyle"
                value={newBrand.name}
                onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. APL"
                value={newBrand.code}
                onChange={(e) => setNewBrand({ ...newBrand, code: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Legal Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Apex Lifestyle Retail Pvt. Ltd."
              value={newBrand.companyName}
              onChange={(e) => setNewBrand({ ...newBrand, companyName: e.target.value })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={newBrand.email}
                onChange={(e) => setNewBrand({ ...newBrand, email: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={newBrand.phone}
                onChange={(e) => setNewBrand({ ...newBrand, phone: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office Address</label>
            <textarea
              rows={2}
              value={newBrand.address}
              onChange={(e) => setNewBrand({ ...newBrand, address: e.target.value })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsBrandModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs"
            >
              Create Brand
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
