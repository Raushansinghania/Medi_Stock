import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Sliders,
  RefreshCw,
  BarChart2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('movements'); // 'movements' | 'batches'
  const [movementFilter, setMovementFilter] = useState('');

  // Batches filter
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatus, setBatchStatus] = useState('');
  const [blockModalTarget, setBlockModalTarget] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  // Fetch summary
  const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => {
      const res = await api.get('/inventory/summary');
      return res.data;
    },
  });

  // Fetch movements
  const { data: movementsData, isLoading: isMovementsLoading, refetch: refetchMovements } = useQuery({
    queryKey: ['inventory-movements', movementFilter],
    queryFn: async () => {
      const param = movementFilter ? `?movement_type=${movementFilter}` : '';
      const res = await api.get(`/inventory/movements${param}`);
      return res.data;
    },
  });

  // Fetch batches
  const { data: batchesData, isLoading: isBatchesLoading, refetch: refetchBatches, isFetching: isBatchesFetching } = useQuery({
    queryKey: ['inventory-batches', batchSearch, batchStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (batchSearch.trim()) params.append('search', batchSearch.trim());
      if (batchStatus) params.append('status', batchStatus);
      const res = await api.get(`/inventory/batches?${params.toString()}`);
      return res.data || [];
    },
    enabled: activeTab === 'batches',
  });

  // Block batch mutation
  const blockMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/inventory/batches/${id}/block`, { reason });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setBlockModalTarget(null);
      setBlockReason('');
      setStatusMsg({ type: 'success', text: `Batch ${data.batch_number} quarantined and blocked from dispensing.` });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to block batch' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  // Unblock batch mutation
  const unblockMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/inventory/batches/${id}/unblock`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setStatusMsg({ type: 'success', text: `Batch ${data.batch_number} restored to active dispensing inventory.` });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to unblock batch' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const summary = summaryData?.summary || {};
  const movements = movementsData || [];
  const batches = batchesData || [];

  const handleRefresh = () => {
    refetchSummary();
    if (activeTab === 'movements') refetchMovements();
    if (activeTab === 'batches') refetchBatches();
  };

  const getBadgeForType = (type) => {
    switch (type) {
      case 'purchase':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sale':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'return':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'adjustment':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <Boxes className="w-3.5 h-3.5" /> Perpetual Inventory & Batch Ledger
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory & Batch Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit-level stock ledger tracking every purchase increment, FEFO batch allocation, quarantine events, and valuations.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw className="w-4 h-4 text-teal-600" /> Refresh Ledger
        </button>
      </div>

      {statusMsg && (
        <div
          className={cn(
            'p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium',
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          )}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inventory Valuation Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Total Units in Stock</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {isSummaryLoading ? '...' : Number(summary.total_units_in_stock || 0).toLocaleString()}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Across {summary.total_medicines || 0} formulations</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Inventory Cost Valuation</span>
          <p className="text-2xl font-bold text-teal-600 mt-1">
            ${isSummaryLoading ? '...' : Number(summary.total_inventory_cost_valuation || 0).toFixed(2)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Based on FIFO/FEFO purchase costs</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Retail Realizable Value</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ${isSummaryLoading ? '...' : Number(summary.total_inventory_retail_valuation || 0).toFixed(2)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Gross realizable value</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Stock Health Alerts</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {summary.low_stock_count || 0} Low Stock
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {summary.out_of_stock_count || 0} Out of Stock
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">{summary.near_expiry_count || 0} batches expiring soon</span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab('movements')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2',
            activeTab === 'movements' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Sliders className="w-3.5 h-3.5 text-teal-600" />
          Stock Movements Trail
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2',
            activeTab === 'batches' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Boxes className="w-3.5 h-3.5 text-teal-600" />
          Batch Management & FEFO Quarantine
        </button>
      </div>

      {/* TAB 1: Stock Movements Table */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-slate-900">Immutable Stock Movements Trail</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Filter Type:</span>
              <select
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none"
              >
                <option value="">All Movement Types</option>
                <option value="purchase">Purchases (Inbound +)</option>
                <option value="sale">Sales (Outbound -)</option>
                <option value="return">Returns (Restored +)</option>
                <option value="adjustment">Adjustments</option>
              </select>
            </div>
          </div>

          {isMovementsLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="lg" text="Loading stock movements from MySQL..." />
            </div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">No stock movements recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Medicine</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Movement Type</th>
                    <th className="py-3 px-4 text-center">Quantity Delta</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((sm) => {
                    const isPositive = sm.movement_type === 'purchase' || sm.movement_type === 'return';
                    return (
                      <tr key={sm.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500">{sm.created_at}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{sm.medicine_name}</td>
                        <td className="py-3 px-4 text-slate-500">{sm.category || 'General'}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border', getBadgeForType(sm.movement_type))}
                          >
                            {sm.movement_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className={isPositive ? 'text-emerald-600' : 'text-blue-600'}>
                            {isPositive ? '+' : '-'}
                            {sm.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {sm.reference_type} #{sm.reference_id || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-sm truncate">{sm.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Batch Management & FEFO Quarantine Table */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Batch Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search batch #, medicine name..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: '', label: 'All Batches' },
                { id: 'active', label: 'Active Sellable' },
                { id: 'near_expiry', label: 'Near Expiry (≤90d)' },
                { id: 'expired', label: 'Expired' },
                { id: 'blocked', label: 'Quarantined / Blocked' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBatchStatus(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold transition',
                    batchStatus === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isBatchesLoading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" text="Loading batches and FEFO statuses from MySQL..." />
              </div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">No batches found matching filter criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Medicine Formulation</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-center">Days Left</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-right">Cost Price</th>
                      <th className="py-3 px-4 text-right">Retail Price</th>
                      <th className="py-3 px-4 text-center">Quarantine Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((b) => {
                      const isExpired = b.days_left < 0;
                      const isNearExpiry = b.days_left >= 0 && b.days_left <= 90;
                      return (
                        <tr key={b.id} className={cn('hover:bg-slate-50/70 transition', b.is_blocked && 'bg-rose-50/20')}>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.batch_number}</td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{b.medicine_name}</p>
                            <p className="text-[10px] text-slate-400">{b.category || 'General'}</p>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                                isExpired
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : isNearExpiry
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700'
                              )}
                            >
                              {isExpired ? 'EXPIRED' : `${b.days_left}d left`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">{b.quantity} units</td>
                          <td className="py-3 px-4 text-right text-slate-600">${Number(b.purchase_price || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            ${Number(b.selling_price || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {b.is_blocked ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                Quarantined
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Eligible for FEFO
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {b.is_blocked ? (
                              <button
                                onClick={() => unblockMutation.mutate(b.id)}
                                disabled={unblockMutation.isPending || isExpired}
                                title={isExpired ? 'Expired batches cannot be unblocked' : 'Restore to active stock'}
                                className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg disabled:opacity-40"
                              >
                                Unblock
                              </button>
                            ) : (
                              <button
                                onClick={() => setBlockModalTarget(b)}
                                className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                              >
                                Block / Quarantine
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
      )}

      {/* Block / Quarantine Modal */}
      {blockModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-6 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Quarantine Batch {blockModalTarget.batch_number}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Blocking this batch will immediately prevent it from being allocated or dispensed via FEFO.
            </p>

            <div className="mt-4">
              <label className="block font-semibold text-slate-700 mb-1">Reason for Quarantine *</label>
              <textarea
                rows="3"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Suspected packaging damage, temperature breach, or recall order..."
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              ></textarea>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setBlockModalTarget(null)}
                className="px-3.5 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  blockMutation.mutate({
                    id: blockModalTarget.id,
                    reason: blockReason || 'Quarantined by administrator',
                  })
                }
                disabled={blockMutation.isPending}
                className="px-4 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-700 font-bold shadow-xs"
              >
                Confirm Quarantine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
