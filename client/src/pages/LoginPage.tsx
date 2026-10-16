import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Building2, Users, Eye, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@hrms.local');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'ATTENDANCE_VIEWER') {
        navigate('/attendance');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = (roleEmail: string, pass: string = 'password123') => {
    setEmail(roleEmail);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-slate-200/90 p-8 space-y-6">
        {/* Brand logo & header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white mx-auto shadow-md mb-3 font-bold text-xl">
            H
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">HRMS Enterprise</h2>
          <p className="text-xs text-slate-500 mt-1">
            Sign in to access your multi-company HRMS dashboard
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to HRMS'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Demo Fast Logins */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
            One-Click Test Accounts (3 Roles)
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => handleDemoSelect('admin@hrms.local', 'password123')}
              className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-left transition-colors"
            >
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Shield className="w-3 h-3 text-brand-600" /> Admin
              </span>
              <span className="text-[10px] text-slate-500 block truncate">admin@hrms.local</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSelect('hr.apex@hrms.local', 'password123')}
              className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-left transition-colors"
            >
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-600" /> HR (Apex)
              </span>
              <span className="text-[10px] text-slate-500 block truncate">hr.apex@hrms.local</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSelect('viewer.a@hrms.local', 'password123')}
              className="p-2 border border-amber-200 rounded-lg bg-amber-50/60 hover:bg-amber-100/60 text-left transition-colors"
            >
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-600" /> Viewer (Beta)
              </span>
              <span className="text-[10px] text-amber-700 block truncate">viewer.a@hrms.local</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSelect('viewer.multi@hrms.local', 'password123')}
              className="p-2 border border-amber-200 rounded-lg bg-amber-50/60 hover:bg-amber-100/60 text-left transition-colors"
            >
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-amber-600" /> Multi-Viewer
              </span>
              <span className="text-[10px] text-amber-700 block truncate">viewer.multi@hrms.local</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSelect('hybrid.user@hrms.local', 'password123')}
              className="p-2 border border-purple-200 rounded-lg bg-purple-50/60 hover:bg-purple-100/60 text-left transition-colors col-span-2"
            >
              <span className="font-bold text-purple-900 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" /> Hybrid (HR in Beta, Viewer in Apex)
              </span>
              <span className="text-[10px] text-purple-700 block truncate">hybrid.user@hrms.local</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Role strictly recalculated per company membership on the backend
          </p>
        </div>
      </div>
    </div>
  );
};
