import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  Building,
  Receipt,
  Boxes,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({});
  const [statusMsg, setStatusMsg] = useState(null);

  const { data: settingsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await api.get('/admin/settings');
      return res.data;
    },
  });

  useEffect(() => {
    if (settingsData?.map) {
      setFormState(settingsData.map);
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put('/admin/settings', { settings: payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setStatusMsg({ type: 'success', text: 'System configuration saved and audited successfully!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const handleChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formState);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <Settings className="w-3.5 h-3.5" /> Global ERP Configuration
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pharmacy System Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure clinical dispensary branding, fiscal tax rules, FEFO inventory thresholds, and receipts.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 self-start"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading system configuration..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Business Profile */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-teal-600" /> Pharmacy Trading Profile & Contacts
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Pharmacy Name</label>
                <input
                  type="text"
                  value={formState.pharmacy_name || ''}
                  onChange={(e) => handleChange('pharmacy_name', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Email</label>
                <input
                  type="email"
                  value={formState.pharmacy_email || ''}
                  onChange={(e) => handleChange('pharmacy_email', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Support Phone</label>
                <input
                  type="text"
                  value={formState.pharmacy_phone || ''}
                  onChange={(e) => handleChange('pharmacy_phone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Premises Address</label>
                <input
                  type="text"
                  value={formState.pharmacy_address || ''}
                  onChange={(e) => handleChange('pharmacy_address', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Billing & Currency */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Receipt className="w-4 h-4 text-teal-600" /> Fiscal & Tax Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={formState.currency_symbol || '$'}
                  onChange={(e) => handleChange('currency_symbol', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Sales Tax / GST (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formState.tax_gst_rate || '5.0'}
                  onChange={(e) => handleChange('tax_gst_rate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number Prefix</label>
                <input
                  type="text"
                  value={formState.invoice_prefix || 'INV-'}
                  onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Inventory & FEFO Safety Rules */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Boxes className="w-4 h-4 text-teal-600" /> Inventory & FEFO Protocol Parameters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Reorder Threshold (Units)</label>
                <input
                  type="number"
                  value={formState.default_reorder_level || '15'}
                  onChange={(e) => handleChange('default_reorder_level', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Critical Expiry Window (Days)</label>
                <input
                  type="number"
                  value={formState.fefo_critical_days || '30'}
                  onChange={(e) => handleChange('fefo_critical_days', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Approaching Expiry Window (Days)</label>
                <input
                  type="number"
                  value={formState.fefo_warning_days || '90'}
                  onChange={(e) => handleChange('fefo_warning_days', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={updateMutation.isLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isLoading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
