import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  ClockAlert,
  Search,
  Filter,
  AlertTriangle,
  ShieldBan,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  X,
  RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistExpiryMonitoringPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('expired'); // 'expired' | '30' | '60' | '90' | 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch expiry monitoring breakdown
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pharmacist-expiry-monitoring', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/pharmacist/expiry-monitoring?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  // Block Batch Mutation
  const blockMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/pharmacist/batches/${id}/block`, { reason });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-expiry-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard-badges'] });
      setStatusMsg(`Batch '${data.batch_number}' has been quarantined and blocked from dispensing.`);
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to block batch');
    },
  });

  // Unblock Batch Mutation
  const unblockMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/pharmacist/batches/${id}/unblock`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-expiry-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      setStatusMsg(`Batch '${data.batch_number}' restored to active dispensing inventory.`);
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to unblock batch');
    },
  });

  const { summary = {}, expired = [], within30Days = [], within60Days = [], within90Days = [], safeStock = [] } =
    data || {};

  const currentList =
    activeTab === 'expired'
      ? expired
      : activeTab === '30'
      ? within30Days
      : activeTab === '60'
      ? within60Days
      : activeTab === '90'
      ? within90Days
      : [...expired, ...within30Days, ...within60Days, ...within90Days, ...safeStock];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClockAlert className="w-6 h-6 text-red-600" />
            Expiry Monitoring & Quarantine Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Categorized batch monitoring (Expired, &lt;30d, &lt;60d, &lt;90d), safety blocking, and quarantine audit logs.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Audit
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* 4 Categorized Expiry KPI Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('expired')}
          className={`p-4 rounded-2xl border text-left transition ${
            activeTab === 'expired'
              ? 'bg-red-500 text-white border-red-500 shadow-md ring-2 ring-red-200'
              : 'bg-white border-slate-200 hover:border-red-300'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase ${activeTab === 'expired' ? 'text-red-100' : 'text-red-600'}`}>
            Critical Alert
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-xl font-bold">Expired Batches</h3>
            <span className={`text-xl font-black ${activeTab === 'expired' ? 'text-white' : 'text-red-700'}`}>
              {summary.totalExpired || 0}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${activeTab === 'expired' ? 'text-red-100' : 'text-slate-400'}`}>
            Strictly blocked from sale
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('30')}
          className={`p-4 rounded-2xl border text-left transition ${
            activeTab === '30'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-200'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase ${activeTab === '30' ? 'text-amber-100' : 'text-amber-600'}`}>
            Imminent Expiry
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-xl font-bold">&le; 30 Days</h3>
            <span className={`text-xl font-black ${activeTab === '30' ? 'text-white' : 'text-amber-700'}`}>
              {summary.totalWithin30 || 0}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${activeTab === '30' ? 'text-amber-100' : 'text-slate-400'}`}>
            Prioritize in FEFO
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('60')}
          className={`p-4 rounded-2xl border text-left transition ${
            activeTab === '60'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase ${activeTab === '60' ? 'text-blue-100' : 'text-blue-600'}`}>
            Watch List
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-xl font-bold">31 - 60 Days</h3>
            <span className={`text-xl font-black ${activeTab === '60' ? 'text-white' : 'text-blue-700'}`}>
              {summary.totalWithin60 || 0}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${activeTab === '60' ? 'text-blue-100' : 'text-slate-400'}`}>
            Plan replenishment
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('90')}
          className={`p-4 rounded-2xl border text-left transition ${
            activeTab === '90'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase ${activeTab === '90' ? 'text-slate-300' : 'text-slate-500'}`}>
            Monitoring
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-xl font-bold">61 - 90 Days</h3>
            <span className={`text-xl font-black ${activeTab === '90' ? 'text-white' : 'text-slate-900'}`}>
              {summary.totalWithin90 || 0}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${activeTab === '90' ? 'text-slate-300' : 'text-slate-400'}`}>
            Standard rotation
          </p>
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search medicine or batch..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
            />
          </div>

          <span className="text-xs font-semibold text-slate-500">
            Showing: <strong className="text-slate-900">{currentList.length}</strong> Batches
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 mt-2">Scanning expiry dates across batches...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-700">No batches currently in this expiry window</p>
            <p className="text-slate-400 mt-1">Pharmacy inventory is compliant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Medicine Name</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4 text-center">Batch Stock</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Days Left</th>
                  <th className="py-3 px-4">Status & Quarantine</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {currentList.map((b) => {
                  const isExpired = b.days_left < 0;
                  const isBlocked = b.is_blocked;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.medicine_name}</div>
                        <div className="text-[11px] text-slate-400">{b.category || 'General'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.batch_number}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">{b.quantity} Units</td>
                      <td className="py-3 px-4 text-slate-600">
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold ${
                            isExpired
                              ? 'text-red-700'
                              : b.days_left <= 30
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {isExpired ? `Expired (${Math.abs(b.days_left)}d ago)` : `${b.days_left} Days`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isBlocked ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              QUARANTINED
                            </span>
                            {b.blocked_reason && (
                              <p className="text-[10px] text-rose-600 mt-0.5 max-w-[150px] truncate" title={b.blocked_reason}>
                                {b.blocked_reason}
                              </p>
                            )}
                          </div>
                        ) : isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            EXPIRED (BLOCK PENDING)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ACTIVE FOR FEFO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isBlocked ? (
                          <button
                            type="button"
                            disabled={isExpired || unblockMutation.isPending}
                            onClick={() => unblockMutation.mutate(b.id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
                            title={isExpired ? 'Expired batches cannot be unblocked' : 'Restore to active'}
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={blockMutation.isPending}
                            onClick={() =>
                              blockMutation.mutate({
                                id: b.id,
                                reason: isExpired ? 'Expired batch blocked by pharmacist' : 'Near-expiry quarantine',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 font-semibold transition inline-flex items-center gap-1"
                          >
                            <ShieldBan className="w-3.5 h-3.5" /> Block Batch
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
